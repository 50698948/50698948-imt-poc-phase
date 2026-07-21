"""
Reranker — dual-mode: offline cosine similarity or LLM listwise ranking.

LLM_MODE="offline" → cosine similarity against root_cause embeddings
LLM_MODE="openai" or "custom" → LLM listwise scoring
"""

import json
from embedding import embed, cosine_similarity
from config import FINAL_TOPK, LLM_MODE, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

_llm_client = None


def _get_llm_client():
    global _llm_client
    if _llm_client is None and LLM_MODE != "offline":
        from openai import OpenAI
        _llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _llm_client


def _rerank_llm(current_ticket: dict, candidates: list[dict], top_k: int) -> list[dict]:
    client = _get_llm_client()
    parts = []
    for i, c in enumerate(candidates):
        parts.append(
            f"[cid={i}] {c.get('incident_no','?')} | {c.get('title','')}\n"
            f"  Root cause: {c.get('root_cause','N/A')[:150]}\n"
            f"  Resolution: {c.get('resolution','N/A')[:150]}\n"
        )
    prompt = f"""Score each candidate by relevance to the current incident (0-100).

Current: [{current_ticket.get('service_name','')}] {current_ticket.get('title','')}
{current_ticket.get('description','')[:500]}

Candidates:
{chr(10).join(parts)}

Return JSON array: [{{"cid": int, "score": int, "reason": "one sentence"}}] sorted by score."""
    resp = client.chat.completions.create(model=LLM_MODEL, messages=[{"role": "user", "content": prompt}], temperature=0.0)
    raw = resp.choices[0].message.content or "[]"
    try:
        scores = json.loads(raw)
    except json.JSONDecodeError:
        cleaned = raw.strip().replace("`", "")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        scores = json.loads(cleaned)
    score_map = {s["cid"]: s for s in scores}
    reranked = []
    for s in sorted(scores, key=lambda x: x["score"], reverse=True):
        cid = s["cid"]
        if cid < len(candidates):
            d = dict(candidates[cid])
            d["rerank_score"] = s["score"]
            d["rerank_reason"] = s.get("reason", "")
            reranked.append(d)
    return reranked[:top_k]


def _rerank_offline(current_ticket: dict, candidates: list[dict], top_k: int) -> list[dict]:
    current_text = f"{current_ticket.get('title','')} {current_ticket.get('description','')}"
    current_vec = embed(current_text)[0]
    scored = []
    for c in candidates:
        rc = c.get("root_cause", "")
        res = c.get("resolution", "")
        if rc or res:
            hist_vec = embed(f"{rc} {res}")[0]
            sim = cosine_similarity(current_vec, hist_vec)
            score = sim * 100.0
            reason = ("Root cause highly aligned" if sim > 0.6 else
                      "Partial root cause alignment" if sim > 0.3 else
                      "General symptom similarity")
        else:
            score = c.get("rrf_score", 0.5) * 100.0
            reason = "No root cause data; based on RRF fusion score"
        doc = dict(c)
        doc["rerank_score"] = round(score, 1)
        doc["rerank_reason"] = reason
        scored.append(doc)
    scored.sort(key=lambda x: x["rerank_score"], reverse=True)
    return scored[:top_k]


def rerank(current_ticket: dict, candidates: list[dict], top_k: int = FINAL_TOPK) -> list[dict]:
    if not candidates:
        return []
    if LLM_MODE == "offline":
        return _rerank_offline(current_ticket, candidates, top_k)
    else:
        return _rerank_llm(current_ticket, candidates, top_k)

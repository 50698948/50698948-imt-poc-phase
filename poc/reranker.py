"""
Rule-based reranker: uses cosine similarity against root_cause embeddings.

When LLM is unavailable (offline PoC), this provides a reasonable
approximation by weighing root-cause alignment more heavily.
"""

from embedding import embed, cosine_similarity
from config import FINAL_TOPK


def rerank(
    current_ticket: dict,
    candidates: list[dict],
    top_k: int = FINAL_TOPK,
) -> list[dict]:
    if not candidates:
        return []

    current_text = (
        f"{current_ticket.get('title', '')} "
        f"{current_ticket.get('description', '')}"
    )
    current_vec = embed(current_text)[0]

    scored = []
    for c in candidates:
        score = 0.0
        reason = ""

        rc = c.get("root_cause", "")
        res = c.get("resolution", "")

        if rc or res:
            hist_text = f"{rc} {res}"
            hist_vec = embed(hist_text)[0]
            rc_sim = cosine_similarity(current_vec, hist_vec)
            score = rc_sim * 100.0
            if rc_sim > 0.6:
                reason = "Root cause highly aligned"
            elif rc_sim > 0.3:
                reason = "Partial root cause alignment"
            else:
                reason = "General symptom similarity"
        else:
            score = c.get("rrf_score", 0.5) * 100.0
            reason = "No root cause data; based on RRF fusion score"

        doc = dict(c)
        doc["rerank_score"] = round(score, 1)
        doc["rerank_reason"] = reason
        scored.append(doc)

    scored.sort(key=lambda x: x["rerank_score"], reverse=True)
    return scored[:top_k]

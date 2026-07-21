"""
Action-plan generator — dual-mode: offline template or LLM-powered.

LLM_MODE="offline" → template-based using matched historical tickets
LLM_MODE="openai" or "custom" → LLM-generated analysis
"""

from config import LLM_MODE, LLM_API_KEY, LLM_BASE_URL, LLM_MODEL

_llm_client = None


def _get_llm_client():
    global _llm_client
    if _llm_client is None and LLM_MODE != "offline":
        from openai import OpenAI
        _llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _llm_client


def _generate_llm(current_ticket: dict, history_tickets: list[dict]) -> str:
    client = _get_llm_client()
    history_text_parts = []
    for i, t in enumerate(history_tickets, 1):
        history_text_parts.append(
            f"[Historical #{i}] {t.get('incident_no','?')}\n"
            f"  Title: {t.get('title','')}\n"
            f"  Root cause: {t.get('root_cause','N/A')[:200]}\n"
            f"  Resolution: {t.get('resolution','N/A')[:200]}\n"
            f"  Action plan: {t.get('action_plan','N/A')[:200]}\n"
        )
    prompt = f"""You are a senior SRE. Analyze the current incident using similar historical tickets and produce a recommended action plan.

=== CURRENT INCIDENT ===
Title: {current_ticket.get('title','')}
Service: {current_ticket.get('service_name','')}
Category: {current_ticket.get('category','')}
Severity: {current_ticket.get('severity','')}
Error type: {current_ticket.get('error_type','N/A')}
Description: {current_ticket.get('description','')[:800]}

=== SIMILAR HISTORICAL TICKETS ===
{chr(10).join(history_text_parts)}

Output sections:
## 1. Alignment Analysis
## 2. Root Cause Hypothesis (ordered, with probabilities, citing ticket IDs)
## 3. Action Plan (Phase A: Emergency / Phase B: Diagnosis / Phase C: Fix)
## 4. Confidence Assessment (high/medium/low with reasoning)"""
    resp = client.chat.completions.create(model=LLM_MODEL, messages=[{"role": "user", "content": prompt}], temperature=0.3)
    return resp.choices[0].message.content or "(empty)"


def _generate_template(current_ticket: dict, history_tickets: list[dict]) -> str:
    lines = []
    lines.append("=" * 70)
    lines.append("RECOMMENDED ACTION PLAN (template-based, offline PoC)")
    lines.append("=" * 70)
    lines.append("\n## 1. Alignment Analysis\n")
    lines.append(f"Current: [{current_ticket.get('service_name','?')}] {current_ticket.get('title','')}")
    for i, t in enumerate(history_tickets, 1):
        lines.append(f"  [{i}] {t.get('incident_no','?')} (score={t.get('rerank_score',0):.1f}) — {t.get('title','')}")
    lines.append("\n## 2. Root Cause Hypothesis\n")
    for i, t in enumerate(history_tickets, 1):
        lines.append(f"- **H{i}** (~{max(10,100-(i-1)*15)}%): {t.get('root_cause','N/A')[:200]}")
        lines.append(f"  Source: {t.get('incident_no','?')}")
    lines.append("\n## 3. Recommended Action Plan\n")
    lines.append("### Phase A — Emergency Mitigation")
    lines.append("1. Assess blast radius / 2. Check recent deployments / 3. Prepare rollback")
    lines.append("### Phase B — Diagnosis")
    actions = set()
    for t in history_tickets:
        for line in (t.get("action_plan") or "").split("\n"):
            if line.strip() and line.strip()[0].isdigit():
                actions.add(line.strip())
    for i, a in enumerate(sorted(actions)[:8], 1):
        lines.append(f"{i}. {a}")
    lines.append("### Phase C — Root Cause Fix")
    for t in history_tickets[:2]:
        if t.get("resolution"):
            lines.append(f"  Reference ({t.get('incident_no','?')}): {t['resolution'][:150]}")
    top_score = history_tickets[0].get("rerank_score", 0)
    conf = "high" if top_score >= 70 else "medium" if top_score >= 40 else "low"
    lines.append(f"\n## 4. Confidence: **{conf}**")
    lines.append("\n" + "=" * 70)
    return "\n".join(lines)


def generate_action_plan(current_ticket: dict, history_tickets: list[dict]) -> str:
    if not history_tickets:
        return "No historical similar tickets found."
    if LLM_MODE == "offline":
        return _generate_template(current_ticket, history_tickets)
    else:
        return _generate_llm(current_ticket, history_tickets)

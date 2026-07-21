"""
Template-based action-plan generator (offline PoC fallback).

When LLM is unavailable, generates a structured analysis by
comparing the current ticket's metadata with historical tickets.
"""


def generate_action_plan(
    current_ticket: dict,
    history_tickets: list[dict],
) -> str:
    if not history_tickets:
        return "No historical similar tickets found. Unable to generate reference-based analysis."

    lines = []
    lines.append("=" * 70)
    lines.append("RECOMMENDED ACTION PLAN (template-based, offline PoC)")
    lines.append("=" * 70)

    # 1. Alignment Analysis
    lines.append("\n## 1. Alignment Analysis\n")
    lines.append(
        f"Current: [{current_ticket.get('service_name', '?')}] "
        f"{current_ticket.get('title', '')}"
    )
    lines.append(f"Category: {current_ticket.get('category', '?')} | "
                  f"Severity: {current_ticket.get('severity', '?')} | "
                  f"Error: {current_ticket.get('error_type', '?')}")
    lines.append("\nTop matching historical tickets:")
    for i, t in enumerate(history_tickets, 1):
        lines.append(
            f"  [{i}] {t.get('incident_no','?')} (score={t.get('rerank_score',0):.1f}) "
            f"— {t.get('title','')}"
        )
        if t.get("rerank_reason"):
            lines.append(f"      {t.get('rerank_reason')}")

    # 2. Root Cause Hypothesis
    lines.append("\n## 2. Root Cause Hypothesis (by similarity)\n")
    for i, t in enumerate(history_tickets, 1):
        prob = max(10, 100 - (i - 1) * 15)
        lines.append(f"- **Hypothesis {i}** (probability: ~{prob}%)")
        if t.get("root_cause"):
            lines.append(f"  {t['root_cause'][:200]}")
        lines.append(f"  Source: {t.get('incident_no','?')} | "
                      f"Resolved by: {t.get('resolution','N/A')[:100]}")
        lines.append("")

    # 3. Recommended Action Plan
    lines.append("## 3. Recommended Action Plan\n")

    lines.append("### Phase A — Emergency Mitigation")
    lines.append("1. Assess blast radius: identify all affected services/components")
    lines.append("2. Check recent deployments or config changes in "
                  f"'{current_ticket.get('service_name', '?')}'")
    lines.append("3. If specific error type is known, apply the corresponding check "
                  f"(error_type={current_ticket.get('error_type', '?')})")
    lines.append("4. Prepare rollback plan if recent deployment is suspected")
    lines.append("")

    lines.append("### Phase B — Diagnosis & Verification")
    lines.append("Based on matched historical tickets:")
    action_items = set()
    for t in history_tickets:
        if t.get("action_plan"):
            for line in t["action_plan"].split("\n"):
                line = line.strip()
                if line and line[0].isdigit():
                    action_items.add(line)
    for i, item in enumerate(sorted(action_items)[:8], 1):
        lines.append(f"{i}. {item}")
    lines.append("")

    lines.append("### Phase C — Root Cause Fix")
    lines.append("1. Apply fix validated in the highest-scoring historical ticket")
    for t in history_tickets[:2]:
        if t.get("resolution"):
            lines.append(f"   Reference ({t.get('incident_no','?')}): {t['resolution'][:150]}")
    lines.append("2. Verify fix in staging/test environment before production rollout")
    lines.append("3. Monitor key metrics for 30min post-fix")
    lines.append("")

    # 4. Confidence
    lines.append("## 4. Confidence Assessment")
    top_score = history_tickets[0].get("rerank_score", 0)
    if top_score >= 70:
        confidence = "high"
        note = "Strong root cause alignment with historical ticket(s)"
    elif top_score >= 40:
        confidence = "medium"
        note = "Partial alignment — verify hypothesis manually"
    else:
        confidence = "low"
        note = "Weak alignment — use historical references as suggestions only"
    lines.append(f"- Overall confidence: **{confidence}**")
    lines.append(f"- {note}")
    lines.append(f"- Key sources: {', '.join(t.get('incident_no','?') for t in history_tickets[:3])}")

    lines.append("\n" + "=" * 70)
    lines.append("NOTE: LLM-based generation unavailable (offline PoC mode).")
    lines.append("The above is template-based using rule matching & embedding similarity.")
    lines.append("=" * 70)

    return "\n".join(lines)

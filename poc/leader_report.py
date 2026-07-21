"""
Leader/Executive Report Generator — produces structured incident updates
with key highlights for leadership consumption.

Template sections:
  1. Executive Summary
  2. Current Status
  3. Impact Assessment
  4. Investigation Progress
  5. Key Highlights (3-5 items)
  6. Recommended Next Steps
"""

import json
from datetime import datetime, timezone

TEMPLATE = """=======================================================================
                 INCIDENT LEADERSHIP REPORT
=======================================================================
Incident  : {incident_no}
Title     : {title}
Service   : {service_name}
Category  : {category}
Severity  : {severity}      Status: {status}
Updated   : {updated_at}    Version: v{version}
=======================================================================

## 1. Executive Summary

{summary}

## 2. Current Status

  Status         : {status}
  Severity       : {severity}
  Error Type     : {error_type}
  Affected Service: {service_name}
  Category       : {category}
  Ticket Version : v{version}
  Last Updated   : {updated_at}

## 3. Impact Assessment

{impact}

## 4. Investigation Progress

{investigation}

## 5. Key Highlights

{highlights}

## 6. Recommended Next Steps

{next_steps}

=======================================================================
Generated: {generated_at}
======================================================================="""


def _build_summary(ticket: dict, similar: list[dict]) -> str:
    parts = [ticket.get("description", "")[:300]]
    if similar:
        best = similar[0]
        score = best.get("rerank_score", 0)
        if score >= 15:
            parts.append(
                f"\n  Closest historical match: {best.get('incident_no','?')} — "
                f"{best.get('title','')} (similarity score={score:.0f})"
            )
    return "\n  ".join(parts)


def _build_impact(ticket: dict) -> str:
    sev = ticket.get("severity", "P2")
    svc = ticket.get("service_name", "unknown")
    sev_desc = {"P0": "CRITICAL — customer-facing outage, revenue impact",
                "P1": "HIGH — degraded service, partial user impact",
                "P2": "MEDIUM — non-critical degradation",
                "P3": "LOW — minor issue, no user impact"}
    lines = [
        f"  Severity: {sev} ({sev_desc.get(sev, sev)})",
        f"  Affected service: {svc}",
        f"  Error type: {ticket.get('error_type', 'N/A')}",
    ]
    return "\n".join(lines)


def _build_investigation(ticket: dict) -> str:
    lines = []
    if ticket.get("root_cause"):
        lines.append(f"  Root cause identified: {ticket['root_cause'][:250]}")
    if ticket.get("resolution"):
        lines.append(f"  Resolution applied: {ticket['resolution'][:250]}")
    if not lines:
        status = ticket.get("status", "open")
        if status == "open":
            lines.append("  Initial triage in progress. Investigation underway.")
        elif status == "investigating":
            lines.append("  Active investigation. Gathering logs, metrics, and traces.")
        elif status == "mitigated":
            lines.append("  Impact mitigated. Root cause investigation ongoing.")
        elif status == "resolved":
            lines.append("  Incident resolved. Post-mortem pending.")
    return "\n".join(lines)


def _build_highlights(ticket: dict, similar: list[dict]) -> list[str]:
    highlights = []

    # HL1: Status change / key event
    status = ticket.get("status", "open")
    highlights.append(f"[STATUS] Incident is currently **{status.upper()}**"
                      f" — severity {ticket.get('severity','?')}")

    # HL2: Root cause if found
    if ticket.get("root_cause"):
        highlights.append(f"[ROOT CAUSE] {ticket['root_cause'][:150]}")

    # HL3: Resolution if applied
    if ticket.get("resolution"):
        highlights.append(f"[ACTION] Resolution applied: {ticket['resolution'][:150]}")

    # HL4-5: Top similar historical references (exclude self)
    ext_refs = [t for t in similar if t.get("incident_no") != ticket.get("incident_no")]
    rn = len(highlights) + 1
    for t in ext_refs[:2]:
        highlights.append(
            f"[REFERENCE #{rn}] "
            f"Similar past incident {t.get('incident_no','?')}: "
            f"{t.get('title','')[:100]}"
        )
        rn += 1

    # HL last: Next action
    if ticket.get("status") == "resolved":
        highlights.append("[NEXT] Monitor for 30min. Schedule post-mortem within 24h.")
    elif ticket.get("resolution") and ticket.get("status") != "resolved":
        highlights.append("[NEXT] Verify resolution. Update status if confirmed.")
    elif ticket.get("root_cause"):
        highlights.append("[NEXT] Apply fix. Validate in staging. Roll out to production.")
    else:
        highlights.append("[NEXT] Continue investigation. Focus on recent deployments and config changes.")

    return highlights[:5]


def _build_next_steps(ticket: dict, similar: list[dict]) -> str:
    lines = []
    status = ticket.get("status", "open")

    if status == "open":
        lines.append("  1. Triage: identify scope and severity")
        lines.append("  2. Check recent deployments/config changes")
        lines.append("  3. Engage on-call for affected service")
    elif status == "investigating":
        if ticket.get("root_cause"):
            lines.append("  1. Confirm root cause hypothesis with data")
            lines.append("  2. Prepare and test fix in staging")
            lines.append("  3. Plan rollout window")
        else:
            lines.append("  1. Collect additional logs/metrics/traces")
            lines.append("  2. Review similar incidents for patterns")
            lines.append("  3. Escalate if no progress in 30min")
    elif status == "mitigated":
        lines.append("  1. Validate mitigation effectiveness")
        lines.append("  2. Complete root cause investigation")
        lines.append("  3. Develop permanent fix")
    elif status == "resolved":
        lines.append("  1. Monitor key metrics for 30min")
        lines.append("  2. Schedule post-mortem within 24h")
        lines.append("  3. Create action items from lessons learned")

    if similar:
        lines.append(f"  4. Review historical resolution: {similar[0].get('incident_no','?')}")

    return "\n".join(lines)


def generate_leader_report(
    ticket: dict,
    similar_tickets: list[dict] | None = None,
) -> str:
    """Generate a leadership report for the given ticket.

    Uses *similar_tickets* (already reranked) for reference highlights.
    """
    similar = similar_tickets or []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    highlights = _build_highlights(ticket, similar)

    return TEMPLATE.format(
        incident_no=ticket.get("incident_no", "?"),
        title=ticket.get("title", ""),
        service_name=ticket.get("service_name", ""),
        category=ticket.get("category", ""),
        severity=ticket.get("severity", ""),
        status=ticket.get("status", "open"),
        updated_at=ticket.get("updated_at", now),
        version=ticket.get("version", 1),
        summary=_build_summary(ticket, similar),
        error_type=ticket.get("error_type", "N/A"),
        impact=_build_impact(ticket),
        investigation=_build_investigation(ticket),
        highlights="\n".join(f"  {i+1}. {h}" for i, h in enumerate(highlights)),
        next_steps=_build_next_steps(ticket, similar),
        generated_at=now,
    )


def extract_highlights(ticket: dict, similar_tickets: list[dict]) -> list[str]:
    """Return just the 3-5 highlight strings (for DB storage)."""
    return _build_highlights(ticket, similar_tickets)

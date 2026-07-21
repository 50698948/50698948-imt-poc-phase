"""
Incident Ticket Lifecycle Demo — demonstrates how retrieval quality
improves as a ticket evolves through its lifecycle.

Simulates a real incident from initial alert to full resolution,
showing vector embedding updates and re-ranking at each stage.

Usage:
    1. docker compose up -d
    2. python seed_data.py           # (only if fresh DB)
    3. python demo_lifecycle.py
"""

import sys
import json

from models import Base, engine
from db import (
    ingest_ticket,
    update_ticket_status,
    get_ticket_by_incident_no,
    get_latest_report,
    get_report_history,
)
from retrieval import retrieve
from reranker import rerank


# ── Lifecycle stages for a new incident ──
# Each stage adds more detail, simulating investigation progress.

LIFECYCLE = [
    # ── Stage 0: Initial alert (minimal info) ──
    {
        "stage": "T+0min — Initial Alert (vague)",
        "incident_no": "INC-2025-0001",
        "title": "Payment service failing under load",
        "description": (
            "Payment service returning errors. Users cannot complete checkout."
        ),
        "severity": "P0",
        "service_name": "payment-service",
        "category": "application",
        "error_type": None,
        "status": "open",
        "root_cause": None,
        "resolution": None,
    },
    # ── Stage 1: SRE adds detail after initial triage ──
    {
        "stage": "T+10min — Triage Complete (enriched description)",
        "incident_no": "INC-2025-0001",
        "status": "investigating",
        "description": (
            "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. "
            "P99 latency jumped from 200ms to 30s. 60% of transactions failing. "
            "Downstream payment processor (Stripe) responding in 150ms — delay is NOT external. "
            "Thread dump shows 200 threads blocked on HikariCP getConnection(). "
            "Connection pool max=50, active=50, pending=340."
        ),
        "error_type": "timeout",
    },
    # ── Stage 2: Root cause identified ──
    {
        "stage": "T+45min — Root Cause Found",
        "incident_no": "INC-2025-0001",
        "status": "investigating",
        "description": (
            "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. "
            "P99 latency 30s. Connection pool HikariCP max=50, active=50, pending=340. "
            "Traced to a deployment at 14:00 that added a new fraud-check service call "
            "inside the /charge handler. Each charge now makes 4 sequential HTTP calls "
            "(validate-card → fraud-check → charge → notify), each holding a DB connection "
            "for the entire duration. Previously it was only 2 calls (validate → charge). "
            "The fraud-check service has P99=2s, so connection hold time doubled to 4s, "
            "exhausting the 50-connection pool at just 12 req/s."
        ),
        "error_type": "timeout",
        "root_cause": (
            "New deployment added a fraud-check HTTP call inside the /charge handler, "
            "increasing the critical path from 2 to 4 sequential calls. Each call holds "
            "a database connection for its duration. With fraud-check P99=2s, connection "
            "hold time doubled to ~4s, exhausting the 50-connection pool at 12 req/s "
            "(was 25 req/s). This is a classic N+1 connection pattern where each external "
            "call within a DB transaction blocks connection return."
        ),
    },
    # ── Stage 3: Resolution applied, ticket resolved ──
    {
        "stage": "T+90min — Resolved",
        "incident_no": "INC-2025-0001",
        "status": "resolved",
        "description": (
            "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. "
            "P99 latency 30s. Connection pool exhausted at 50/50 with 340 pending. "
            "Root cause: fraud-check call added to /charge handler increased connection "
            "hold time to 4s per request."
        ),
        "error_type": "timeout",
        "root_cause": (
            "New deployment added a fraud-check HTTP call inside the /charge handler, "
            "increasing the critical path from 2 to 4 sequential calls. Each call holds "
            "a database connection for its duration. With fraud-check P99=2s, connection "
            "hold time doubled to ~4s, exhausting the 50-connection pool at 12 req/s."
        ),
        "resolution": (
            "1. Rolled back the deployment to remove fraud-check from critical path. "
            "2. Connection pool recovered within 30s. "
            "3. Moved fraud-check to async post-processing (out of /charge handler). "
            "4. Increased connection pool size from 50 to 150 as buffer. "
            "5. Added Prometheus alert: HikariCP_pending_connections > 20 for 1min. "
            "6. Added circuit breaker on fraud-check with timeout=500ms fallback=allow."
        ),
    },
]


def print_ticket_summary(ticket: dict, label: str):
    print(f"\n  --- {label} ---")
    print(f"  Incident : {ticket.get('incident_no')}")
    print(f"  Status   : {ticket.get('status')}  v{ticket.get('version', '?')}")
    print(f"  Title    : {ticket.get('title')}")
    print(f"  Desc     : {ticket.get('description')[:120]}...")
    if ticket.get("root_cause"):
        print(f"  RootCause: {ticket['root_cause'][:100]}...")
    if ticket.get("resolution"):
        print(f"  Resolved : {ticket['resolution'][:100]}...")


def print_rerank_table(results: list[dict], label: str, width: int = 80):
    print(f"\n  >>> Top-5 after {label} <<<")
    if not results:
        print("  (no matches)")
        return
    header = f"  {'#':<3} {'Incident No':<14} {'Score':<7} {'Title'}"
    print(header)
    print(f"  {'-'*3} {'-'*14} {'-'*7} {'-'*50}")
    for i, r in enumerate(results[:5], 1):
        print(f"  {i:<3} {r.get('incident_no','?')[:14]:<14} "
              f"{r.get('rerank_score',0):<7.1f} {r.get('title','')[:50]}")


def main():
    Base.metadata.create_all(engine)

    print("=" * 80)
    print("INCIDENT TICKET LIFECYCLE DEMO — Retrieval Quality vs Ticket Maturity")
    print("=" * 80)
    print()
    print("This demo shows how retrieval quality improves as an incident ticket")
    print("evolves through its lifecycle, gaining richer descriptions and")
    print("eventually a root cause.  Embeddings are re-computed on every update.")
    print()

    # ── History tracking for comparison ──
    history: list[dict] = []

    for idx, stage in enumerate(LIFECYCLE):
        print("━" * 80)

        if idx == 0:
            # Create new ticket
            print(f"\n[STAGE {idx}] {stage['stage']}")
            ticket_id = ingest_ticket(
                incident_no=stage["incident_no"],
                title=stage["title"],
                description=stage["description"],
                severity=stage["severity"],
                service_name=stage["service_name"],
                category=stage["category"],
                status=stage["status"],
                error_type=stage["error_type"],
            )
            ticket = get_ticket_by_incident_no(stage["incident_no"])
            assert ticket is not None
            print_ticket_summary(ticket, "Created")
        else:
            # Update existing ticket
            print(f"\n[STAGE {idx}] {stage['stage']}")
            ticket = update_ticket_status(
                incident_no=stage["incident_no"],
                new_status=stage["status"],
                description=stage["description"],
                root_cause=stage.get("root_cause"),
                resolution=stage.get("resolution"),
                error_type=stage.get("error_type"),
            )
            assert ticket is not None
            print_ticket_summary(ticket, f"Updated → {stage['status']}")

        # ── Run retrieval + rerank ──
        candidates = retrieve(ticket)
        candidates = [c for c in candidates if c.get("incident_no") != stage["incident_no"]]
        reranked = rerank(ticket, candidates)

        print_rerank_table(reranked, stage["stage"])

        # ── Show generated leader report ──
        latest_report = get_latest_report(stage["incident_no"])
        if latest_report:
            print(f"\n  >>> LEADER REPORT (v{latest_report['ticket_version']}) <<<")
            for hl in latest_report.get("highlights", []):
                print(f"      * {hl}")

        # ── Record for history ──
        top5_nos = [r.get("incident_no", "?") for r in reranked[:5]]
        top5_scores = [round(r.get("rerank_score", 0), 1) for r in reranked[:5]]
        avg_score = round(sum(top5_scores) / max(len(top5_scores), 1), 1)

        history.append({
            "stage": stage["stage"],
            "version": ticket["version"],
            "status": ticket["status"],
            "has_root_cause": ticket.get("root_cause") is not None,
            "has_resolution": ticket.get("resolution") is not None,
            "desc_chars": len(ticket["description"]),
            "top5_nos": top5_nos,
            "top5_scores": top5_scores,
            "avg_score": avg_score,
        })

    # ══════════════════════════════════════════════════════════════════
    # Summary comparison
    # ══════════════════════════════════════════════════════════════════
    print("\n")
    print("=" * 80)
    print("LIFECYCLE COMPARISON — How Retrieval Quality Evolves")
    print("=" * 80)
    print()
    print(f"  {'Stage':<15} {'v':<3} {'Status':<14} {'RC?':<4} {'DescLen':<8} {'Avg Score':<10} {'Top Match'}")
    print(f"  {'-'*15} {'-'*3} {'-'*14} {'-'*4} {'-'*8} {'-'*10} {'-'*30}")

    max_avg = max(h["avg_score"] for h in history)
    for h in history:
        bar = "█" * int(h["avg_score"] / max(max_avg, 0.01) * 20)
        print(
            f"  {h['stage'][:14]:<15} "
            f"{h['version']:<3} "
            f"{h['status']:<14} "
            f"{'Y' if h['has_root_cause'] else 'N':<4} "
            f"{h['desc_chars']:<8} "
            f"{h['avg_score']:<10.1f} "
            f"{bar} {h['top5_nos'][0] if h['top5_nos'] else 'N/A'}"
        )

    print()
    print("  Key observation: as description becomes more specific and root_cause")
    print("  is populated, the embedding narrows to better match semantically")
    print("  similar historical tickets, progressively improving rerank scores.")
    print()
    print("=" * 80)
    print("Lifecycle Demo Complete.")
    print("=" * 80)

    # ── Report history summary ──
    print("\n")
    print("=" * 80)
    print("LEADER REPORT HISTORY — How Reports Evolve Across Updates")
    print("=" * 80)
    reports = get_report_history("INC-2025-0001")
    for i, r in enumerate(reports, 1):
        print(f"\n  [v{r['ticket_version']}] {r.get('generated_at','')[:16]}")
        for hl in r.get("highlights", []):
            print(f"    * {hl}")
    print("\n  Key insight: Every ticket update auto-generates a leadership")
    print("  report capturing the current state, impact, and key highlights.")
    print("  Reports evolve as the incident matures from 'triage' → 'root cause' → 'resolved'.")


if __name__ == "__main__":
    main()

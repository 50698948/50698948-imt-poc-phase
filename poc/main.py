"""
E2E PoC: Incident Ticket Intelligent Retrieval & Action Plan Generation.

Usage:
    1. docker compose up -d          # start PostgreSQL 18 + pgvector
    2. python seed_data.py           # populate 20 mock tickets
    3. python main.py                # run E2E with a sample current ticket

Environment:
    OPENAI_API_KEY must be set in .env (copy .env.example).
"""

import json
import sys

from config import MERGE_TOPK, FINAL_TOPK
from retrieval import retrieve
from reranker import rerank
from generator import generate_action_plan
from models import Base, engine


CURRENT_TICKET = {
    "title": "Order service P99 latency spike after MySQL migration",
    "description": (
        "After migrating order-service DB from MySQL 5.7 to 8.0, P99 latency "
        "spiked from 120ms to 2.8s. Slow query log shows 200+ SELECT queries on "
        "the orders table scanning 6M rows per request. No indexes were changed "
        "during migration. Application was NOT redeployed. Connection pool "
        "showing intermittent 'Connection is not available' errors. 5% of "
        "checkout requests failing. MySQL CPU steady at 85%."
    ),
    "service_name": "order-service",
    "category": "database",
    "severity": "P1",
    "error_type": "timeout",
}


def main():
    Base.metadata.create_all(engine)

    print("=" * 70)
    print("INCIDENT TICKET INTELLIGENT RETRIEVAL & ACTION PLAN — PoC")
    print("=" * 70)

    # ── Step 1: Current ticket ──
    print("\n[1/4] Current Incident Ticket:")
    print(f"  Title    : {CURRENT_TICKET['title']}")
    print(f"  Service  : {CURRENT_TICKET['service_name']}")
    print(f"  Category : {CURRENT_TICKET['category']}")
    print(f"  Severity : {CURRENT_TICKET['severity']}")
    print(f"  Error    : {CURRENT_TICKET['error_type']}")

    # ── Step 2: Hybrid retrieval ──
    print(f"\n[2/4] Hybrid Retrieval (vector + FTS + structure → RRF → Top {MERGE_TOPK}) ...")
    candidates = retrieve(CURRENT_TICKET)
    print(f"  Retrieved {len(candidates)} candidates:")
    for i, c in enumerate(candidates, 1):
        print(f"    [{i}] {c.get('incident_no','?')} | RRF={c.get('rrf_score',0):.4f} | {c['title'][:60]}")

    if not candidates:
        print("  No candidates found. Exiting.")
        sys.exit(1)

    # ── Step 3: LLM Rerank ──
    print(f"\n[3/4] LLM Reranking → Top {FINAL_TOPK} ...")
    top_tickets = rerank(CURRENT_TICKET, candidates, top_k=FINAL_TOPK)
    print(f"  Reranked to {len(top_tickets)} tickets:")
    for i, t in enumerate(top_tickets, 1):
        print(f"    [{i}] {t.get('incident_no','?')} | score={t.get('rerank_score',0)} | {t.get('rerank_reason','')[:80]}")

    if not top_tickets:
        print("  Reranking produced empty result. Exiting.")
        sys.exit(1)

    # ── Step 4: Generate action plan ──
    print("\n[4/4] Generating Recommended Action Plan ...")
    plan = generate_action_plan(CURRENT_TICKET, top_tickets)

    print("\n" + "=" * 70)
    print("RESULT: Recommended Action Plan")
    print("=" * 70)
    print(plan)
    print("\n" + "=" * 70)
    print("E2E PoC complete.")
    print("=" * 70)


if __name__ == "__main__":
    main()

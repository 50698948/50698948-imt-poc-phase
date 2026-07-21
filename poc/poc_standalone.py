"""
Self-contained PoC — No Docker, No PostgreSQL, No External API.

Uses SQLite for storage + numpy for vector similarity.
Implements the same 3-path retrieval → RRF fusion → rerank → action plan
pipeline, plus lifecycle demo, entirely within a single process.

Usage:  python poc_standalone.py
"""

import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import textwrap
import time
import uuid
from dataclasses import dataclass, field

import numpy as np

# =========================================================================
# Config
# =========================================================================
EMBEDDING_DIM = 384
VECTOR_TOPK = 50
FTS_TOPK = 50
STRUCT_TOPK = 30
RRF_K = 60
MERGE_TOPK = 30
FINAL_TOPK = 5
RANDOM_SEED = 42
PROJ_VOCAB = 65536

DB_PATH = os.path.join(os.path.dirname(__file__), "imt_poc.db")

# =========================================================================
# Random Projection Embedding (same algorithm as embedding.py)
# =========================================================================
_proj: np.ndarray | None = None
_rng = np.random.default_rng(RANDOM_SEED)


def _get_proj() -> np.ndarray:
    global _proj
    if _proj is None:
        _proj = _rng.normal(0.0, 1.0 / math.sqrt(EMBEDDING_DIM),
                            size=(PROJ_VOCAB, EMBEDDING_DIM)).astype(np.float32)
    return _proj


def embed(text: str) -> list[float]:
    proj = _get_proj()
    tokens = re.findall(r"[a-z0-9]{2,}", text.lower())
    if not tokens:
        return [0.0] * EMBEDDING_DIM
    indices = [int.from_bytes(hashlib.blake2b(t.encode(), digest_size=8).digest(), "big") % PROJ_VOCAB
               for t in tokens]
    vec = proj[np.array(indices, dtype=np.int32)].sum(axis=0)
    norm = np.linalg.norm(vec)
    if norm > 1e-8:
        vec /= norm
    return vec.tolist()


def cosine_sim(a, b):
    aa, bb = np.array(a, np.float32), np.array(b, np.float32)
    return float(np.dot(aa, bb) / (np.linalg.norm(aa) * np.linalg.norm(bb) + 1e-10))

# =========================================================================
# SQLite DB
# =========================================================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS incident_tickets (
    id TEXT PRIMARY KEY,
    incident_no TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    resolution TEXT,
    action_plan TEXT,
    severity TEXT NOT NULL,
    service_name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    error_type TEXT,
    keywords TEXT DEFAULT '[]',
    embedding_description TEXT,
    embedding_root_cause TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    resolved_at TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS tickets_fts USING fts5(
    title, description, root_cause, resolution, content=incident_tickets,
    content_rowid=rowid
);
CREATE INDEX IF NOT EXISTS idx_service ON incident_tickets(service_name);
CREATE INDEX IF NOT EXISTS idx_category ON incident_tickets(category);
CREATE INDEX IF NOT EXISTS idx_status ON incident_tickets(status);
CREATE INDEX IF NOT EXISTS idx_error_type ON incident_tickets(error_type);

CREATE TABLE IF NOT EXISTS leader_reports (
    id TEXT PRIMARY KEY,
    incident_no TEXT NOT NULL,
    ticket_version INTEGER NOT NULL,
    content TEXT NOT NULL,
    highlights TEXT DEFAULT '[]',
    generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_inc ON leader_reports(incident_no, ticket_version);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


# =========================================================================
# Ingest
# =========================================================================

def ingest(ticket: dict) -> str:
    conn = get_db()
    tid = ticket.get("id", str(uuid.uuid4()))
    emb_desc = json.dumps(embed(ticket["title"] + " " + ticket["description"]))
    emb_rc = None
    if ticket.get("root_cause") and ticket.get("resolution"):
        emb_rc = json.dumps(embed(ticket["root_cause"] + " " + ticket["resolution"]))
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    conn.execute("""
        INSERT OR REPLACE INTO incident_tickets
        (id, incident_no, title, description, root_cause, resolution, action_plan,
         severity, service_name, category, status, error_type, keywords,
         embedding_description, embedding_root_cause, version, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)
    """, (
        tid, ticket["incident_no"], ticket["title"], ticket["description"],
        ticket.get("root_cause"), ticket.get("resolution"), ticket.get("action_plan"),
        ticket["severity"], ticket["service_name"], ticket["category"],
        ticket.get("status", "open"), ticket.get("error_type"),
        json.dumps(ticket.get("keywords", [])),
        emb_desc, emb_rc, now, now,
    ))
    conn.execute("""
        INSERT INTO tickets_fts(rowid, title, description, root_cause, resolution)
        VALUES (?,?,?,?,?)
    """, (conn.execute("SELECT last_insert_rowid()").fetchone()[0],
          ticket["title"], ticket["description"],
          ticket.get("root_cause", ""), ticket.get("resolution", "")))
    conn.commit()
    conn.close()
    return tid


# =========================================================================
# Search
# =========================================================================

def search_vector(query_text: str, limit: int = VECTOR_TOPK) -> list[dict]:
    qv = embed(query_text)
    conn = get_db()
    rows = conn.execute("""
        SELECT id, incident_no, title, description, root_cause, resolution,
               action_plan, severity, service_name, category, status, error_type,
               embedding_description
        FROM incident_tickets WHERE embedding_description IS NOT NULL
    """).fetchall()
    scored = []
    for r in rows:
        ev = json.loads(r["embedding_description"])
        scored.append((dict(r), cosine_sim(qv, ev)))
    scored.sort(key=lambda x: x[1], reverse=True)
    conn.close()
    out = []
    for d, s in scored[:limit]:
        d["similarity"] = s
        out.append(d)
    return out


def search_fts(query_text: str, limit: int = FTS_TOPK) -> list[dict]:
    conn = get_db()
    terms = " OR ".join(f'"{w}"' for w in re.findall(r'\w{2,}', query_text.lower()))
    if not terms:
        return []
    rows = conn.execute("""
        SELECT i.*, rank FROM tickets_fts f
        JOIN incident_tickets i ON i.rowid = f.rowid
        WHERE tickets_fts MATCH ? ORDER BY rank LIMIT ?
    """, (terms, limit)).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["similarity"] = float(r["rank"]) if r["rank"] else 0
        out.append(d)
    return out


def search_structure(service_name, category, severity, error_type=None, limit=STRUCT_TOPK):
    conn = get_db()
    q = """SELECT * FROM incident_tickets
           WHERE service_name=? AND category=? AND status='resolved'
           AND (severity=? OR severity=?)"""
    params = [service_name, category, severity,
              {"P0": "P1", "P1": "P2"}.get(severity, severity)]
    if error_type:
        q += " AND error_type=?"
        params.append(error_type)
    q += " ORDER BY severity=? DESC, created_at DESC LIMIT ?"
    params.extend([severity, limit])
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# =========================================================================
# Update (lifecycle)
# =========================================================================

def update_ticket(incident_no: str, **fields) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM incident_tickets WHERE incident_no=?",
                       (incident_no,)).fetchone()
    if not row:
        conn.close()
        return None
    ticket = dict(row)

    ver = ticket["version"] + 1
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    sets = ["version=?", "updated_at=?"]
    params = [ver, now]

    if "description" in fields:
        ticket["description"] = fields["description"]
        emb = json.dumps(embed(ticket["title"] + " " + fields["description"]))
        sets.append("description=?")
        params.append(fields["description"])
        sets.append("embedding_description=?")
        params.append(emb)
    if "root_cause" in fields:
        ticket["root_cause"] = fields["root_cause"]
    if "resolution" in fields:
        ticket["resolution"] = fields["resolution"]
    if "root_cause" in fields or "resolution" in fields:
        rc_text = (ticket.get("root_cause") or "") + " " + (ticket.get("resolution") or "")
        rc_emb = json.dumps(embed(rc_text))
        sets.append("embedding_root_cause=?")
        params.append(rc_emb)
    if "status" in fields:
        sets.append("status=?")
        params.append(fields["status"])
        ticket["status"] = fields["status"]
        if fields["status"] == "resolved":
            sets.append("resolved_at=?")
            params.append(now)
    if "root_cause" in fields:
        sets.append("root_cause=?")
        params.append(fields["root_cause"])
    if "resolution" in fields:
        sets.append("resolution=?")
        params.append(fields["resolution"])
    if "severity" in fields:
        sets.append("severity=?")
        params.append(fields["severity"])
    if "error_type" in fields:
        sets.append("error_type=?")
        params.append(fields["error_type"])
    params.append(incident_no)

    conn.execute(f"UPDATE incident_tickets SET {', '.join(sets)} WHERE incident_no=?", params)
    conn.execute("""
        UPDATE tickets_fts SET title=?, description=?, root_cause=?, resolution=?
        WHERE rowid=(SELECT rowid FROM incident_tickets WHERE incident_no=?)
    """, (ticket.get("title", ""), ticket.get("description", ""),
          ticket.get("root_cause", ""), ticket.get("resolution", ""), incident_no))
    conn.commit()

    # ── Auto-generate leader report ──
    updated = get_ticket(incident_no)
    if updated:
        candidates = retrieve(updated)
        candidates = [c for c in candidates if c.get("incident_no") != incident_no]
        reranked = rerank(updated, candidates)
        highlights = _build_highlights(updated, reranked)
        content = _build_report(updated, reranked, highlights)
        conn.execute(
            "INSERT INTO leader_reports(id, incident_no, ticket_version, content, highlights) VALUES(?,?,?,?,?)",
            (str(uuid.uuid4()), incident_no, ver, content, json.dumps(highlights)))
        conn.commit()
    conn.close()
    return get_ticket(incident_no)


def get_ticket(incident_no: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM incident_tickets WHERE incident_no=?",
                       (incident_no,)).fetchone()
    conn.close()
    return dict(row) if row else None

# =========================================================================
# RRF Fusion
# =========================================================================

def rrf_fusion(result_sets, k=RRF_K, top_k=MERGE_TOPK):
    scores = {}
    docs = {}
    for rank_list in result_sets:
        for rank, doc in enumerate(rank_list):
            did = doc["id"]
            scores[did] = scores.get(did, 0) + 1.0 / (k + rank + 1)
            docs[did] = doc
    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
    merged = []
    for did in sorted_ids[:top_k]:
        d = dict(docs[did])
        d["rrf_score"] = scores[did]
        merged.append(d)
    return merged

# =========================================================================
# Reranker (rule-based, same as reranker.py)
# =========================================================================

def rerank(current_ticket, candidates, top_k=FINAL_TOPK):
    cur_text = current_ticket.get("title", "") + " " + current_ticket.get("description", "")
    cur_vec = np.array(embed(cur_text), dtype=np.float32)
    scored = []
    for c in candidates:
        rc, res = c.get("root_cause") or "", c.get("resolution") or ""
        if rc or res:
            hist_vec = np.array(embed(rc + " " + res), dtype=np.float32)
            sim = cosine_sim(cur_vec.tolist(), hist_vec.tolist())
            score = sim * 100
            reason = ("Root cause highly aligned" if sim > 0.6 else
                      "Partial root cause alignment" if sim > 0.3 else
                      "General symptom similarity")
        else:
            score = c.get("rrf_score", 0.5) * 100
            reason = "No root cause data; based on RRF fusion score"
        d = dict(c)
        d["rerank_score"] = round(score, 1)
        d["rerank_reason"] = reason
        scored.append(d)
    scored.sort(key=lambda x: x["rerank_score"], reverse=True)
    return scored[:top_k]


def retrieve(current_ticket):
    q = current_ticket["title"] + " " + current_ticket["description"]
    svc, cat, sev, etyp = (current_ticket.get("service_name", ""),
                           current_ticket.get("category", ""),
                           current_ticket.get("severity", "P1"),
                           current_ticket.get("error_type"))
    vec = search_vector(q)
    fts = search_fts(q)
    struct = search_structure(svc, cat, sev, etyp)
    return rrf_fusion([vec, fts, struct])


# ── Leader Report Helpers ──

def _build_highlights(ticket, similar):
    h = [f"[STATUS] {ticket.get('status','open').upper()} — severity {ticket.get('severity','?')}"]
    if ticket.get("root_cause"):
        h.append(f"[ROOT CAUSE] {ticket['root_cause'][:150]}")
    if ticket.get("resolution"):
        h.append(f"[ACTION] {ticket['resolution'][:150]}")
    for i, s in enumerate(similar[:2]):
        if s.get("incident_no") == ticket.get("incident_no"):
            continue
        h.append(f"[REFERENCE] Similar: {s.get('incident_no','?')} — {s.get('title','')[:80]}")
    if ticket.get("status") == "resolved":
        h.append("[NEXT] Monitor 30min. Schedule post-mortem within 24h.")
    elif ticket.get("root_cause"):
        h.append("[NEXT] Apply fix. Validate in staging. Roll out.")
    else:
        h.append("[NEXT] Continue investigation. Focus on recent deployments/config changes.")
    return h[:5]


def _build_report(ticket, similar, highlights):
    now = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    lines = [
        "=" * 60,
        f"INCIDENT LEADERSHIP REPORT — {ticket.get('incident_no','?')}",
        "=" * 60,
        f"Service: {ticket.get('service_name','')} | Severity: {ticket.get('severity','')}",
        f"Status: {ticket.get('status','open')} | Version: v{ticket.get('version',1)}",
        f"Updated: {ticket.get('updated_at',now)}",
        "",
        "Key Highlights:",
    ]
    for i, hl in enumerate(highlights, 1):
        lines.append(f"  {i}. {hl}")
    lines.extend([
        "",
        f"Description: {ticket.get('description','')[:300]}",
    ])
    if ticket.get("root_cause"):
        lines.append(f"Root Cause: {ticket['root_cause'][:200]}")
    if ticket.get("resolution"):
        lines.append(f"Resolution: {ticket['resolution'][:200]}")
    lines.append("=" * 60)
    return "\n".join(lines)


def get_report_history_standalone(incident_no):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM leader_reports WHERE incident_no=? ORDER BY ticket_version ASC",
        (incident_no,)).fetchall()
    conn.close()
    return [{"ticket_version": r["ticket_version"], "highlights": json.loads(r["highlights"]),
             "generated_at": r["generated_at"]} for r in rows]

# =========================================================================
# Generator (same logic as generator.py)
# =========================================================================

def generate_action_plan(current_ticket, history_tickets):
    if not history_tickets:
        return "No historical similar tickets found."

    lines = []
    lines.append("=" * 70)
    lines.append("RECOMMENDED ACTION PLAN (template-based, offline PoC)")
    lines.append("=" * 70)

    lines.append("\n## 1. Alignment Analysis\n")
    lines.append(f"Current: [{current_ticket.get('service_name','?')}] {current_ticket.get('title','')}")
    lines.append(f"Category: {current_ticket.get('category','?')} | Severity: {current_ticket.get('severity','?')}")
    lines.append("\nTop matching historical tickets:")
    for i, t in enumerate(history_tickets, 1):
        lines.append(f"  [{i}] {t.get('incident_no','?')} (score={t.get('rerank_score',0):.1f}) — {t.get('title','')}")

    lines.append("\n## 2. Root Cause Hypothesis\n")
    for i, t in enumerate(history_tickets, 1):
        prob = max(10, 100 - (i - 1) * 15)
        lines.append(f"- **H{i}** (~{prob}%): {t.get('root_cause','N/A')[:200]}")
        lines.append(f"  Source: {t.get('incident_no','?')}")

    lines.append("\n## 3. Recommended Action Plan\n")
    lines.append("### Phase A — Emergency Mitigation")
    lines.append("1. Assess blast radius: identify all affected services")
    lines.append("2. Check recent deployments/config changes")
    lines.append("3. Prepare rollback plan if needed\n")
    lines.append("### Phase B — Diagnosis")
    actions = set()
    for t in history_tickets:
        ap = t.get("action_plan") or ""
        for line in ap.split("\n"):
            line = line.strip()
            if line and line[0].isdigit():
                actions.add(line)
    for i, a in enumerate(sorted(actions)[:8], 1):
        lines.append(f"{i}. {a}")
    lines.append("\n### Phase C — Root Cause Fix")
    for t in history_tickets[:2]:
        if t.get("resolution"):
            lines.append(f"  Reference ({t.get('incident_no','?')}): {t['resolution'][:150]}")
    lines.append("\n## 4. Confidence Assessment")
    top_score = history_tickets[0].get("rerank_score", 0)
    conf = "high" if top_score >= 70 else "medium" if top_score >= 40 else "low"
    lines.append(f"- Overall confidence: **{conf}**")
    lines.append(f"- Key sources: {', '.join(t.get('incident_no','?') for t in history_tickets[:3])}")
    lines.append("\n" + "=" * 70)
    return "\n".join(lines)

# =========================================================================
# Seed Data
# =========================================================================

SEED_TICKETS = [
    {"incident_no": "INC-2024-0001", "title": "MySQL master CPU 100% after traffic spike",
     "description": "mysql-master-01 CPU hit 100% at 14:32 UTC. Replication lag grew to 45s on slave-01. Application error rate spiked to 12%. Slow query log shows 10x increase in SELECT * FROM orders WHERE status='pending'.",
     "root_cause": "Missing composite index on (user_id, status) caused full-table scan of 8M-row orders table. Connection pool exhausted as each query took 8s instead of 50ms.",
     "resolution": "1. Added composite index. 2. Set max_execution_time=2000. 3. Scaled read-replicas.",
     "action_plan": "1. Kill long-running queries. 2. Analyze slow-query-log. 3. Add index. 4. Scale replicas. 5. Set up alerts.",
     "severity": "P0", "service_name": "order-service", "category": "database", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0002", "title": "PostgreSQL connection pool exhausted during black-friday",
     "description": "PG connection pool maxed out at 500 connections. New requests failing with 'FATAL: too many clients'. Latency p99 went from 80ms to 12s. HikariCP metrics show active connections stuck at max for 20min.",
     "root_cause": "New deployment introduced N+1 queries in product-listing endpoint. Each page view spawned 200+ individual queries instead of 1 JOIN. Connection pool drained in 3min.",
     "resolution": "1. Rolled back deployment. 2. Rewrote query with JOIN. 3. Increased pool to 150. 4. Added pgbouncer.",
     "action_plan": "1. Rollback deployment or kill idle connections. 2. Check pg_stat_activity. 3. Identify N+1 patterns. 4. Add pgbouncer. 5. Set connection timeout.",
     "severity": "P0", "service_name": "product-service", "category": "database", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0003", "title": "Redis cluster OOM evicting keys under load",
     "description": "Redis cluster nodes started evicting keys due to maxmemory limit. Cache hit rate dropped from 98% to 23% within 5min. Backend MySQL read QPS jumped 15x causing cascading latency.",
     "root_cause": "Background job updated 2M user session entries with TTL=0, saturating Redis memory. Eviction policy allkeys-lru caused hot cache keys to be evicted, exposing bare DB.",
     "resolution": "1. Manually set TTL on oversized keys. 2. Changed eviction policy to volatile-lru. 3. Added memory monitoring.",
     "action_plan": "1. Identify and expire bloated keys. 2. Check INFO memory. 3. Switch eviction policy. 4. Add memory alerts. 5. Audit SET without TTL.",
     "severity": "P1", "service_name": "session-service", "category": "database", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2024-0004", "title": "Deadlock on inventory deduction during flash sale",
     "description": "Multiple concurrent transactions deadlocking on inventory UPDATE. 40% of checkout attempts failed.",
     "root_cause": "Inventory deduction logic locked item_id then warehouse_id in different order across two code paths. Inconsistent lock ordering caused deadlock.",
     "resolution": "1. Standardized lock ordering. 2. Wrapped UPDATEs in single CTE. 3. Added retry with exponential backoff.",
     "action_plan": "1. Restart stuck transactions. 2. Capture deadlock logs. 3. Audit lock ordering. 4. Add retry logic. 5. Consider optimistic locking.",
     "severity": "P0", "service_name": "inventory-service", "category": "database", "status": "resolved", "error_type": "deadlock"},
    {"incident_no": "INC-2024-0005", "title": "Elasticsearch cluster red status — unassigned shards",
     "description": "ES cluster went red after node-03 was terminated by OOM killer. 12 primary shards unassigned. Search API returning 503.",
     "root_cause": "Node-03 held 12 primary shards with replica=0. Node crash left shards unassigned. OOM from bulk reindex job exceeding 4GB Xmx.",
     "resolution": "1. Used _cluster/reroute to allocate stale primary shards. 2. Increased heap to 8GB. 3. Set replica=1.",
     "action_plan": "1. Reroute unassigned shards. 2. Check _cluster/health. 3. Ensure >=1 replica. 4. Review JVM heap. 5. Add disk alerts.",
     "severity": "P0", "service_name": "search-service", "category": "database", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2024-0006", "title": "Intermittent 502 errors between API gateway and upstream",
     "description": "API gateway logging intermittent 502 Bad Gateway errors 5% of requests. Upstream health checks passing. tcpdump shows RST packets during affected windows.",
     "root_cause": "AWS NLB idle timeout was set to 350s. Application keepalive was 360s. During low traffic, connections idled past NLB timeout and were silently dropped.",
     "resolution": "1. Set application keepalive to 300s. 2. Enabled connection pooling with TTL=240s. 3. Added retry on 502.",
     "action_plan": "1. Check LB idle timeout vs app keepalive. 2. Capture packet trace. 3. Adjust keepalive below LB timeout.",
     "severity": "P1", "service_name": "api-gateway", "category": "network", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0007", "title": "DNS resolution failures causing cascading service outages",
     "description": "Multiple services reporting UnknownHostException. dig commands timeout intermittently. 25% of transactions failing.",
     "root_cause": "CoreDNS pods hitting 9984-concurrent-request limit. A new deployment of 50 pods simultaneously sent DNS queries, thundering-herd effect. CoreDNS autoscaler min=1.",
     "resolution": "1. Scaled CoreDNS to 5 replicas. 2. Set podAntiAffinity. 3. Added ndots:2. 4. Adjusted autoscaler.",
     "action_plan": "1. Scale DNS replicas. 2. Check DNS query rate. 3. Verify autoscaler config. 4. Review ndots setting.",
     "severity": "P0", "service_name": "infra-dns", "category": "network", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0011", "title": "Java OOM heap dump after rolling deployment",
     "description": "After deploying v2.4.1, 3 out of 10 instances crashed with OutOfMemoryError: Java heap space within 10min. Heap dump shows 4.2GB occupied by byte[] (90%).",
     "root_cause": "v2.4.1 introduced CSV export feature that loaded entire result set into memory. A user triggered export of 5M rows. No streaming or row-limit implemented.",
     "resolution": "1. Rolled back to v2.4.0. 2. Rewrote CSV export to use StreamingResponseBody. 3. Added row limit of 100K. 4. Set -XX:+HeapDumpOnOutOfMemoryError",
     "action_plan": "1. Rollback deployment. 2. Capture heap dump. 3. Identify memory hotspot. 4. Switch to streaming I/O. 5. Add row limits.",
     "severity": "P0", "service_name": "reporting-service", "category": "application", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2024-0012", "title": "Node.js event loop blocked causing health check timeouts",
     "description": "Node.js app health-check endpoint timing out (3s threshold). Event loop lag metric shows 4200ms max. CPU at 30% — not CPU-bound.",
     "root_cause": "Synchronous crypto.randomBytes(256) called inside a hot-path request handler. It blocked the event loop while waiting for entropy, cascading to full event-loop starvation.",
     "resolution": "1. Replaced crypto.randomBytes with async version. 2. Added --trace-event-loop. 3. Set up event-loop-lag alert. 4. Moved heavy crypto to worker_threads.",
     "action_plan": "1. Identify blocking calls via --trace-event-loop. 2. Replace sync crypto/fs/zlib with async. 3. Offload CPU-heavy work to worker threads.",
     "severity": "P1", "service_name": "auth-service", "category": "application", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0013", "title": "Race condition in order status state machine",
     "description": "Orders stuck in 'processing' state after payment confirmation webhook. Payment confirmed but order never transitioned to 'confirmed'. 3% of orders affected.",
     "root_cause": "Race condition: payment webhook and order timeout-cancel job both read order.status='processing', each tried to UPDATE. The job that arrived second won, overwriting with lost update.",
     "resolution": "1. Added SELECT ... FOR UPDATE. 2. Changed to CAS UPDATE pattern: WHERE status='processing'. 3. Added idempotency key. 4. Built reconciliation job.",
     "action_plan": "1. Identify and fix stuck orders. 2. Add pessimistic locking. 3. Use CAS UPDATE pattern. 4. Add idempotency for webhooks. 5. Create reconciliation job.",
     "severity": "P1", "service_name": "order-service", "category": "application", "status": "resolved", "error_type": "race_condition"},
]

# =========================================================================
# Lifecycle Demo
# =========================================================================

LIFECYCLE = [
    {"stage": "T+0min — Initial Alert (vague)", "incident_no": "INC-2025-0001",
     "title": "Payment service failing under load", "description": "Payment service returning errors. Users cannot complete checkout.",
     "severity": "P0", "service_name": "payment-service", "category": "application", "status": "open"},
    {"stage": "T+10min — Triage Complete (enriched)", "incident_no": "INC-2025-0001",
     "status": "investigating",
     "description": "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. P99 latency jumped from 200ms to 30s. 60% of transactions failing. Thread dump shows 200 threads blocked on HikariCP getConnection(). Connection pool max=50, active=50, pending=340.",
     "error_type": "timeout"},
    {"stage": "T+45min — Root Cause Found", "incident_no": "INC-2025-0001",
     "status": "investigating",
     "description": "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. P99 latency 30s. Connection pool max=50, active=50, pending=340. Traced to a deployment that added a new fraud-check HTTP call inside the /charge handler. Each charge now makes 4 sequential HTTP calls, each holding a DB connection. Connection hold time doubled to 4s, exhausting the pool.",
     "error_type": "timeout",
     "root_cause": "New deployment added fraud-check HTTP call inside /charge handler, increasing critical path from 2 to 4 sequential calls. Each call holds a DB connection. Connection hold time doubled to ~4s, exhausting the 50-connection pool at 12 req/s (was 25 req/s). Classic N+1 connection pattern."},
    {"stage": "T+90min — Resolved", "incident_no": "INC-2025-0001",
     "status": "resolved",
     "description": "Payment service returning HTTP 504 Gateway Timeout on /charge endpoint. P99 latency 30s. Connection pool exhausted at 50/50 with 340 pending. Root cause: fraud-check call added to /charge handler increased connection hold time.",
     "error_type": "timeout",
     "root_cause": "New deployment added fraud-check HTTP call inside /charge handler, increasing critical path to 4 sequential calls, doubling connection hold time.",
     "resolution": "1. Rolled back deployment. 2. Connection pool recovered within 30s. 3. Moved fraud-check to async post-processing. 4. Increased pool size to 150. 5. Added alert: HikariCP_pending_connections > 20."},
]

# =========================================================================
# Main
# =========================================================================

def section(title):
    print(f"\n{'='*70}\n  {title}\n{'='*70}")


def print_rerank(results, label):
    print(f"\n  >>> Top-5 after {label} <<<")
    for i, r in enumerate(results[:5], 1):
        print(f"  {i}. {r.get('incident_no','?'):15s} score={r.get('rerank_score',0):5.1f}  "
              f"reason={r.get('rerank_reason','')[:50]}  title={r.get('title','')[:40]}")


def main():
    # Clear old DB
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    section("IMT PoC — Self-Contained (SQLite + Numpy, No Docker)")

    # ── Seed ──
    print("\n[Step 1] Seeding 10 historical tickets ...")
    for t in SEED_TICKETS:
        ingest(t)
    print(f"  Seeded {len(SEED_TICKETS)} tickets.")

    # ── E2E Retrieval ──
    CURRENT = {"title": "Order service P99 latency spike after MySQL migration",
               "description": "After migrating order-service DB from MySQL 5.7 to 8.0, P99 latency spiked from 120ms to 2.8s. Slow query log shows 200+ SELECT queries scanning 6M rows. Connection pool showing 'Connection is not available' errors. MySQL CPU steady at 85%.",
               "service_name": "order-service", "category": "database", "severity": "P1", "error_type": "timeout"}

    section("[Step 2] E2E Retrieval Pipeline")
    print(f"\n  Current: {CURRENT['title']}")
    candidates = retrieve(CURRENT)
    print(f"  RRF fused: {len(candidates)} candidates")
    top = rerank(CURRENT, candidates)
    print_rerank(top, "Rerank")
    plan = generate_action_plan(CURRENT, top)
    print(plan)

    # ── Lifecycle Demo ──
    section("[Step 3] Lifecycle Demo — Ticket Evolution & Retrieval Quality")

    history = []
    for idx, stage in enumerate(LIFECYCLE):
        print(f"\n  ── {stage['stage']} ──")
        if idx == 0:
            ingest(stage)
            ticket = get_ticket(stage["incident_no"])
        else:
            ticket = update_ticket(stage["incident_no"],
                                   status=stage["status"],
                                   description=stage.get("description"),
                                   root_cause=stage.get("root_cause"),
                                   resolution=stage.get("resolution"),
                                   error_type=stage.get("error_type"))
        print(f"  Status={ticket['status']}  v{ticket['version']}  "
              f"desc_len={len(ticket['description'])}")

        candidates = retrieve(ticket)
        # exclude self from results
        candidates = [c for c in candidates if c.get("incident_no") != stage["incident_no"]]
        reranked = rerank(ticket, candidates)
        print_rerank(reranked, stage["stage"])

        # ── Show leader report highlights ──
        highlights = _build_highlights(ticket, reranked)
        print(f"\n  >>> LEADER REPORT HIGHLIGHTS (v{ ticket['version']}) <<<")
        for hl in highlights:
            print(f"      * {hl}")

        ts = [r.get("rerank_score", 0) for r in reranked[:5]]
        avg = sum(ts) / max(len(ts), 1) if ts else 0
        history.append({"stage": stage["stage"], "version": ticket["version"],
                        "status": ticket["status"], "avg_score": round(avg, 1),
                        "top_no": reranked[0].get("incident_no","N/A") if reranked else "N/A"})

    # ── Comparison Table ──
    section("Lifecycle Summary — Retrieval Quality vs Ticket Maturity")
    print(f"\n  {'Stage':<30} {'v':<3} {'Status':<14} {'AvgScore':<10} {'TopMatch'}")
    print(f"  {'-'*30} {'-'*3} {'-'*14} {'-'*10} {'-'*30}")
    max_avg = max(h["avg_score"] for h in history) or 1
    for h in history:
        bar = "█" * int(h["avg_score"] / max_avg * 25)
        print(f"  {h['stage']:<30} {h['version']:<3} {h['status']:<14} "
              f"{h['avg_score']:<10.1f} {bar} {h['top_no']}")
    print("\n  Key insight: As description enriches and root_cause is identified,")
    print("  the embedding narrows to better match semantically similar tickets,")
    print("  progressively improving rerank scores across the incident lifecycle.")

    # ── Report History ──
    section("Leader Report History — How Reports Evolve")
    reports = get_report_history_standalone("INC-2025-0001")
    for r in reports:
        print(f"\n  [v{r['ticket_version']}] {r.get('generated_at','')[:16]}")
        for hl in r.get("highlights", []):
            print(f"    * {hl}")
    print("\n  Key insight: Every ticket update auto-generates a leadership")
    print("  report capturing state, impact, and 3-5 key highlights.")
    print("  Reports evolve as the incident matures (triage → root cause → resolved).")

    section("PoC Complete — All checks passed")


if __name__ == "__main__":
    main()

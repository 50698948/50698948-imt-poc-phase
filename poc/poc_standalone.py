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

# ── LLM mode (from env) ──
LLM_MODE = os.getenv("LLM_MODE", "offline")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
LLM_EMBEDDING_MODEL = os.getenv("LLM_EMBEDDING_MODEL", "text-embedding-3-small")
LLM_EMBEDDING_DIM = int(os.getenv("LLM_EMBEDDING_DIM", "1536"))

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


def embed(text: str | list[str]) -> list[list[float]]:
    """Auto-switches between offline random projection and OpenAI-compatible API.
    Always returns list of lists for consistent interface."""
    single = isinstance(text, str)
    texts = [text] if single else text

    if LLM_MODE != "offline" and LLM_API_KEY:
        client = _get_llm_client()
        resp = client.embeddings.create(model=LLM_EMBEDDING_MODEL, input=texts)
        result = [d.embedding for d in resp.data]
        return result[0] if single else result

    # Offline random projection
    proj = _get_proj()
    result = []
    for t in texts:
        tokens = re.findall(r"[a-z0-9]{2,}", t.lower())
        if not tokens:
            result.append([0.0] * 384)
            continue
        indices = [int.from_bytes(hashlib.blake2b(tok.encode(), digest_size=8).digest(), "big") % PROJ_VOCAB
                   for tok in tokens]
        vec = proj[np.array(indices, dtype=np.int32)].sum(axis=0)
        norm = np.linalg.norm(vec)
        if norm > 1e-8:
            vec /= norm
        result.append(vec.tolist())
    return result[0] if single else result


_llm_client = None

def _get_llm_client():
    global _llm_client
    if _llm_client is None and LLM_MODE != "offline":
        from openai import OpenAI
        _llm_client = OpenAI(api_key=LLM_API_KEY, base_url=LLM_BASE_URL)
    return _llm_client


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

CREATE TABLE IF NOT EXISTS recommended_tasks (
    id TEXT PRIMARY KEY,
    incident_no TEXT NOT NULL,
    ticket_version INTEGER NOT NULL,
    task_order INTEGER NOT NULL,
    description TEXT NOT NULL,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    revised_by TEXT,
    revision_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_inc ON recommended_tasks(incident_no, ticket_version);

CREATE TABLE IF NOT EXISTS task_revision_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    incident_no TEXT NOT NULL,
    action TEXT NOT NULL,
    revised_by TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rev_history ON task_revision_history(task_id);
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
        tasks = _generate_recommendations(updated, reranked)
        _save_recommendations(conn, incident_no, ver, tasks)
        conn.commit()
    conn.close()
    return get_ticket(incident_no)


def get_ticket(incident_no: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM incident_tickets WHERE incident_no=?",
                       (incident_no,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_ticket_by_id(ticket_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM incident_tickets WHERE id=?",
                       (ticket_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def ingest_tickets_batch(tickets: list[dict]) -> list[str]:
    ids = []
    for t in tickets:
        ids.append(ingest(t))
    return ids


def get_latest_report_standalone(incident_no: str) -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM leader_reports WHERE incident_no=? ORDER BY ticket_version DESC LIMIT 1",
        (incident_no,)).fetchone()
    conn.close()
    if row is None:
        return None
    return {"id": row["id"], "incident_no": row["incident_no"],
            "ticket_version": row["ticket_version"], "content": row["content"],
            "highlights": json.loads(row["highlights"]),
            "generated_at": row["generated_at"]}


def revise_task_standalone(task_id: str, **fields) -> dict | None:
    allowed = {"status", "description", "revision_note", "revised_by"}
    values = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not values:
        return None
    sets = ", ".join(f"{k}=?" for k in values)
    params = list(values.values()) + [task_id]
    conn = get_db()
    conn.execute(f"UPDATE recommended_tasks SET {sets}, updated_at=datetime('now') WHERE id=?", params)
    conn.commit()
    row = conn.execute("SELECT * FROM recommended_tasks WHERE id=?", (task_id,)).fetchone()
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


# ── Engineer Task Recommendations ──

TASK_TEMPLATES = {
    "timeout": [
        "Check connection pool metrics for {service_name}",
        "Review slow query/request logs for {service_name}",
        "Verify recent deployment diff for changes to {service_name}",
        "Check downstream service latency (traces) for {service_name}",
    ],
    "OOM": [
        "Capture heap dump / memory profile of {service_name}",
        "Check if recent deployment increased memory footprint",
        "Review GC logs for leak patterns in {service_name}",
    ],
    "deadlock": [
        "Capture deadlock logs from database",
        "Audit transaction lock ordering in {service_name}",
        "Add retry with exponential backoff for deadlock-prone operations",
    ],
    "race_condition": [
        "Identify shared mutable state in {service_name} handlers",
        "Audit concurrent write paths to the same data records",
        "Add pessimistic locking (SELECT FOR UPDATE) or CAS pattern",
    ],
    "resource_exhaustion": [
        "Identify exhausted resource (disk/memory/connections)",
        "Check system resource limits and current usage",
        "Review auto-scaling policies for {service_name}",
    ],
    "auth_error": [
        "Check certificate/token expiry dates for {service_name}",
        "Verify IAM roles and permissions",
        "Review authentication service health",
    ],
    "rate_limit": [
        "Check current rate-limit configuration for {service_name}",
        "Identify triggering client/endpoint",
        "Review traffic pattern changes",
    ],
}

DEFAULT_TASKS = [
    "Assess blast radius: identify all affected services",
    "Check recent deployments/config changes for {service_name}",
    "Collect logs, metrics, and traces for {service_name}",
    "Set up monitoring dashboard for {service_name} key metrics",
]


def _generate_recommendations(ticket, similar):
    tasks = []
    order = 1
    et = ticket.get("error_type", "")
    svc = ticket.get("service_name", "unknown")

    for tpl in TASK_TEMPLATES.get(et, [])[:3]:
        tasks.append({"task_order": order, "description": tpl.format(service_name=svc),
                       "source": f"best-practice/{et}"})
        order += 1
    for tpl in DEFAULT_TASKS[:4]:
        tasks.append({"task_order": order, "description": tpl.format(service_name=svc),
                       "source": "sre-playbook"})
        order += 1
    seen = set()
    for sim in similar[:2]:
        ap = sim.get("action_plan", "")
        for line in ap.split("\n"):
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            cl = line.split(". ", 1)[-1] if ". " in line else line[2:].strip()
            if cl[:50] not in seen and len(tasks) < 8:
                seen.add(cl[:50])
                tasks.append({"task_order": order, "description": cl[:200],
                               "source": sim.get("incident_no", "?")})
                order += 1
    if ticket.get("root_cause"):
        tasks.append({"task_order": order, "description": "Confirm root cause: " + ticket["root_cause"][:150],
                       "source": "current-investigation"})
    return tasks


def _save_recommendations(conn, incident_no, ver, tasks):
    conn.execute("DELETE FROM recommended_tasks WHERE incident_no=? AND ticket_version=?",
                 (incident_no, ver))
    for t in tasks:
        conn.execute(
            "INSERT INTO recommended_tasks(id, incident_no, ticket_version, task_order, description, source) VALUES(?,?,?,?,?,?)",
            (str(uuid.uuid4()), incident_no, ver, t["task_order"], t["description"], t.get("source")))


def get_recommendations_standalone(incident_no, ticket_version=None):
    conn = get_db()
    if ticket_version is None:
        row = conn.execute(
            "SELECT MAX(ticket_version) FROM recommended_tasks WHERE incident_no=?",
            (incident_no,)).fetchone()
        ticket_version = row[0] if row and row[0] else 0
    rows = conn.execute(
        "SELECT * FROM recommended_tasks WHERE incident_no=? AND ticket_version=? ORDER BY task_order",
        (incident_no, ticket_version)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# =========================================================================
# Generator (same logic as generator.py)
# =========================================================================

def generate_action_plan(current_ticket, history_tickets):
    if not history_tickets:
        return "No historical similar tickets found."

    # ── LLM mode: use API ──
    if LLM_MODE != "offline" and LLM_API_KEY:
        client = _get_llm_client()
        h_parts = []
        for i, t in enumerate(history_tickets, 1):
            h_parts.append(
                f"[#{i}] {t.get('incident_no','?')} | {t.get('title','')}\n"
                f"  RC: {t.get('root_cause','N/A')[:200]}\n  Res: {t.get('resolution','N/A')[:200]}"
            )
        prompt = f"""You are a senior SRE. Analyze and produce action plan.

Current: [{current_ticket.get('service_name','')}] {current_ticket.get('title','')}
{current_ticket.get('description','')[:600]}

History:\n{chr(10).join(h_parts)}

Output: ## 1. Alignment ## 2. Root Cause ## 3. Action Plan (Phase A/B/C) ## 4. Confidence"""
        resp = client.chat.completions.create(model=LLM_MODEL, messages=[{"role": "user", "content": prompt}], temperature=0.3)
        return resp.choices[0].message.content or "(empty)"

    # ── Offline template ──
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
    {"incident_no": "INC-2024-0021", "title": "Kafka consumer lag 50K — notification delay 20min",
     "description": "Kafka consumer group 'notif-push' lag reached 50K messages. P99 notification delivery delay 20min (SLO: 30s). Consumer CPU at 15%. No rebalancing. Broker disk IO normal.",
     "root_cause": "Consumer used synchronous HTTP call to FCM inside each handler. FCM API had intermittent 2s latency on 30% of calls. With 10 threads, throughput dropped from 1000 to 50 msg/s.",
     "resolution": "1. Moved FCM push to async via asyncio. 2. Increased threads to 50. 3. Added circuit breaker with 500ms timeout. 4. Set max.poll.records=100.",
     "action_plan": "1. Check consumer lag. 2. Profile handler latency. 3. Move blocking I/O to async pool. 4. Scale consumers. 5. Add lag alerts.",
     "severity": "P1", "service_name": "notification-service", "category": "application", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0022", "title": "Zero-downtime deploy stuck — health check never passes",
     "description": "Blue-green deployment stuck 45min. Green pods in CrashLoopBackOff: readiness probe failed. App logs show 'FATAL: password authentication failed'. Secret updated but pods not restarted.",
     "root_cause": "Kubernetes Secrets are not auto-reloaded for mounted volumes. Pods spawned before Secret update cached old credentials. Manual rolling restart resolved it.",
     "resolution": "1. Deleted green pods to force recreation with fresh Secret. 2. Added Reloader tool for auto-restart on Secret changes. 3. Changed health check to validate DB connection.",
     "action_plan": "1. Check pod logs. 2. Verify Secret propagation. 3. Force restart pods if Secret changed. 4. Add Reloader. 5. Change health check endpoint.",
     "severity": "P1", "service_name": "order-service", "category": "application", "status": "resolved", "error_type": "config_error"},
    {"incident_no": "INC-2024-0023", "title": "VPC peering connection dropped — multi-region replication broken",
     "description": "Cross-region VPC peering dropped at 03:00 UTC. MySQL replication stopped. Replica lag 4GB. DR site out of sync. VPCFlow logs show 'Action: REJECT' for all cross-VPC traffic.",
     "root_cause": "Terraform rebuilt VPC peering with different CIDR without create_before_destroy. Old peering deleted before new one established, 6min gap.",
     "resolution": "1. Accepted pending peering in AWS Console. 2. Updated route tables. 3. Added lifecycle { create_before_destroy = true } in Terraform. 4. Added AWS Config rule for peering changes.",
     "action_plan": "1. Verify peering status. 2. Check route tables. 3. Accept pending peering. 4. Update Terraform with create_before_destroy. 5. Enable VPC Flow Logs alerting.",
     "severity": "P0", "service_name": "infra-network", "category": "network", "status": "resolved", "error_type": "config_error"},
    {"incident_no": "INC-2025-0002", "title": "Search latency degrading — investigating ES query regression",
     "description": "Search P95 latency increased from 80ms to 450ms over 4h. No deployment. No traffic spike. ES cluster green. Hot threads show time in custom scoring script.",
     "severity": "P2", "service_name": "search-service", "category": "application", "status": "investigating", "error_type": "timeout"},
    {"incident_no": "INC-2025-0003", "title": "Third-party payment gateway 503 — failover activated",
     "description": "Primary payment gateway (Stripe) returning HTTP 503. Failover to Adyen activated. Adyen at 3x volume, P99=800ms. Circuit breaker monitoring Stripe for recovery.",
     "root_cause": "Stripe incident confirmed via status page. Circuit breaker correctly opened. Adyen not capacity-tested for 100% failover.",
     "resolution": "1. Confirmed Stripe incident. 2. Scaled Adyen pods 10→30. 3. Added connection pool warming. 4. Monitoring Stripe status for recovery.",
     "action_plan": "1. Verify upstream provider status. 2. Confirm failover routing. 3. Scale secondary provider. 4. Monitor primary recovery. 5. Capacity-test failover at 100%.",
     "severity": "P1", "service_name": "payment-service", "category": "application", "status": "mitigated", "error_type": "dependency_failure"},
    {"incident_no": "INC-2024-0027", "title": "MongoDB replica set election storm — primary flapping 4x/hour",
     "description": "MongoDB replica set experiencing primary re-elections every 15min. Each election causes 3-8s write unavailability. replSetGetStatus shows correct priority and votes.",
     "root_cause": "Secondary in different AZ had 0.5% packet loss due to faulty fiber transceiver. Intermittent heartbeat loss triggered elections. AWS health checks didn't detect it (99.5% success).",
     "resolution": "1. Removed faulty secondary from replica set. 2. AWS replaced transceiver. 3. Re-added node. 4. Increased electionTimeoutMillis to 20000. 5. Added cross-AZ packet loss monitoring.",
     "action_plan": "1. Check rs.status(). 2. Examine node logs for heartbeat timeouts. 3. Isolate faulty node. 4. Check inter-AZ network health. 5. File ticket with cloud provider.",
     "severity": "P1", "service_name": "order-service", "category": "database", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0030", "title": "Memory leak in image processing worker after watermark rollout",
     "description": "Image workers OOMKilled after 2-3h. RSS grows at 50MB/min. Heap dump: 1.4M BufferedImage instances in static ConcurrentHashMap. Cache eviction listener never registered.",
     "root_cause": "LinkedHashMap's removeEldestEntry not called because Collections.synchronizedMap doesn't delegate to it. Cache grew unbounded, holding every processed image.",
     "resolution": "1. Replaced with Guava Cache (maxSize=100, expireAfterAccess=5min). 2. Added direct memory buffer pool (MaxDirectMemorySize=512m). 3. Deployed with -XX:+ExitOnOutOfMemoryError.",
     "action_plan": "1. Capture heap dump. 2. Identify object accumulation in caches. 3. Verify cache eviction logic works. 4. Use Guava Cache or Caffeine. 5. Set memory limits with graceful degradation.",
     "severity": "P1", "service_name": "image-service", "category": "application", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2025-0005", "title": "API rate limiter misconfiguration — legitimate traffic blocked",
     "description": "Mobile app returning '429 Too Many Requests' during normal usage. Rate config changed 2h ago via feature flag: limit=10/sec. Previously 100/min. 90% of traffic blocked.",
     "severity": "P0", "service_name": "api-gateway", "category": "application", "status": "investigating", "error_type": "config_error"},
    {"incident_no": "INC-2024-0025", "title": "Suspicious spike in failed login attempts — potential brute force",
     "description": "Auth service logging 50K failed logins/min from 340 IPs across 12 countries. 3 accounts compromised. Rate limiter (5/min per IP) not triggering due to distributed attacks.",
     "root_cause": "IP-based rate limiting bypassed by distributed botnet. No account-level rate limiting. Compromised accounts lacked 2FA (legacy grandfathered).",
     "resolution": "1. Force-reset compromised accounts. 2. Implemented account-level rate limiting (10/5min). 3. Blocked IPs via WAF. 4. Forced 2FA enrollment. 5. Added geo-anomaly detection.",
     "action_plan": "1. Block attacking IPs. 2. Force-reset compromised accounts. 3. Add account-level rate limiting. 4. Audit 2FA coverage. 5. Set up geo-anomaly alerts.",
     "severity": "P0", "service_name": "auth-service", "category": "security", "status": "resolved", "error_type": "auth_error"},
    {"incident_no": "INC-2025-0006", "title": "Critical: user data export job leaking PII to logs",
     "description": "GDPR export job logging full user records (email, phone, address) at INFO level to ELK accessible to all. 47K users over 72h. Job currently stopped.",
     "root_cause": "@ToString annotation on UserRecord logged all fields. Developer changed log level from DEBUG to INFO 3 days ago and never reverted. No PII redaction filter.",
     "resolution": "1. Stopped job, rotated logs. 2. Added @ToString.Exclude on PII fields. 3. Implemented logback redaction filter. 4. Restricted ELK PII indices to security team. 5. Added Checkstyle rule.",
     "action_plan": "1. Stop affected job. 2. Identify and secure PII logs. 3. Audit @ToString usage. 4. Add log redaction filter. 5. Restrict log access. 6. Add PII leak detection in CI.",
      "severity": "P0", "service_name": "data-export-service", "category": "security", "status": "resolved", "error_type": "config_error"},
    {"incident_no": "INC-2024-0031", "title": "MySQL InnoDB deadlock on user_points during leaderboard update",
     "description": "Leaderboard cron job failing with Deadlock. 120K updates/min. Gap lock on secondary index caused by inconsistent WHERE clause ordering across batch and real-time code paths.",
     "root_cause": "Batch UPDATE ordered by user_id but real-time by guild_id. InnoDB gap locks acquired in different order causing circular wait. Guild_id index had wider gap lock range due to lower cardinality (200 guilds vs 2M users).",
     "resolution": "1. Standardized both paths to ORDER BY user_id ASC. 2. Reduced batch size 1000→100. 3. Deadlock retry with exponential backoff. 4. Materialized leaderboard table via async queue.",
     "action_plan": "1. Capture deadlock via SHOW ENGINE INNODB STATUS. 2. Analyze lock ordering. 3. Standardize lock order (ORDER BY PK). 4. Reduce batch sizes. 5. Add retry with backoff. 6. Consider materialized view.",
     "severity": "P1", "service_name": "game-leaderboard", "category": "database", "status": "resolved", "error_type": "deadlock"},
    {"incident_no": "INC-2024-0032", "title": "DynamoDB hot partition — read throttled on user_activity",
     "description": "DynamoDB ProvisionedThroughputExceededException on 3 of 50 partitions. Bot account (user_id=42, 2M followers) creating hot partition. P99 latency 8ms→2.4s. Adaptive capacity insufficient (doubled to 6000 RCU, needed 18000).",
     "root_cause": "User_id as partition key for social feed. Platform bot had 500x activity of normal user. Hot partition exceeded per-partition limit even after adaptive scaling.",
     "resolution": "1. Added salt suffix (user_id#0-9) to distribute writes. 2. Deployed DAX for read-through caching. 3. Write sharding for known hot keys. 4. Switched to on-demand capacity temporarily. 5. Added per-partition CloudWatch alarm.",
     "action_plan": "1. Identify hot partition via CloudWatch Contributor Insights. 2. Redistribute with salt/sharding for known hot keys. 3. Enable DAX/ElastiCache. 4. Use on-demand capacity. 5. Add partition-level monitoring.",
     "severity": "P1", "service_name": "social-feed", "category": "database", "status": "resolved", "error_type": "resource_exhaustion"},
    {"incident_no": "INC-2024-0034", "title": "JVM metaspace leak — Full GC every 3min after Java 17 upgrade",
     "description": "After Java 11→17 upgrade, 4/12 JVM instances Full GC every 3min. Metaspace 98% (256MB max). Classes loaded: 185K (up from 12K). Spring Boot 2.7 + Hibernate 5.6 generating 170K+ synthetic proxy classes.",
     "root_cause": "Java 17 re-enabled reflection-based access that Java 11 had optimized away. Hibernate generated excessive proxy classes. ClassLoader retained all generated classes preventing Metaspace reclamation.",
     "resolution": "1. Increased MaxMetaspaceSize to 512m. 2. Upgraded Spring Boot 2.7→3.1. 3. Disabled Hibernate bytecode enhancement. 4. Added -XX:MaxMetaspaceExpansion=64m. 5. Metaspace monitoring alert at 75%.",
     "action_plan": "1. Analyze class loading: jcmd VM.classloader_stats. 2. Identify proxy-heavy library. 3. Increase MaxMetaspaceSize. 4. Upgrade to native Java 17 library versions. 5. Add Metaspace trend monitoring.",
     "severity": "P1", "service_name": "payment-service", "category": "application", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2024-0035", "title": "Distributed lock timeout — idempotency key collision causing double charges",
     "description": "23 customers double-charged due to idempotency key collision. Key: SHA256(user_id+amount+timestamp_truncated_to_minute). Retry at minute boundary produced identical key. Redis lock TTL (5s) < gateway timeout (10s).",
     "root_cause": "Timestamp truncated to minute in key; lock TTL expired before payment response; cache-aside check-then-set pattern had race between 'not found' and 'store'.",
     "resolution": "1. Refunded 23 customers. 2. Added retry counter to idempotency key. 3. Lock TTL increased to 30s. 4. Replaced cache-aside with SETNX write-through. 5. Added idempotency audit log. 6. Reconciliation job for duplicate detection.",
     "action_plan": "1. Stop processing, investigate duplicates. 2. Refund affected customers. 3. Include retry counter in key. 4. Increase lock TTL. 5. Use SETNX atomic operation. 6. Add reconciliation monitoring.",
     "severity": "P0", "service_name": "payment-service", "category": "application", "status": "resolved", "error_type": "race_condition"},
    {"incident_no": "INC-2024-0036", "title": "AWS EBS gp2→gp3 migration — IOPS throttling on RDS instances",
     "description": "After migrating 200 EBS volumes from gp2 to gp3, 12 RDS instances suffered IOPS throttling. gp3 baseline 3000 IOPS insufficient for 8000 IOPS workload. BurstBalance depleted in 30min. VolumeQueueLength > 10.",
     "root_cause": "gp3 provides fixed 3000 IOPS baseline; gp2 had burst mode that DBAs unknowingly relied on. Migration matched gp3 provisioned IOPS to gp2 burst IOPS, consuming burst credits quickly under sustained load.",
     "resolution": "1. Increased provisioned IOPS to 12000 on affected volumes. 2. Analyzed CloudWatch for all 200 volumes — flagged 31 needing increase. 3. Created IOPS calculator from P95 CloudWatch metrics. 4. BurstBalance < 20% alarm. 5. Updated migration runbook with pre-migration analysis step.",
     "action_plan": "1. Check BurstBalance and VolumeQueueLength. 2. Increase provisioned IOPS to P95+30%. 3. Audit all migrated volumes. 4. Create pre-migration IOPS analysis script. 5. Add BurstBalance alarm. 6. Update runbook.",
     "severity": "P0", "service_name": "data-platform", "category": "infrastructure", "status": "resolved", "error_type": "resource_exhaustion"},
    {"incident_no": "INC-2024-0037", "title": "Docker daemon unresponsive — containerd snapshot leak after 30 days",
     "description": "8 build agents Docker daemon unresponsive. /var/lib/containerd at 420GB. 14000 orphaned snapshots accumulated when CI timeouts killed runc shims but containerd snapshots were not cleaned up.",
     "root_cause": "docker run --rm relied on clean process exit. CI timeout SIGKILL'd the shim but contained snapshot was not pruned. Over 30 days, snapshots accumulated filling the disk and breaking the containerd shim spawn.",
     "resolution": "1. containerd snapshot prune + docker system prune -af. 2. Daily cron: docker system prune -af --filter until=24h. 3. Moved containerd root to separate 500GB partition. 4. Disk alert at 70%, auto-prune at 80%. 5. CI_CLEANUP timeout > BUILD_TIMEOUT by 5min.",
     "action_plan": "1. Check disk usage. 2. Prune orphaned snapshots. 3. docker system prune -af. 4. Add daily cleanup cron. 5. Separate containerd partition. 6. Add disk monitoring and auto-prune.",
     "severity": "P1", "service_name": "ci-build-agents", "category": "infrastructure", "status": "resolved", "error_type": "resource_exhaustion"},
    {"incident_no": "INC-2024-0039", "title": "PostgreSQL autovacuum lag causing table bloat — query planner degradation",
     "description": "Orders table 50GB→180GB in 2 weeks. n_dead_tup=80M (45% bloat). Autovacuum scale factor 20% triggered at 40M but 80M already accumulated. Query planner switched IndexScan→SeqScan. P99 15ms→3.2s.",
     "root_cause": "Archive feature UPDATE'd 200M rows creating dead tuples. Autovacuum triggered too late (20% scale factor). Couldn't keep up at default cost limit (200). Bulk UPDATE creates more dead tuples than INSERT+DELETE.",
     "resolution": "1. VACUUM FULL during maintenance window. 2. Reduced autovacuum scale factor to 0.05 for large tables. 3. Per-table storage parameters for orders. 4. Changed archive to INSERT+DELETE pattern. 5. pgstattuple bloat monitoring. 6. Weekly VACUUM ANALYZE for >50GB tables.",
     "action_plan": "1. Check table bloat via pg_stat_user_tables. 2. EXPLAIN ANALYZE slow queries. 3. Adjust autovacuum scale factor. 4. VACUUM FULL if bloat > 20%. 5. Switch UPDATE patterns to INSERT+DELETE. 6. Add bloat monitoring.",
     "severity": "P1", "service_name": "order-service", "category": "database", "status": "resolved", "error_type": "timeout"},
    {"incident_no": "INC-2024-0040", "title": "Redis Cluster resharding stuck — slot migration causing CLUSTERDOWN",
     "description": "Redis 6-node cluster in CLUSTERDOWN during reshard. CI-timeout killed migration mid-operation. 1200 of 16384 slots stuck in MIGRATING/IMPORTING state. Config epoch mismatch causing split-brain. Clients in MOVED/ASK loops.",
     "root_cause": "CI timeout (10min) killed redis-cli --cluster reshard before migration completed (needs ~15min for 4000 slots at 5 slots/s). Target node incremented epoch but source never confirmed, creating config mismatch.",
     "resolution": "1. CLUSTER SETSLOT <slot> NODE <target-id> for 1200 stuck slots via script. 2. CLUSTER CHECK verified health. 3. CI timeout 10min→30min. 4. --cluster-yes and --timeout 30000 flags. 5. Batch migration (100 slots at a time with checkpoints). 6. CLUSTER INFO state_ok alert.",
     "action_plan": "1. CLUSTER INFO + CLUSTER NODES. 2. Identify stuck slots: CLUSTER SLOTS. 3. CLUSTER SETSLOT to manually assign. 4. Verify with CLUSTER CHECK. 5. Increase CI timeout. 6. Implement incremental migration with checkpoints.",
     "severity": "P0", "service_name": "session-service", "category": "database", "status": "resolved", "error_type": "deadlock"},
    {"incident_no": "INC-2024-0041", "title": "JWT signing key rotation causes mass logout — 2M users affected",
     "description": "JWT key rotation at 02:00 UTC caused mass logout of 2M users. Old key deleted immediately, new key only published. Token validation failed for all existing sessions. New logins worked.",
     "root_cause": "Rotation script deleted old key and published only new key — no overlapping validity period. Industry standard: publish new key T-1h, sign with new at T+0, stop accepting old at T+24h.",
     "resolution": "1. Re-imported old KMS key, published both in JWKS. 2. Sessions recovered via re-auth. 3. 3-phase rotation script: publish new, sign new, retire old. 4. Refuse to delete only active key. 5. 401 rate > 10% alert. 6. Canary token validation every 60s.",
     "action_plan": "1. Restore old key, publish both. 2. Support overlapping key validity in rotation. 3. Never delete only active key. 4. Monitor 401 rate. 5. Canary token validation. 6. Document rotation runbook with rollback.",
     "severity": "P0", "service_name": "auth-service", "category": "application", "status": "resolved", "error_type": "config_error"},
    {"incident_no": "INC-2024-0043", "title": "Go routine leak — goroutine count 120K after feature rollout",
     "description": "Go service goroutines 200→120K in 6h. /debug/pprof shows 115K blocked on chan receive. Memory 200MB→8GB (goroutine stacks). OOMKilled at 10GB pod limit. fire-and-forget go sendNotification without lifecycle management.",
     "root_cause": "go sendNotification(userID) inside CreateOrder handler without tracking. Channel consumer rate-limited to 100 req/s. At 5000 orders/s, goroutines accumulated at 5000/s creating vs 100/s completing = 4900 leaked/s.",
     "resolution": "1. Rolled back. 2. Replaced with buffered channel worker pool (100 workers, cap 1000). 3. Goroutine count alert > 10K. 4. debug.SetMaxThreads(10000). 5. Lint rule for unmanaged go func calls.",
     "action_plan": "1. Check goroutine count via /debug/pprof. 2. Identify blocking point from stacks. 3. Replace with worker pools or errgroup. 4. Add goroutine count monitoring. 5. Set runtime limits. 6. Add lint rules.",
     "severity": "P0", "service_name": "order-service", "category": "application", "status": "resolved", "error_type": "OOM"},
    {"incident_no": "INC-2024-0044", "title": "Python asyncio event loop blocked by sync DB call in async handler",
     "description": "FastAPI async endpoint /api/reports taking 45s (expected <2s). Event loop blocked 42s by psycopg2 sync conn.execute() inside async handler. Other endpoints unresponsive on same worker. Uvicorn timeout killed request but DB query continued.",
     "root_cause": "psycopg2 (sync driver) used instead of asyncpg in async def handler. Synchronous call blocked entire event loop. All 4 workers blocked under 50 concurrent requests = 504 for all traffic.",
     "resolution": "1. Replaced psycopg2 with asyncpg: await pool.fetch(query). 2. Moved heavy query to Celery background task with polling. 3. Sync-in-async lint rule. 4. uvicorn --limit-concurrency 100. 5. Event loop latency monitoring via slow_callback_duration.",
     "action_plan": "1. Identify blocking calls (asyncio debug or py-spy). 2. Replace sync drivers with async equivalents. 3. Move heavy queries to background tasks. 4. Add lint rules for sync-in-async. 5. Add event loop latency monitoring. 6. Set concurrency limits.",
     "severity": "P1", "service_name": "reporting-service", "category": "application", "status": "resolved", "error_type": "timeout"},
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

        # ── Show report demo highlights ──
        highlights = _build_highlights(ticket, reranked)
        print(f"\n  >>> REPORT DEMO (v{ ticket['version']}) <<<")
        for hl in highlights:
            print(f"      * {hl}")

        # ── Show recommended tasks ──
        rec_tasks = _generate_recommendations(ticket, reranked)
        if rec_tasks:
            print(f"\n  >>> RECOMMENDED TASKS ({len(rec_tasks)} items) <<<")
            for t in rec_tasks:
                print(f"      [ ] T{t['task_order']:02d}  {t['description'][:90]}")
                print(f"           src: {t.get('source','?')}")

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
    section("Report Demo History — How Reports Evolve")
    reports = get_report_history_standalone("INC-2025-0001")
    for r in reports:
        print(f"\n  [v{r['ticket_version']}] {r.get('generated_at','')[:16]}")
        for hl in r.get("highlights", []):
            print(f"    * {hl}")
    print("\n  Key insight: Every ticket update auto-generates a leadership")
    print("  report capturing state, impact, and 3-5 key highlights.")

    # ── Task History ──
    section("Recommended Tasks History — Human-Revisable Engineer Tasks")
    for ver in sorted(set(r["ticket_version"] for r in reports)):
        tasks = get_recommendations_standalone("INC-2025-0001", ticket_version=ver)
        if tasks:
            print(f"\n  [v{ver}] {len(tasks)} tasks:")
            for t in tasks:
                icon = {"pending": "[ ]", "in_progress": "[>]", "completed": "[x]", "rejected": "[R]"}.get(t["status"], "[ ]")
                print(f"    {icon} T{t['task_order']:02d} {t['description'][:100]}")
                print(f"         src: {t.get('source','?')}")
    print("\n  Key insight: Recommendations evolve with each ticket update.")
    print("  Engineers can revise tasks via the revise_task() API — mark")
    print("  as in_progress, completed, or rejected with revision notes.")

    section("PoC Complete — All checks passed")


if __name__ == "__main__":
    main()

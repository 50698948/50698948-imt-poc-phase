"""
Database operations: ingestion, search, and utility queries.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text

from config import VECTOR_TOPK, FTS_TOPK, STRUCT_TOPK
from embedding import embed
from models import IncidentTicket, LeaderReport, RecommendedTask, get_session


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------

def ingest_ticket(
    *,
    incident_no: str,
    title: str,
    description: str,
    severity: str,
    service_name: str,
    category: str,
    status: str = "open",
    error_type: str | None = None,
    keywords: list[str] | None = None,
    root_cause: str | None = None,
    resolution: str | None = None,
    action_plan: str | None = None,
) -> uuid.UUID:
    """Insert a single ticket, computing its embedding vectors on the fly."""
    embedding_desc = embed(title + " " + description)[0]

    embedding_rc = None
    if root_cause and resolution:
        embedding_rc = embed(root_cause + " " + resolution)[0]

    resolved_at = datetime.now(timezone.utc) if status == "resolved" else None

    ticket = IncidentTicket(
        incident_no=incident_no,
        title=title,
        description=description,
        severity=severity,
        service_name=service_name,
        category=category,
        status=status,
        error_type=error_type,
        keywords=keywords or [],
        root_cause=root_cause,
        resolution=resolution,
        action_plan=action_plan,
        embedding_description=embedding_desc,
        embedding_root_cause=embedding_rc,
        resolved_at=resolved_at,
    )

    with get_session() as s, s.begin():
        s.add(ticket)
        return ticket.id


def ingest_tickets_batch(tickets: list[dict]) -> list[uuid.UUID]:
    """Batch-insert multiple tickets. Generates embeddings in one API call
    for descriptions and (if present) root_cause+resolution respectively."""

    desc_texts = [t["title"] + " " + t["description"] for t in tickets]
    desc_vectors = embed(desc_texts)

    rc_texts: list[str | None] = []
    for t in tickets:
        if t.get("root_cause") and t.get("resolution"):
            rc_texts.append(t["root_cause"] + " " + t["resolution"])
        else:
            rc_texts.append(None)

    rc_indices = [i for i, v in enumerate(rc_texts) if v is not None]
    if rc_indices:
        rc_vectors_raw = embed([rc_texts[i] for i in rc_indices])  # type: ignore
    rc_vectors = [None] * len(tickets)
    for idx, vec in zip(rc_indices, rc_vectors_raw if rc_indices else []):
        rc_vectors[idx] = vec

    ids: list[uuid.UUID] = []
    with get_session() as s, s.begin():
        for i, t in enumerate(tickets):
            resolved_at = (
                datetime.now(timezone.utc)
                if t.get("status") == "resolved"
                else None
            )
            ticket = IncidentTicket(
                incident_no=t.get("incident_no", ""),
                title=t["title"],
                description=t["description"],
                severity=t["severity"],
                service_name=t["service_name"],
                category=t["category"],
                status=t.get("status", "open"),
                error_type=t.get("error_type"),
                keywords=t.get("keywords", []),
                root_cause=t.get("root_cause"),
                resolution=t.get("resolution"),
                action_plan=t.get("action_plan"),
                embedding_description=desc_vectors[i],
                embedding_root_cause=rc_vectors[i],
                resolved_at=resolved_at,
            )
            s.add(ticket)
            s.flush()
            ids.append(ticket.id)
    return ids


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_by_vector(
    query_text: str,
    limit: int = VECTOR_TOPK,
) -> list[dict]:
    """Cosine-similarity search via pgvector."""
    query_vec = embed(query_text)[0]
    vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"

    sql = text("""
        SELECT id, incident_no, title, description, root_cause, resolution, action_plan,
               severity, service_name, category, status, error_type,
               1 - (embedding_description <=> :vec) AS similarity
        FROM incident_tickets
        WHERE embedding_description IS NOT NULL
        ORDER BY embedding_description <=> :vec
        LIMIT :lim
    """)
    with get_session() as s:
        rows = s.execute(sql, {"vec": vec_str, "lim": limit}).mappings().all()
    return [_row_to_dict(r) for r in rows]


def search_by_fts(query_text: str, limit: int = FTS_TOPK) -> list[dict]:
    """PostgreSQL full-text search with plainto_tsquery."""
    sql = text("""
        SELECT id, incident_no, title, description, root_cause, resolution, action_plan,
               severity, service_name, category, status, error_type,
               ts_rank(
                   to_tsvector('english',
                       coalesce(title,'') || ' ' ||
                       coalesce(description,'') || ' ' ||
                       coalesce(root_cause,'') || ' ' ||
                       coalesce(resolution,'')
                   ),
                   plainto_tsquery('english', :q)
               ) AS rank
        FROM incident_tickets
        WHERE to_tsvector('english',
                   coalesce(title,'') || ' ' ||
                   coalesce(description,'') || ' ' ||
                   coalesce(root_cause,'') || ' ' ||
                   coalesce(resolution,'')
              ) @@ plainto_tsquery('english', :q)
        ORDER BY rank DESC
        LIMIT :lim
    """)
    with get_session() as s:
        rows = s.execute(sql, {"q": query_text, "lim": limit}).mappings().all()
    out = []
    for r in rows:
        d = _row_to_dict(r)
        d["similarity"] = float(r.get("rank", 0))
        out.append(d)
    return out


def search_by_structure(
    *,
    service_name: str,
    category: str,
    severity: str,
    error_type: str | None = None,
    limit: int = STRUCT_TOPK,
) -> list[dict]:
    """Structured exact/fuzzy match."""
    sql = text("""
        SELECT id, incident_no, title, description, root_cause, resolution, action_plan,
               severity, service_name, category, status, error_type,
               1.0 AS similarity
        FROM incident_tickets
        WHERE service_name = :svc
          AND category     = :cat
          AND status       = 'resolved'
          AND (
              severity = :sev
              OR severity IN (
                  CASE :sev
                    WHEN 'P0' THEN 'P1'
                    WHEN 'P1' THEN 'P2'
                    ELSE NULL
                  END
              )
          )
    """)
    params = {
        "svc": service_name,
        "cat": category,
        "sev": severity,
    }

    if error_type:
        sql = text(sql.text + "\n  AND error_type = :etyp")
        params["etyp"] = error_type

    sql = text(sql.text + """
        ORDER BY
            CASE severity
                WHEN :sev THEN 0
                ELSE 1
            END,
            created_at DESC
        LIMIT :lim
    """)
    params["lim"] = limit

    with get_session() as s:
        rows = s.execute(sql, params).mappings().all()
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row) -> dict:
    return {
        "id": str(row["id"]),
        "incident_no": row["incident_no"],
        "title": row["title"],
        "description": row["description"],
        "root_cause": row.get("root_cause"),
        "resolution": row.get("resolution"),
        "action_plan": row.get("action_plan"),
        "severity": row["severity"],
        "service_name": row["service_name"],
        "category": row["category"],
        "status": row["status"],
        "error_type": row.get("error_type"),
        "similarity": float(row.get("similarity", 0)),
    }


def get_ticket_by_id(ticket_id: str) -> dict | None:
    with get_session() as s:
        ticket = s.get(IncidentTicket, uuid.UUID(ticket_id))
        if ticket is None:
            return None
        return _ticket_to_dict(ticket)


def get_ticket_by_incident_no(incident_no: str) -> dict | None:
    """Lookup a ticket by its human-readable incident number (e.g. INC-2024-0001)."""
    from sqlalchemy import select
    with get_session() as s:
        stmt = select(IncidentTicket).where(IncidentTicket.incident_no == incident_no)
        ticket = s.execute(stmt).scalar_one_or_none()
        if ticket is None:
            return None
        return _ticket_to_dict(ticket)


def _ticket_to_dict(t: IncidentTicket) -> dict:
    return {
        "id": str(t.id),
        "incident_no": t.incident_no,
        "title": t.title,
        "description": t.description,
        "root_cause": t.root_cause,
        "resolution": t.resolution,
        "action_plan": t.action_plan,
        "severity": t.severity,
        "service_name": t.service_name,
        "category": t.category,
        "status": t.status,
        "error_type": t.error_type,
        "version": t.version,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "similarity": 0.0,
    }


# ---------------------------------------------------------------------------
# Update (lifecycle) — re-embed on semantic content change
# ---------------------------------------------------------------------------

def update_ticket_description(incident_no: str, new_description: str) -> dict | None:
    """Update ticket description and regenerate its embedding.

    Returns the updated ticket dict, or None if not found.
    """
    from sqlalchemy import update as sa_update
    with get_session() as s, s.begin():
        stmt = (
            sa_update(IncidentTicket)
            .where(IncidentTicket.incident_no == incident_no)
            .values(
                description=new_description,
                embedding_description=embed(
                    _get_ticket_title(s, incident_no) + " " + new_description
                )[0],
                version=IncidentTicket.version + 1,
            )
        )
        s.execute(stmt)
    return get_ticket_by_incident_no(incident_no)


def update_ticket_root_cause(incident_no: str, root_cause: str) -> dict | None:
    """Update root_cause and re-embed root_cause+resolution vector."""
    from sqlalchemy import update as sa_update, select
    with get_session() as s, s.begin():
        ticket = s.execute(
            select(IncidentTicket).where(IncidentTicket.incident_no == incident_no)
        ).scalar_one_or_none()
        if ticket is None:
            return None

        resolution = ticket.resolution or ""
        rc_vec = embed(root_cause + " " + resolution)[0]

        stmt = (
            sa_update(IncidentTicket)
            .where(IncidentTicket.incident_no == incident_no)
            .values(
                root_cause=root_cause,
                embedding_root_cause=rc_vec,
                version=IncidentTicket.version + 1,
            )
        )
        s.execute(stmt)
    return get_ticket_by_incident_no(incident_no)


def update_ticket_resolution(incident_no: str, resolution: str) -> dict | None:
    """Update resolution and re-embed root_cause+resolution vector."""
    from sqlalchemy import update as sa_update, select
    with get_session() as s, s.begin():
        ticket = s.execute(
            select(IncidentTicket).where(IncidentTicket.incident_no == incident_no)
        ).scalar_one_or_none()
        if ticket is None:
            return None

        root_cause = ticket.root_cause or ""
        rc_vec = embed(root_cause + " " + resolution)[0]

        stmt = (
            sa_update(IncidentTicket)
            .where(IncidentTicket.incident_no == incident_no)
            .values(
                resolution=resolution,
                embedding_root_cause=rc_vec,
                version=IncidentTicket.version + 1,
            )
        )
        s.execute(stmt)
    return get_ticket_by_incident_no(incident_no)


def update_ticket_status(
    incident_no: str,
    new_status: str,
    *,
    description: str | None = None,
    root_cause: str | None = None,
    resolution: str | None = None,
    severity: str | None = None,
    error_type: str | None = None,
) -> dict | None:
    """Transition ticket status and optionally update related fields.

    Re-embeds description if provided.  Re-embeds root_cause if root_cause
    or resolution changes.
    """
    from sqlalchemy import update as sa_update, select
    with get_session() as s, s.begin():
        ticket = s.execute(
            select(IncidentTicket).where(IncidentTicket.incident_no == incident_no)
        ).scalar_one_or_none()
        if ticket is None:
            return None

        values: dict = {"status": new_status, "version": ticket.version + 1}

        if description is not None:
            values["description"] = description
            values["embedding_description"] = embed(
                ticket.title + " " + description
            )[0]

        rc = root_cause if root_cause is not None else ticket.root_cause
        res = resolution if resolution is not None else ticket.resolution
        if root_cause is not None or resolution is not None:
            values["embedding_root_cause"] = embed(
                (rc or "") + " " + (res or "")
            )[0]

        if root_cause is not None:
            values["root_cause"] = root_cause
        if resolution is not None:
            values["resolution"] = resolution
        if severity is not None:
            values["severity"] = severity
        if error_type is not None:
            values["error_type"] = error_type

        if new_status == "resolved" and ticket.resolved_at is None:
            values["resolved_at"] = datetime.now(timezone.utc)

        stmt = (
            sa_update(IncidentTicket)
            .where(IncidentTicket.incident_no == incident_no)
            .values(**values)
        )
        s.execute(stmt)

    # ── Auto-generate leader report + recommendations after every status update ──
    updated = get_ticket_by_incident_no(incident_no)
    if updated:
        from leader_report import generate_leader_report, extract_highlights
        from recommend import generate_recommendations
        from retrieval import retrieve as _retrieve
        from reranker import rerank as _rerank
        _candidates = _retrieve(updated)
        _candidates = [c for c in _candidates if c.get("incident_no") != incident_no]
        _reranked = _rerank(updated, _candidates)
        _content = generate_leader_report(updated, _reranked)
        _hl = extract_highlights(updated, _reranked)
        save_leader_report(incident_no, updated["version"], _content, _hl)
        _tasks = generate_recommendations(updated, _reranked)
        save_recommendations(incident_no, updated["version"], _tasks)

    return updated


def _get_ticket_title(session, incident_no: str) -> str:
    from sqlalchemy import select
    row = session.execute(
        select(IncidentTicket.title).where(IncidentTicket.incident_no == incident_no)
    ).scalar()
    return row or ""


# ---------------------------------------------------------------------------
# Leader Reports
# ---------------------------------------------------------------------------

def save_leader_report(incident_no: str, ticket_version: int,
                       content: str, highlights: list[str]) -> uuid.UUID:
    """Persist a leader report for the given ticket version."""
    report = LeaderReport(
        incident_no=incident_no,
        ticket_version=ticket_version,
        content=content,
        highlights=highlights,
    )
    with get_session() as s, s.begin():
        s.add(report)
        s.flush()
        return report.id


def get_latest_report(incident_no: str) -> dict | None:
    """Return the most recent leader report for a ticket."""
    from sqlalchemy import select
    with get_session() as s:
        stmt = (
            select(LeaderReport)
            .where(LeaderReport.incident_no == incident_no)
            .order_by(LeaderReport.ticket_version.desc())
            .limit(1)
        )
        r = s.execute(stmt).scalar_one_or_none()
        if r is None:
            return None
        return {"id": str(r.id), "incident_no": r.incident_no,
                "ticket_version": r.ticket_version, "content": r.content,
                "highlights": r.highlights,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None}


def get_report_history(incident_no: str) -> list[dict]:
    """Return all leader reports for a ticket, oldest first."""
    from sqlalchemy import select
    with get_session() as s:
        stmt = (
            select(LeaderReport)
            .where(LeaderReport.incident_no == incident_no)
            .order_by(LeaderReport.ticket_version.asc())
        )
        rows = s.execute(stmt).scalars().all()
        return [{"id": str(r.id), "incident_no": r.incident_no,
                 "ticket_version": r.ticket_version, "content": r.content,
                 "highlights": r.highlights,
                 "generated_at": r.generated_at.isoformat() if r.generated_at else None}
                for r in rows]


# ---------------------------------------------------------------------------
# Engineer Task Recommendations
# ---------------------------------------------------------------------------

def save_recommendations(incident_no: str, ticket_version: int,
                         tasks: list[dict]) -> list[uuid.UUID]:
    """Persist recommended tasks for the given ticket version.

    Clears previous recommendations for the same incident_no + version
    before inserting the new batch.
    """
    from sqlalchemy import delete as sa_delete
    with get_session() as s, s.begin():
        s.execute(
            sa_delete(RecommendedTask).where(
                RecommendedTask.incident_no == incident_no,
                RecommendedTask.ticket_version == ticket_version,
            )
        )
        ids = []
        for t in tasks:
            task = RecommendedTask(
                incident_no=incident_no,
                ticket_version=ticket_version,
                task_order=t["task_order"],
                description=t["description"],
                source=t.get("source"),
                status="pending",
            )
            s.add(task)
            s.flush()
            ids.append(task.id)
        return ids


def get_recommendations(incident_no: str,
                        ticket_version: int | None = None) -> list[dict]:
    """Return recommendations for a ticket, optionally filtered by version.

    If ticket_version is None, returns the latest version's recommendations.
    """
    from sqlalchemy import select
    with get_session() as s:
        if ticket_version is None:
            sub = (
                select(RecommendedTask.ticket_version)
                .where(RecommendedTask.incident_no == incident_no)
                .order_by(RecommendedTask.ticket_version.desc())
                .limit(1)
                .scalar_subquery()
            )
            stmt = (
                select(RecommendedTask)
                .where(
                    RecommendedTask.incident_no == incident_no,
                    RecommendedTask.ticket_version == sub,
                )
                .order_by(RecommendedTask.task_order)
            )
        else:
            stmt = (
                select(RecommendedTask)
                .where(
                    RecommendedTask.incident_no == incident_no,
                    RecommendedTask.ticket_version == ticket_version,
                )
                .order_by(RecommendedTask.task_order)
            )
        rows = s.execute(stmt).scalars().all()
        return [_task_to_dict(r) for r in rows]


def revise_task(task_id: str, **fields) -> dict | None:
    """Allow a human to revise a recommended task.

    Acceptable fields: status, description, revision_note, revised_by.
    """
    allowed = {"status", "description", "revision_note", "revised_by"}
    values = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not values:
        return None

    from sqlalchemy import update as sa_update
    with get_session() as s, s.begin():
        stmt = (
            sa_update(RecommendedTask)
            .where(RecommendedTask.id == uuid.UUID(task_id))
            .values(**values)
        )
        s.execute(stmt)
        task = s.get(RecommendedTask, uuid.UUID(task_id))
        return _task_to_dict(task) if task else None


def _task_to_dict(t: RecommendedTask) -> dict:
    return {
        "id": str(t.id),
        "incident_no": t.incident_no,
        "ticket_version": t.ticket_version,
        "task_order": t.task_order,
        "description": t.description,
        "source": t.source,
        "status": t.status,
        "revised_by": t.revised_by,
        "revision_note": t.revision_note,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }

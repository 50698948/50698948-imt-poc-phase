"""
Database operations: ingestion, search, and utility queries.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text

from config import VECTOR_TOPK, FTS_TOPK, STRUCT_TOPK
from embedding import embed
from models import IncidentTicket, get_session


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
    return get_ticket_by_incident_no(incident_no)


def _get_ticket_title(session, incident_no: str) -> str:
    from sqlalchemy import select
    row = session.execute(
        select(IncidentTicket.title).where(IncidentTicket.incident_no == incident_no)
    ).scalar()
    return row or ""

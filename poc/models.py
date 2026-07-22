import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    UUID, String, Text, DateTime, text as sa_text,
    ARRAY, create_engine, func, Index, Integer,
    ForeignKey,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session
from pgvector.sqlalchemy import Vector
import json as _json

from config import DATABASE_URL, EMBEDDING_DIM

engine = create_engine(DATABASE_URL, echo=False)


class Base(DeclarativeBase):
    pass


class IncidentTicket(Base):
    __tablename__ = "incident_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=sa_text("gen_random_uuid()")
    )
    incident_no: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    service_name: Mapped[str] = mapped_column(String(128), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="open",
    )
    error_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    keywords: Mapped[list] = mapped_column(ARRAY(Text), default=list)
    embedding_description: Mapped[Optional[list]] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
    embedding_root_cause: Mapped[Optional[list]] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_text("now()"), onupdate=sa_text("now()")
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class LeaderReport(Base):
    __tablename__ = "leader_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=sa_text("gen_random_uuid()")
    )
    incident_no: Mapped[str] = mapped_column(
        String(32), ForeignKey("incident_tickets.incident_no"), nullable=False,
    )
    ticket_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    highlights: Mapped[list] = mapped_column(
        ARRAY(Text), nullable=False, server_default=sa_text("'{}'::text[]"),
    )
    report_status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    revised_fields: Mapped[list] = mapped_column(ARRAY(Text), nullable=False, server_default=sa_text("'{}'::text[]"))
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_text("now()")
    )


class RecommendedTask(Base):
    __tablename__ = "recommended_tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, server_default=sa_text("gen_random_uuid()")
    )
    incident_no: Mapped[str] = mapped_column(
        String(32), ForeignKey("incident_tickets.incident_no"), nullable=False,
    )
    ticket_version: Mapped[int] = mapped_column(Integer, nullable=False)
    task_order: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    revised_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    revision_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=sa_text("now()"), onupdate=sa_text("now()")
    )


def get_session() -> Session:
    return Session(engine)

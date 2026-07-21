CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- optional: for fuzzy text matching

CREATE TABLE incident_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_no     VARCHAR(32)   NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    root_cause      TEXT,
    resolution      TEXT,
    action_plan     TEXT,
    severity        VARCHAR(16)  NOT NULL CHECK (severity IN ('P0','P1','P2','P3')),
    service_name    VARCHAR(128) NOT NULL,
    category        VARCHAR(64)  NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','investigating','mitigated','resolved')),
    error_type      VARCHAR(64),
    keywords        TEXT[]       DEFAULT '{}',

    embedding_description VECTOR(384),
    embedding_root_cause  VECTOR(384),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    version         INT          NOT NULL DEFAULT 1,
    resolved_at     TIMESTAMPTZ
);

-- vector index on description
CREATE INDEX idx_desc_embedding ON incident_tickets
    USING ivfflat (embedding_description vector_cosine_ops)
    WITH (lists = 20);

-- vector index on root_cause (for rerank weighting)
CREATE INDEX idx_rc_embedding ON incident_tickets
    USING ivfflat (embedding_root_cause vector_cosine_ops)
    WITH (lists = 20);

-- full-text search index  (search across title + description + root_cause)
CREATE INDEX idx_fts ON incident_tickets
    USING GIN (
        to_tsvector(
            'english',
            coalesce(title,'') || ' ' ||
            coalesce(description,'') || ' ' ||
            coalesce(root_cause,'') || ' ' ||
            coalesce(resolution,'')
        )
    );

-- support for structured filtering
CREATE INDEX idx_service ON incident_tickets (service_name);
CREATE INDEX idx_category ON incident_tickets (category);
CREATE INDEX idx_status ON incident_tickets (status);
CREATE INDEX idx_error_type ON incident_tickets (error_type);

-- leader / executive reports — generated per-update snapshot
CREATE TABLE leader_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_no     VARCHAR(32)   NOT NULL REFERENCES incident_tickets(incident_no),
    ticket_version  INT           NOT NULL,
    content         TEXT          NOT NULL,
    highlights      TEXT[]        NOT NULL DEFAULT '{}',
    generated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reports_incident ON leader_reports (incident_no, ticket_version);

-- engineer task recommendations — generated per update, human-revisable
CREATE TABLE recommended_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_no     VARCHAR(32)   NOT NULL REFERENCES incident_tickets(incident_no),
    ticket_version  INT           NOT NULL,
    task_order      INT           NOT NULL,
    description     TEXT          NOT NULL,
    source          VARCHAR(32),
    status          VARCHAR(16)   NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','in_progress','completed','rejected')),
    revised_by      VARCHAR(64),
    revision_note   TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tasks_incident ON recommended_tasks (incident_no, ticket_version);

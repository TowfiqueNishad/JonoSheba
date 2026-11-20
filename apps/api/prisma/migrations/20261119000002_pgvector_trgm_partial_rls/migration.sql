-- =============================================================================
-- Jonoshheba AI — Raw SQL Migration 0002:
--   1. pgvector HNSW index + GIN tsvector & pg_trgm indexes (AI RAG & Universal Search)
--   2. Partial indexes (active watches, unpublished outbox, published catalogue, active sessions)
--   3. Append-only immutability trigger on audit.audit_logs
--   4. Row-Level Security (RLS) policies for strict per-user isolation (Rule R10)
-- =============================================================================

-- 1. Vector, Full-Text & Trigram Indexes
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding_hnsw
  ON ai.kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_tsv_gin
  ON ai.kb_chunks
  USING gin (tsv);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_text_trgm
  ON ai.kb_chunks
  USING gin (text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_title_bn_trgm
  ON catalogue.services
  USING gin (title_bn gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_services_title_en_trgm
  ON catalogue.services
  USING gin (title_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stations_stops_name_bn_trgm
  ON transport.stations_stops
  USING gin (name_bn gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stations_stops_name_en_trgm
  ON transport.stations_stops
  USING gin (name_en gin_trgm_ops);

-- 2. Partial Indexes for Hot Operational Queries
CREATE INDEX IF NOT EXISTS idx_ticket_watches_active_journey
  ON transport.ticket_watches (journey_date, mode, origin_id, destination_id)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_events_unpublished
  ON audit.outbox_events (created_at)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_published_active
  ON catalogue.services (category_id, updated_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_active_user
  ON identity.sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notices_published_active
  ON catalogue.notices (kind, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kb_chunks_active_doc
  ON ai.kb_chunks (document_id, ordinal)
  WHERE is_expired = false;

-- 3. Append-Only Immutability Enforcement on audit.audit_logs
CREATE OR REPLACE FUNCTION audit.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_logs is append-only; UPDATE and DELETE are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit.audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE OR DELETE ON audit.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_audit_log_mutation();

-- 4. Row-Level Security (RLS) on User-Owned Tables (Rule R10)
-- Application sessions set:
--   SET LOCAL app.current_user_id = '<user-uuid>';
-- Trusted background workers / migrations set:
--   SET LOCAL app.bypass_rls = 'true';

CREATE OR REPLACE FUNCTION identity.rls_owner_check(row_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    current_setting('app.bypass_rls', true) = 'true'
    OR (
      NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
      AND row_owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    );
$$;

-- Helper macro via DO block to enable & attach RLS policies uniformly on all user-owned tables
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('identity',  'sessions',              'user_id'),
      ('identity',  'user_preferences',      'user_id'),
      ('identity',  'user_profile_hints',    'user_id'),
      ('identity',  'consents',              'user_id'),
      ('identity',  'devices',               'user_id'),
      ('identity',  'documents',             'owner_id'),
      ('catalogue', 'saved_items',           'user_id'),
      ('catalogue', 'reminders',             'user_id'),
      ('transport', 'journey_searches',      'user_id'),
      ('transport', 'ticket_watches',        'user_id'),
      ('notify',    'notifications',         'user_id'),
      ('notify',    'notification_jobs',     'user_id'),
      ('notify',    'notification_feedback', 'user_id'),
      ('cases',     'citizen_cases',         'user_id'),
      ('ai',        'conversations',         'user_id'),
      ('audit',     'data_export_requests',  'user_id'),
      ('audit',     'deletion_requests',     'user_id')
    ) AS t(schema_name, table_name, owner_col)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', rec.schema_name, rec.table_name);
    EXECUTE format('DROP POLICY IF EXISTS user_isolation_policy ON %I.%I', rec.schema_name, rec.table_name);
    EXECUTE format(
      'CREATE POLICY user_isolation_policy ON %I.%I USING (identity.rls_owner_check(%I)) WITH CHECK (identity.rls_owner_check(%I))',
      rec.schema_name, rec.table_name, rec.owner_col, rec.owner_col
    );
  END LOOP;
END;
$$;

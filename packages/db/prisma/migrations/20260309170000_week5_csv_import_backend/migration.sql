-- Week 5 backend foundation: admin CSV import batches, row-level failures, contacts, and metrics.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'csv_import_batch_status') THEN
    CREATE TYPE csv_import_batch_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'csv_import_row_status') THEN
    CREATE TYPE csv_import_row_status AS ENUM (
      'processed',
      'failed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_contact_source') THEN
    CREATE TYPE channel_contact_source AS ENUM (
      'admin_manual',
      'csv_import',
      'heuristics',
      'llm',
      'youtube_raw'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_metric_source') THEN
    CREATE TYPE channel_metric_source AS ENUM (
      'admin_manual',
      'csv_import',
      'hypeauditor',
      'llm',
      'heuristics',
      'youtube_raw'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS channel_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  email text NOT NULL,
  notes text,
  source_label text,
  source channel_contact_source NOT NULL DEFAULT 'csv_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS channel_contacts_channel_id_email_key
  ON channel_contacts (channel_id, email);

CREATE INDEX IF NOT EXISTS channel_contacts_channel_id_idx
  ON channel_contacts (channel_id);

CREATE INDEX IF NOT EXISTS channel_contacts_email_idx
  ON channel_contacts (email);

CREATE INDEX IF NOT EXISTS channel_contacts_source_idx
  ON channel_contacts (source);

CREATE TABLE IF NOT EXISTS channel_metrics (
  channel_id uuid PRIMARY KEY REFERENCES channels (id) ON DELETE CASCADE,
  subscriber_count bigint,
  subscriber_count_source channel_metric_source,
  subscriber_count_source_updated_at timestamptz,
  average_views bigint,
  average_views_source channel_metric_source,
  average_views_source_updated_at timestamptz,
  average_likes bigint,
  average_likes_source channel_metric_source,
  average_likes_source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS csv_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  status csv_import_batch_status NOT NULL DEFAULT 'queued',
  filename text NOT NULL,
  csv_text text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  processed_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS csv_import_batches_requested_by_user_id_idx
  ON csv_import_batches (requested_by_user_id);

CREATE INDEX IF NOT EXISTS csv_import_batches_status_idx
  ON csv_import_batches (status);

CREATE INDEX IF NOT EXISTS csv_import_batches_created_at_idx
  ON csv_import_batches (created_at);

CREATE TABLE IF NOT EXISTS csv_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id uuid NOT NULL REFERENCES csv_import_batches (id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  status csv_import_row_status NOT NULL,
  youtube_channel_id text,
  channel_id uuid REFERENCES channels (id) ON DELETE SET NULL,
  error_message text,
  raw_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS csv_import_rows_import_batch_id_row_number_key
  ON csv_import_rows (import_batch_id, row_number);

CREATE INDEX IF NOT EXISTS csv_import_rows_import_batch_id_idx
  ON csv_import_rows (import_batch_id);

CREATE INDEX IF NOT EXISTS csv_import_rows_status_idx
  ON csv_import_rows (status);

CREATE INDEX IF NOT EXISTS csv_import_rows_channel_id_idx
  ON csv_import_rows (channel_id);

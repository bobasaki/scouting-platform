CREATE TYPE "hubspot_object_sync_run_status" AS ENUM ('queued', 'running', 'completed', 'failed');

ALTER TABLE "clients"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "hubspot_object_id" TEXT,
  ADD COLUMN "hubspot_object_type" TEXT,
  ADD COLUMN "hubspot_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hubspot_synced_at" TIMESTAMP(3),
  ADD COLUMN "hubspot_raw_payload" JSONB;

ALTER TABLE "campaigns"
  ADD COLUMN "hubspot_object_id" TEXT,
  ADD COLUMN "hubspot_object_type" TEXT,
  ADD COLUMN "hubspot_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hubspot_synced_at" TIMESTAMP(3),
  ADD COLUMN "hubspot_raw_payload" JSONB;

CREATE TABLE "hubspot_object_sync_runs" (
  "id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "status" "hubspot_object_sync_run_status" NOT NULL DEFAULT 'queued',
  "object_types" JSONB NOT NULL,
  "client_upsert_count" INTEGER NOT NULL DEFAULT 0,
  "campaign_upsert_count" INTEGER NOT NULL DEFAULT 0,
  "deactivated_count" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hubspot_object_sync_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hubspot_object_sync_runs"
  ADD CONSTRAINT "hubspot_object_sync_runs_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "clients_hubspot_object_type_id_key" ON "clients"("hubspot_object_type", "hubspot_object_id");
CREATE INDEX "clients_is_active_idx" ON "clients"("is_active");
CREATE INDEX "clients_hubspot_object_id_idx" ON "clients"("hubspot_object_id");
CREATE INDEX "clients_hubspot_object_type_idx" ON "clients"("hubspot_object_type");

CREATE UNIQUE INDEX "campaigns_hubspot_object_type_id_key" ON "campaigns"("hubspot_object_type", "hubspot_object_id");
CREATE INDEX "campaigns_hubspot_object_id_idx" ON "campaigns"("hubspot_object_id");
CREATE INDEX "campaigns_hubspot_object_type_idx" ON "campaigns"("hubspot_object_type");

CREATE INDEX "hubspot_object_sync_runs_requested_by_user_id_idx" ON "hubspot_object_sync_runs"("requested_by_user_id");
CREATE INDEX "hubspot_object_sync_runs_requested_by_user_id_created_at_idx" ON "hubspot_object_sync_runs"("requested_by_user_id", "created_at");
CREATE INDEX "hubspot_object_sync_runs_status_idx" ON "hubspot_object_sync_runs"("status");
CREATE INDEX "hubspot_object_sync_runs_created_at_idx" ON "hubspot_object_sync_runs"("created_at");

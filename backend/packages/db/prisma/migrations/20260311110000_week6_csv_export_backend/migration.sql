-- Week 6 backend foundation: CSV export batches and persisted export artifacts.

-- CreateEnum
CREATE TYPE "csv_export_batch_status" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "csv_export_scope_type" AS ENUM ('selected', 'filtered');

-- CreateTable
CREATE TABLE "csv_export_batches" (
    "id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "scope_type" "csv_export_scope_type" NOT NULL,
    "scope_payload" JSONB NOT NULL,
    "schema_version" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "csv_export_batch_status" NOT NULL DEFAULT 'queued',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "csv_content" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_export_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "csv_export_batches_requested_by_user_id_idx" ON "csv_export_batches"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "csv_export_batches_status_idx" ON "csv_export_batches"("status");

-- CreateIndex
CREATE INDEX "csv_export_batches_created_at_idx" ON "csv_export_batches"("created_at");

-- AddForeignKey
ALTER TABLE "csv_export_batches" ADD CONSTRAINT "csv_export_batches_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

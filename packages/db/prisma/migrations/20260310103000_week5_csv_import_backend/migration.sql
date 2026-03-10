-- Week 5 backend foundation: CSV import batches, rows, contacts, and metrics.

-- CreateEnum
CREATE TYPE "csv_import_batch_status" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "csv_import_row_status" AS ENUM ('pending', 'imported', 'failed');

-- CreateTable
CREATE TABLE "channel_contacts" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "csv_import_batch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_metrics" (
    "channel_id" UUID NOT NULL,
    "subscriber_count" BIGINT,
    "view_count" BIGINT,
    "video_count" BIGINT,
    "csv_import_batch_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_metrics_pkey" PRIMARY KEY ("channel_id")
);

-- CreateTable
CREATE TABLE "csv_import_batches" (
    "id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "template_version" TEXT NOT NULL,
    "status" "csv_import_batch_status" NOT NULL DEFAULT 'queued',
    "total_row_count" INTEGER NOT NULL DEFAULT 0,
    "imported_row_count" INTEGER NOT NULL DEFAULT 0,
    "failed_row_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_import_rows" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "csv_import_row_status" NOT NULL DEFAULT 'pending',
    "youtube_channel_id" TEXT NOT NULL,
    "channel_title" TEXT NOT NULL,
    "contact_email" TEXT,
    "subscriber_count" TEXT,
    "view_count" TEXT,
    "video_count" TEXT,
    "notes" TEXT,
    "source_label" TEXT,
    "channel_id" UUID,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_contacts_channel_id_idx" ON "channel_contacts"("channel_id");

-- CreateIndex
CREATE INDEX "channel_contacts_csv_import_batch_id_idx" ON "channel_contacts"("csv_import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_contacts_channel_id_email_key" ON "channel_contacts"("channel_id", "email");

-- CreateIndex
CREATE INDEX "channel_metrics_csv_import_batch_id_idx" ON "channel_metrics"("csv_import_batch_id");

-- CreateIndex
CREATE INDEX "csv_import_batches_requested_by_user_id_idx" ON "csv_import_batches"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "csv_import_batches_status_idx" ON "csv_import_batches"("status");

-- CreateIndex
CREATE INDEX "csv_import_batches_created_at_idx" ON "csv_import_batches"("created_at");

-- CreateIndex
CREATE INDEX "csv_import_rows_batch_id_idx" ON "csv_import_rows"("batch_id");

-- CreateIndex
CREATE INDEX "csv_import_rows_status_idx" ON "csv_import_rows"("status");

-- CreateIndex
CREATE INDEX "csv_import_rows_channel_id_idx" ON "csv_import_rows"("channel_id");

-- CreateIndex
CREATE INDEX "csv_import_rows_youtube_channel_id_idx" ON "csv_import_rows"("youtube_channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "csv_import_rows_batch_id_row_number_key" ON "csv_import_rows"("batch_id", "row_number");

-- AddForeignKey
ALTER TABLE "channel_contacts" ADD CONSTRAINT "channel_contacts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_contacts" ADD CONSTRAINT "channel_contacts_csv_import_batch_id_fkey" FOREIGN KEY ("csv_import_batch_id") REFERENCES "csv_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_csv_import_batch_id_fkey" FOREIGN KEY ("csv_import_batch_id") REFERENCES "csv_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_batches" ADD CONSTRAINT "csv_import_batches_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_rows" ADD CONSTRAINT "csv_import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "csv_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_import_rows" ADD CONSTRAINT "csv_import_rows_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('pipeline', 'booked', 'published', 'longterm', 'dropped');

-- CreateEnum
CREATE TYPE "almedia_sync_run_status" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "legacy_source_id" INTEGER,
    "channel_name" TEXT NOT NULL,
    "channel_key" TEXT NOT NULL,
    "channel_url" TEXT,
    "country" TEXT,
    "cm" TEXT,
    "platform" TEXT,
    "vertical" TEXT,
    "category" TEXT,
    "status" "booking_status" NOT NULL DEFAULT 'pipeline',
    "activation" TEXT,
    "num_activations" INTEGER,
    "contract_signed" BOOLEAN NOT NULL DEFAULT false,
    "contract_url" TEXT,
    "published_at" TEXT,
    "int_budget" DOUBLE PRECISION,
    "ext_budget" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "month" TEXT,
    "note" TEXT,
    "video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_targets" (
    "id" UUID NOT NULL,
    "cm" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "budget_eur" DOUBLE PRECISION NOT NULL,
    "tier_under_10k" INTEGER NOT NULL DEFAULT 0,
    "tier_10k_20k" INTEGER NOT NULL DEFAULT 0,
    "tier_20k_50k" INTEGER NOT NULL DEFAULT 0,
    "tier_over_50k" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_targets" (
    "id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "total_eur" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_invoices" (
    "id" UUID NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "invoiced_at" TEXT NOT NULL,
    "matured_at_invoice" BOOLEAN NOT NULL DEFAULT false,
    "cost" DOUBLE PRECISION NOT NULL,
    "return_pct" DOUBLE PRECISION,
    "tier" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almedia_campaign_snapshots" (
    "id" UUID NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "campaign_source" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "expected_cpm" DOUBLE PRECISION,
    "view_count" DOUBLE PRECISION,
    "signups_pct" DOUBLE PRECISION,
    "roas_d7p_d14" DOUBLE PRECISION,
    "roas_return" DOUBLE PRECISION,
    "return_pct" DOUBLE PRECISION,
    "appu_d14" DOUBLE PRECISION,
    "d7_purchases" DOUBLE PRECISION,
    "channel_name" TEXT,
    "video_url" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almedia_campaign_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almedia_sync_runs" (
    "id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "status" "almedia_sync_run_status" NOT NULL DEFAULT 'queued',
    "agency" TEXT,
    "campaign_count" INTEGER NOT NULL DEFAULT 0,
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almedia_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_legacy_source_id_key" ON "bookings"("legacy_source_id");

-- CreateIndex
CREATE INDEX "bookings_channel_key_idx" ON "bookings"("channel_key");

-- CreateIndex
CREATE INDEX "bookings_month_idx" ON "bookings"("month");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE INDEX "booking_targets_month_idx" ON "booking_targets"("month");

-- CreateIndex
CREATE UNIQUE INDEX "booking_targets_cm_market_month_key" ON "booking_targets"("cm", "market", "month");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_targets_month_key" ON "revenue_targets"("month");

-- CreateIndex
CREATE UNIQUE INDEX "booking_invoices_campaign_name_key" ON "booking_invoices"("campaign_name");

-- CreateIndex
CREATE INDEX "booking_invoices_invoiced_at_idx" ON "booking_invoices"("invoiced_at");

-- CreateIndex
CREATE UNIQUE INDEX "almedia_campaign_snapshots_campaign_name_key" ON "almedia_campaign_snapshots"("campaign_name");

-- CreateIndex
CREATE INDEX "almedia_campaign_snapshots_synced_at_idx" ON "almedia_campaign_snapshots"("synced_at");

-- CreateIndex
CREATE INDEX "almedia_campaign_snapshots_platform_idx" ON "almedia_campaign_snapshots"("platform");

-- CreateIndex
CREATE INDEX "almedia_sync_runs_requested_by_user_id_idx" ON "almedia_sync_runs"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "almedia_sync_runs_status_idx" ON "almedia_sync_runs"("status");

-- CreateIndex
CREATE INDEX "almedia_sync_runs_created_at_idx" ON "almedia_sync_runs"("created_at");

-- AddForeignKey
ALTER TABLE "almedia_sync_runs" ADD CONSTRAINT "almedia_sync_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

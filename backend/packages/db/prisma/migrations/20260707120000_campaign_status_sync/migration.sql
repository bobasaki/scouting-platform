ALTER TABLE "campaigns" ADD COLUMN "status" TEXT;

CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

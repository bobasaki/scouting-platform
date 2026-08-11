-- CreateTable
CREATE TABLE "almedia_channel_enrichments" (
    "id" UUID NOT NULL,
    "channel_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almedia_channel_enrichments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almedia_channel_enrichment_links" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "almedia_channel_enrichment_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "almedia_channel_enrichments_channel_id_key" ON "almedia_channel_enrichments"("channel_id");

-- CreateIndex
CREATE INDEX "almedia_channel_enrichment_links_channel_id_idx" ON "almedia_channel_enrichment_links"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "almedia_channel_enrichment_links_source_key" ON "almedia_channel_enrichment_links"("source_type", "source_key");

-- AddForeignKey
ALTER TABLE "almedia_channel_enrichment_links" ADD CONSTRAINT "almedia_channel_enrichment_links_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "almedia_channel_enrichments"("channel_id") ON DELETE CASCADE ON UPDATE CASCADE;

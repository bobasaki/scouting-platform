-- AlterTable
ALTER TABLE "almedia_channel_enrichments"
ADD COLUMN "catalog_channel_id" UUID;

-- Backfill exact YouTube channel id matches already present in the catalog.
UPDATE almedia_channel_enrichments a
SET catalog_channel_id = c.id
FROM channels c
WHERE c.youtube_channel_id = a.channel_id
  AND a.catalog_channel_id IS NULL;

-- CreateIndex
CREATE INDEX "almedia_channel_enrichments_catalog_channel_id_idx"
ON "almedia_channel_enrichments"("catalog_channel_id");

-- AddForeignKey
ALTER TABLE "almedia_channel_enrichments"
ADD CONSTRAINT "almedia_channel_enrichments_catalog_channel_id_fkey"
FOREIGN KEY ("catalog_channel_id") REFERENCES "channels"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

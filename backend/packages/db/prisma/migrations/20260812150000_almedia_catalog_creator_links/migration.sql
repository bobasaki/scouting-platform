-- CreateTable
CREATE TABLE "almedia_catalog_channel_links" (
    "id" UUID NOT NULL,
    "channel_key" TEXT NOT NULL,
    "catalog_channel_id" UUID NOT NULL,
    "source_campaign_name" TEXT NOT NULL,
    "source_video_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almedia_catalog_channel_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "almedia_catalog_channel_links_channel_key_key" ON "almedia_catalog_channel_links"("channel_key");

-- CreateIndex
CREATE INDEX "almedia_catalog_channel_links_catalog_channel_id_idx" ON "almedia_catalog_channel_links"("catalog_channel_id");

-- AddForeignKey
ALTER TABLE "almedia_catalog_channel_links" ADD CONSTRAINT "almedia_catalog_channel_links_catalog_channel_id_fkey" FOREIGN KEY ("catalog_channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

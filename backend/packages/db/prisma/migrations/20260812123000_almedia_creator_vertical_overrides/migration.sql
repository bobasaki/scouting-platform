-- Completed Almedia campaign creators need an admin-manual vertical without
-- creating a future Booking. The normalized creator key makes one override
-- apply to every campaign round while preserving actor attribution.
CREATE TABLE "almedia_creator_vertical_overrides" (
    "id" UUID NOT NULL,
    "channel_key" TEXT NOT NULL,
    "vertical" TEXT NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almedia_creator_vertical_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "almedia_creator_vertical_overrides_channel_key_key"
ON "almedia_creator_vertical_overrides"("channel_key");

CREATE INDEX "almedia_creator_vertical_overrides_created_by_user_id_idx"
ON "almedia_creator_vertical_overrides"("created_by_user_id");

CREATE INDEX "almedia_creator_vertical_overrides_updated_by_user_id_idx"
ON "almedia_creator_vertical_overrides"("updated_by_user_id");

ALTER TABLE "almedia_creator_vertical_overrides"
ADD CONSTRAINT "almedia_creator_vertical_overrides_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "almedia_creator_vertical_overrides"
ADD CONSTRAINT "almedia_creator_vertical_overrides_updated_by_user_id_fkey"
FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

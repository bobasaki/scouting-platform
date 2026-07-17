ALTER TYPE "channel_manual_override_field"
ADD VALUE 'country_region';

ALTER TABLE "channel_manual_overrides"
ADD COLUMN "fallback_country_region_source" "channel_country_source";

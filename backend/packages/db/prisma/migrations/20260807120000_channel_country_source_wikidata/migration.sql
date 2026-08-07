-- Add the Wikidata discovery provenance to the channel country source enum.
-- Wikidata is a low-confidence seed source (not protected): platform enrichment
-- may later override a Wikidata-sourced country with a higher-confidence value.
ALTER TYPE "channel_country_source" ADD VALUE 'wikidata';

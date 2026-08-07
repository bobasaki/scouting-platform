import { z } from "zod";

/**
 * Ingestion contract for the external Wikidata YouTube discovery scraper.
 *
 * The scraper runs off-platform (e.g. on an operator's laptop), queries
 * Wikidata for Europe-based YouTube channels, and POSTs batches of the
 * resulting channel IDs to the platform. Each channel is stored as a
 * discovery *seed*: the YouTube channel id, a provisional label, and the
 * originating country/variant metadata. Full channel details (title,
 * description, thumbnail, statistics) are filled in later by the platform's
 * existing enrichment pipeline — this endpoint never touches YouTube quota.
 */

// A YouTube channel id is the canonical "UC" + 22 url-safe characters form.
const youtubeChannelIdSchema = z
  .string()
  .trim()
  .regex(/^UC[A-Za-z0-9_-]{22}$/u, "Must be a canonical YouTube channel id (UC + 22 chars)");

// ISO 3166-1 alpha-2 country code (e.g. "HR", "DE"). Normalized upstream.
const isoAlpha2Schema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/u, "Must be an ISO 3166-1 alpha-2 country code");

export const wikidataIngestChannelSchema = z.object({
  youtubeChannelId: youtubeChannelIdSchema,
  // Wikidata label; may be empty when the item has no English label.
  label: z.string().trim().max(300).default(""),
  // One or more European countries the channel was discovered under.
  countries: z.array(isoAlpha2Schema).min(1).max(60),
  // Wikidata discovery variants (A=citizenship, B=HQ, C=country of origin).
  // Reserved provenance metadata — accepted but not persisted yet.
  variants: z.array(z.string().trim().min(1).max(4)).max(8).optional(),
});

export const MAX_WIKIDATA_INGEST_BATCH = 1000;

export const wikidataIngestRequestSchema = z.object({
  channels: z.array(wikidataIngestChannelSchema).min(1).max(MAX_WIKIDATA_INGEST_BATCH),
});

export const wikidataIngestResponseSchema = z.object({
  received: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export type WikidataIngestChannel = z.infer<typeof wikidataIngestChannelSchema>;
export type WikidataIngestRequest = z.infer<typeof wikidataIngestRequestSchema>;
export type WikidataIngestResponse = z.infer<typeof wikidataIngestResponseSchema>;

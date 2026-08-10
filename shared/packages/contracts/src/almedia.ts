import { z } from "zod";

/**
 * Contracts for the Almedia campaign-tracking workspace (Phase 1: read-only).
 *
 * The `Deal` shape is the joined row the Insights and Performance tabs work on:
 * an internal booking matched to the Almedia campaigns it produced, with the
 * return tier, maturity, and size tier already classified server-side.
 */

const isoDatetimeSchema = z.iso.datetime();

/** ISO `YYYY-MM`. */
const isoMonthSchema = z.string().regex(/^\d{4}-\d{2}$/u);

/** ISO `YYYY-MM-DD`. The source tracker stores partial dates as strings. */
const isoDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);

export const bookingStatusSchema = z.enum([
  "pipeline",
  "booked",
  "published",
  "longterm",
  "dropped",
]);

export const almediaSyncRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const almediaReturnTierSchema = z.enum([
  "longterm",
  "rebooking",
  "price_adjusted",
  "drop",
]);

export const almediaMaturityStatusSchema = z.enum([
  "matured",
  "maturing",
  "unknown",
]);

export const almediaSizeTierSchema = z.enum(["<10k", "10-20k", "20-50k", ">50k"]);

export const almediaDimensionIdSchema = z.enum([
  "cm",
  "country",
  "vertical",
  "category",
  "platform",
  "sizeTier",
  "status",
  "month",
]);

/** One campaign row from the Almedia agency-data feed, as stored + served. */
export const almediaCampaignSchema = z.object({
  campaignName: z.string(),
  campaignSource: z.string(),
  platform: z.string(),
  country: z.string(),
  publishedAt: isoDatetimeSchema.nullable(),
  cost: z.number().nullable(),
  expectedCpm: z.number().nullable(),
  viewCount: z.number().nullable(),
  signupsPct: z.number().nullable(),
  roasD7pD14: z.number().nullable(),
  roasReturn: z.number().nullable(),
  returnPct: z.number().nullable(),
  appuD14: z.number().nullable(),
  d7Purchases: z.number().nullable(),
  channelName: z.string().nullable(),
  videoUrl: z.string().nullable(),
});

export const bookingSchema = z.object({
  id: z.uuid(),
  channelName: z.string(),
  /** Normalized join key against Almedia campaign names, e.g. "ASMRFIXY". */
  channelKey: z.string(),
  channelUrl: z.string().nullable(),
  country: z.string().nullable(),
  cm: z.string().nullable(),
  platform: z.string().nullable(),
  vertical: z.string().nullable(),
  category: z.string().nullable(),
  status: bookingStatusSchema,
  activation: z.string().nullable(),
  numActivations: z.number().int().nullable(),
  contractSigned: z.boolean(),
  contractUrl: z.string().nullable(),
  publishedAt: isoDaySchema.nullable(),
  intBudget: z.number().nullable(),
  extBudget: z.number().nullable(),
  currency: z.string(),
  month: isoMonthSchema.nullable(),
  note: z.string().nullable(),
  videoUrl: z.string().nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const almediaMaturitySchema = z.object({
  status: almediaMaturityStatusSchema,
  daysRemaining: z.number().int().nullable(),
});

/**
 * A booking joined with its Almedia campaign. Campaign-only and booking-only
 * rows are both kept, so nothing silently drops out of totals.
 *
 * Enrichment fields are nullable and stay null in Phase 1 — channel enrichment
 * is not ported yet, so verticals fall back to the booking's own value.
 */
export const almediaDealSchema = z.object({
  channelKey: z.string(),
  channelName: z.string(),
  campaignName: z.string().nullable(),
  videoUrl: z.string().nullable(),
  platform: z.string().nullable(),
  publishedAt: isoDaySchema.nullable(),
  cost: z.number().nullable(),
  expectedCpm: z.number().nullable(),
  viewCount: z.number().nullable(),
  returnPct: z.number().nullable(),
  signupsPct: z.number().nullable(),
  d7Purchases: z.number().nullable(),
  roasReturn: z.number().nullable(),
  appuD14: z.number().nullable(),
  /** cost / expectedCpm x 1000 — the views the price was based on. */
  expectedViews: z.number().nullable(),
  /** viewCount / expectedViews x 100. */
  deliveryPct: z.number().nullable(),
  cm: z.string().nullable(),
  country: z.string().nullable(),
  vertical: z.string().nullable(),
  verticals: z.array(z.string()),
  category: z.string().nullable(),
  hasEnrichment: z.boolean(),
  creatorFollowers: z.number().nullable(),
  creatorTypicalViews: z.number().nullable(),
  creatorEngagementRatePct: z.number().nullable(),
  creatorContentFormat: z.string().nullable(),
  creatorBrandFit: z.string().nullable(),
  creatorSafetyRisk: z.string().nullable(),
  status: bookingStatusSchema.nullable(),
  intBudget: z.number().nullable(),
  extBudget: z.number().nullable(),
  month: isoMonthSchema.nullable(),
  sizeTier: almediaSizeTierSchema.nullable(),
  hasCampaign: z.boolean(),
  hasBooking: z.boolean(),
  /** Server-stamped classifications, so every consumer agrees on them. */
  returnTier: almediaReturnTierSchema.nullable(),
  maturity: almediaMaturitySchema,
});

export const almediaDimensionOptionsSchema = z.record(
  almediaDimensionIdSchema,
  z.array(z.string()),
);

export const almediaSyncStatusSchema = z.object({
  status: almediaSyncRunStatusSchema.nullable(),
  agency: z.string().nullable(),
  campaignCount: z.number().int().nonnegative(),
  syncedAt: isoDatetimeSchema.nullable(),
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
  lastError: z.string().nullable(),
});

export const almediaDealsResponseSchema = z.object({
  deals: z.array(almediaDealSchema),
  options: almediaDimensionOptionsSchema,
  sync: almediaSyncStatusSchema,
});

export const almediaCampaignsResponseSchema = z.object({
  campaigns: z.array(almediaCampaignSchema),
  sync: almediaSyncStatusSchema,
});

const tierCountsSchema = z.object({
  under10k: z.number().int().nonnegative(),
  from10kTo20k: z.number().int().nonnegative(),
  from20kTo50k: z.number().int().nonnegative(),
  over50k: z.number().int().nonnegative(),
});

const statusCountsSchema = z.object({
  pipeline: z.number().int().nonnegative(),
  booked: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  longterm: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
});

export const almediaScorecardRowSchema = z.object({
  cm: z.string().nullable(),
  market: z.string().nullable(),
  month: isoMonthSchema,
  targetEur: z.number().nullable(),
  targetTiers: tierCountsSchema.nullable(),
  bookedEur: z.number(),
  bookedTiers: tierCountsSchema,
  counts: statusCountsSchema,
  utilization: z.number().nullable(),
  pace: z.number().nullable(),
  dropoutRate: z.number().nullable(),
});

export const almediaScorecardMonthSchema = z.object({
  month: isoMonthSchema,
  targetEur: z.number().nullable(),
  bookedEur: z.number(),
  counts: statusCountsSchema,
  utilization: z.number().nullable(),
  pace: z.number().nullable(),
  dropoutRate: z.number().nullable(),
});

export const almediaScorecardResponseSchema = z.object({
  months: z.array(almediaScorecardMonthSchema),
  rows: z.array(almediaScorecardRowSchema),
  unscheduledCount: z.number().int().nonnegative(),
});

export const almediaSyncResponseSchema = z.object({
  runId: z.uuid(),
});

export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type AlmediaSyncRunStatus = z.infer<typeof almediaSyncRunStatusSchema>;
export type AlmediaReturnTier = z.infer<typeof almediaReturnTierSchema>;
export type AlmediaMaturityStatus = z.infer<typeof almediaMaturityStatusSchema>;
export type AlmediaMaturity = z.infer<typeof almediaMaturitySchema>;
export type AlmediaSizeTier = z.infer<typeof almediaSizeTierSchema>;
export type AlmediaDimensionId = z.infer<typeof almediaDimensionIdSchema>;
export type AlmediaCampaignRow = z.infer<typeof almediaCampaignSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type AlmediaDeal = z.infer<typeof almediaDealSchema>;
export type AlmediaDimensionOptions = z.infer<typeof almediaDimensionOptionsSchema>;
export type AlmediaSyncStatus = z.infer<typeof almediaSyncStatusSchema>;
export type AlmediaDealsResponse = z.infer<typeof almediaDealsResponseSchema>;
export type AlmediaCampaignsResponse = z.infer<typeof almediaCampaignsResponseSchema>;
export type AlmediaTierCounts = z.infer<typeof tierCountsSchema>;
export type AlmediaStatusCounts = z.infer<typeof statusCountsSchema>;
export type AlmediaScorecardRow = z.infer<typeof almediaScorecardRowSchema>;
export type AlmediaScorecardMonth = z.infer<typeof almediaScorecardMonthSchema>;
export type AlmediaScorecardResponse = z.infer<typeof almediaScorecardResponseSchema>;
export type AlmediaSyncResponse = z.infer<typeof almediaSyncResponseSchema>;

/** Filter dimensions, in the order the Insights filter bar renders them. */
export const ALMEDIA_DIMENSIONS = [
  { id: "cm", label: "CM" },
  { id: "country", label: "Market" },
  { id: "vertical", label: "Vertical" },
  { id: "category", label: "Category" },
  { id: "platform", label: "Platform" },
  { id: "sizeTier", label: "Size" },
  { id: "status", label: "Status" },
  { id: "month", label: "Month" },
] as const satisfies ReadonlyArray<{ id: AlmediaDimensionId; label: string }>;

/** Placeholder used wherever a dimension value is missing. */
export const ALMEDIA_UNASSIGNED = "Unassigned";

import {
  ALMEDIA_DIMENSIONS,
  ALMEDIA_UNASSIGNED,
  type AlmediaDeal,
  type AlmediaDimensionId,
} from "@scouting-platform/contracts";

/**
 * Presentation-layer types for the Almedia workspace. The row type itself
 * (`AlmediaDeal`) is produced server-side; everything here is about how the
 * client slices and displays it.
 */

export { ALMEDIA_DIMENSIONS, ALMEDIA_UNASSIGNED };
export type { AlmediaDeal, AlmediaDimensionId };

/** "all" means no filter on that dimension. */
export type AlmediaFilters = Record<AlmediaDimensionId, string>;

export const ALL_ALMEDIA_FILTERS: AlmediaFilters = {
  cm: "all",
  country: "all",
  vertical: "all",
  category: "all",
  platform: "all",
  sizeTier: "all",
  status: "all",
  month: "all",
};

export interface DimensionGroup {
  key: string;
  deals: number;
  /** Almedia spend, in ALMEDIA_CURRENCY. */
  cost: number;
  /** Internal booked budget (INT), in ALMEDIA_CURRENCY. */
  intBudget: number;
  expectedViews: number;
  actualViews: number;
  deliveryPct: number | null;
  /** Cost-weighted average return %. */
  avgReturnPct: number | null;
  /** Deals with a measured return, used to qualify averages. */
  measured: number;
  publishedShare: number | null;
  droppedShare: number | null;
}

export interface AlmediaTotals {
  deals: number;
  campaigns: number;
  markets: number;
  cost: number;
  intBudget: number;
  expectedViews: number;
  actualViews: number;
  deliveryPct: number | null;
  avgReturnPct: number | null;
  publishedShare: number | null;
  /** Average payment per user by D14, weighted by acquired users. */
  avgAppuD14: number | null;
}

/** How much of the cohort in view has creator enrichment behind it. */
export interface EnrichmentOverview {
  campaigns: number;
  enrichedCampaigns: number;
  /** 0..1, or null when there are no campaigns to cover. */
  coverageShare: number | null;
  /** Distinct enriched creators, not campaigns. */
  enrichedCreators: number;
  verticals: number;
  avgEngagementRatePct: number | null;
  /** Share of assessed creators rated low brand-safety risk. */
  brandSafeShare: number | null;
}

/** Commercial performance and creator quality attributed to one vertical. */
export interface VerticalPerformance {
  vertical: string;
  campaigns: number;
  measuredReturns: number;
  enrichedCreators: number;
  cost: number;
  views: number;
  d7Purchases: number;
  avgReturnPct: number | null;
  avgEngagementRatePct: number | null;
  avgFollowers: number | null;
  brandSafeShare: number | null;
}

export interface PainPoint {
  dimension: AlmediaDimensionId;
  key: string;
  severity: "high" | "medium";
  issue: "low-return" | "under-delivery" | "publishing-lag" | "high-dropout";
  detail: string;
}

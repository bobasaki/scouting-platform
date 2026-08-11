import type { AlmediaDeal } from "@scouting-platform/contracts";

import { weightedReturn } from "./filters";
import type { EnrichmentOverview, VerticalPerformance } from "./types";

/**
 * Enrichment-derived aggregations behind the Vertical Insights panel.
 *
 * Both work on campaigns only: a booking with no campaign has no spend, views,
 * or return to attribute, so counting it would deflate every average. Creator
 * quality is averaged per *creator*, not per campaign, so a channel booked four
 * times does not weigh four times as much.
 *
 * Ported from the standalone tracker's `dashboard/src/insights/enrich.ts`.
 */

function sum(values: ReadonlyArray<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function average(values: ReadonlyArray<number | null>): number | null {
  const measured = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );

  if (measured.length === 0) {
    return null;
  }

  return measured.reduce((total, value) => total + value, 0) / measured.length;
}

/** One row per enriched creator, keyed by channel, first occurrence wins. */
function distinctEnrichedCreators(
  deals: readonly AlmediaDeal[],
): AlmediaDeal[] {
  const byChannel = new Map<string, AlmediaDeal>();

  for (const deal of deals) {
    if (deal.hasEnrichment && !byChannel.has(deal.channelKey)) {
      byChannel.set(deal.channelKey, deal);
    }
  }

  return [...byChannel.values()];
}

function lowRiskShare(creators: readonly AlmediaDeal[]): number | null {
  const assessed = creators.filter((deal) => deal.creatorSafetyRisk !== null);

  if (assessed.length === 0) {
    return null;
  }

  const safe = assessed.filter((deal) => deal.creatorSafetyRisk === "low");

  return safe.length / assessed.length;
}

/** Enrichment coverage across the campaigns currently in view. */
export function enrichmentOverview(
  deals: readonly AlmediaDeal[],
): EnrichmentOverview {
  const campaigns = deals.filter((deal) => deal.hasCampaign);
  const enrichedCampaigns = campaigns.filter((deal) => deal.hasEnrichment);
  const creators = distinctEnrichedCreators(enrichedCampaigns);

  return {
    campaigns: campaigns.length,
    enrichedCampaigns: enrichedCampaigns.length,
    coverageShare:
      campaigns.length > 0 ? enrichedCampaigns.length / campaigns.length : null,
    enrichedCreators: creators.length,
    verticals: new Set(campaigns.flatMap((deal) => deal.verticals)).size,
    avgEngagementRatePct: average(
      creators.map((deal) => deal.creatorEngagementRatePct),
    ),
    brandSafeShare: lowRiskShare(creators),
  };
}

/**
 * Performance per vertical, spend-heaviest first. A campaign with two verticals
 * counts in both — the point is to compare verticals, not to split budget.
 */
export function verticalPerformance(
  deals: readonly AlmediaDeal[],
): VerticalPerformance[] {
  const groups = new Map<string, AlmediaDeal[]>();

  for (const deal of deals.filter((row) => row.hasCampaign)) {
    for (const vertical of new Set(deal.verticals)) {
      groups.set(vertical, [...(groups.get(vertical) ?? []), deal]);
    }
  }

  return [...groups.entries()]
    .map(([vertical, rows]) => {
      const creators = distinctEnrichedCreators(rows);
      const { value: avgReturnPct, measured } = weightedReturn(rows);

      return {
        vertical,
        campaigns: rows.length,
        measuredReturns: measured,
        enrichedCreators: creators.length,
        cost: sum(rows.map((row) => row.cost)),
        views: sum(rows.map((row) => row.viewCount)),
        d7Purchases: sum(rows.map((row) => row.d7Purchases)),
        avgReturnPct,
        avgEngagementRatePct: average(
          creators.map((row) => row.creatorEngagementRatePct),
        ),
        avgFollowers: average(creators.map((row) => row.creatorFollowers)),
        brandSafeShare: lowRiskShare(creators),
      };
    })
    .sort((left, right) => right.cost - left.cost);
}

import {
  ALMEDIA_UNASSIGNED,
  type AlmediaDeal,
  type AlmediaDimensionId,
  type AlmediaScorecardResponse,
  type AlmediaScorecardRow,
} from "@scouting-platform/contracts";

import { enrichmentOverview, verticalPerformance } from "./enrichment";
import { groupByDimension, painPoints, totalsOf } from "./filters";
import { ALMEDIA_CURRENCY } from "./format";
import type { AlmediaFilters } from "./types";

/**
 * The evidence pack the AI analyst answers from: compact, coverage-labelled
 * JSON built from exactly the deals the user has in view.
 *
 * Two properties matter more than completeness. Every truncated section says so
 * and how much it dropped, so the model can never present a partial list as
 * exhaustive. And matured campaigns are separated from still-accruing ones, so
 * a return-tier action is never taken on a number that has not settled.
 *
 * Ported from the standalone tracker's `buildDigest` in
 * `dashboard/src/insights/enrich.ts`.
 */

/** Well under the schema's 200k cap, leaving room for the SSE envelope. */
const MAX_DIGEST_CHARS = 190_000;

/** Tried in order until the digest fits; 0 keeps only the counts. */
const CANDIDATE_LIMITS = [40, 20, 10, 5, 0] as const;

const MAX_PLAN_ROWS = 60;
const MAX_SEGMENT_ROWS = 10;
const MAX_PAIN_POINTS = 30;

/** The plan is aggregated on these three only; other filters cannot narrow it. */
const PLAN_FILTER_KEYS: ReadonlySet<AlmediaDimensionId> = new Set([
  "cm",
  "country",
  "month",
]);

function round(value: number | null): number | null {
  return value === null || !Number.isFinite(value)
    ? null
    : Math.round(value * 10) / 10;
}

function compactText(value: string | null, maxLength = 160): string | null {
  if (value === null || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function nextIsoMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 7);
}

function activeFiltersOf(filters: AlmediaFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== "all"),
  );
}

function matchesPlanFilter(value: string | null, filter: string): boolean {
  if (filter === "all") {
    return true;
  }

  return filter === ALMEDIA_UNASSIGNED
    ? value === null || value === ""
    : value === filter;
}

function filterPlanRows(
  scorecard: AlmediaScorecardResponse,
  filters: AlmediaFilters,
): AlmediaScorecardRow[] {
  return scorecard.rows.filter(
    (row) =>
      matchesPlanFilter(row.cm, filters.cm) &&
      matchesPlanFilter(row.market, filters.country) &&
      matchesPlanFilter(row.month, filters.month),
  );
}

function dealLine(deal: AlmediaDeal): Record<string, unknown> {
  return {
    channel: compactText(deal.channelName),
    campaign: compactText(deal.campaignName),
    cm: deal.cm,
    market: deal.country,
    verticals: deal.verticals,
    category: deal.category,
    enrichment: deal.hasEnrichment
      ? {
          followers: round(deal.creatorFollowers),
          typicalViews: round(deal.creatorTypicalViews),
          engagementRatePct: round(deal.creatorEngagementRatePct),
          contentFormat: deal.creatorContentFormat,
          brandFit: deal.creatorBrandFit,
          safetyRisk: deal.creatorSafetyRisk,
        }
      : null,
    platform: deal.platform,
    status: deal.status,
    month: deal.month,
    publishedAt: deal.publishedAt,
    maturity: deal.maturity,
    returnTier: deal.returnTier,
    cost: round(deal.cost),
    intBudget: round(deal.intBudget),
    extBudget: round(deal.extBudget),
    expectedCpm: round(deal.expectedCpm),
    realisedCpm:
      deal.cost !== null && deal.viewCount !== null && deal.viewCount > 0
        ? round((deal.cost / deal.viewCount) * 1000)
        : null,
    // The cost that would have matched the original expected CPM at realised
    // views — a factual anchor for an under-delivery renegotiation, never a
    // recommended price.
    deliveryAlignedCost:
      deal.cost !== null && deal.deliveryPct !== null
        ? round((deal.cost * Math.min(deal.deliveryPct, 100)) / 100)
        : null,
    actualViews: round(deal.viewCount),
    expectedViews: round(deal.expectedViews),
    returnPct: round(deal.returnPct),
    appuD14: round(deal.appuD14),
    deliveryPct: round(deal.deliveryPct),
  };
}

function groupSummary(
  deals: readonly AlmediaDeal[],
  dimension: AlmediaDimensionId,
): Record<string, unknown> {
  const groups = groupByDimension(deals, dimension);
  const rows = groups.slice(0, MAX_SEGMENT_ROWS).map((group) => ({
    [dimension]: group.key,
    deals: group.deals,
    cost: Math.round(group.cost),
    intBudget: Math.round(group.intBudget),
    avgReturnPct: round(group.avgReturnPct),
    measuredReturns: group.measured,
    deliveryPct: round(group.deliveryPct),
    publishedSharePct: round(
      group.publishedShare === null ? null : group.publishedShare * 100,
    ),
  }));

  return {
    totalGroups: groups.length,
    includedGroups: rows.length,
    truncated: rows.length < groups.length,
    rows,
  };
}

/** Matured deals banded by the server-stamped tier, plus the two watch lists. */
function candidateBuckets(
  deals: readonly AlmediaDeal[],
): Record<string, AlmediaDeal[]> {
  const matured = deals.filter(
    (deal) => deal.returnPct !== null && deal.maturity.status === "matured",
  );
  const byReturnDesc = (a: AlmediaDeal, b: AlmediaDeal): number =>
    (b.returnPct ?? 0) - (a.returnPct ?? 0);
  const byReturnAsc = (a: AlmediaDeal, b: AlmediaDeal): number =>
    (a.returnPct ?? 0) - (b.returnPct ?? 0);
  const tier = (id: AlmediaDeal["returnTier"]): AlmediaDeal[] =>
    matured.filter((deal) => deal.returnTier === id);

  return {
    longterm: tier("longterm").sort(byReturnDesc),
    rebooking: tier("rebooking").sort(byReturnDesc),
    priceAdjusted: tier("price_adjusted").sort(byReturnAsc),
    drop: tier("drop").sort(byReturnAsc),
    underDelivery: deals
      .filter(
        (deal) =>
          deal.deliveryPct !== null &&
          deal.deliveryPct < 100 &&
          deal.maturity.status === "matured",
      )
      .sort((a, b) => (a.deliveryPct ?? 0) - (b.deliveryPct ?? 0)),
    notActionableYet: deals
      .filter((deal) => deal.hasCampaign && deal.maturity.status !== "matured")
      .sort((a, b) => (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "")),
  };
}

export interface AlmediaDigestInput {
  deals: readonly AlmediaDeal[];
  filters: AlmediaFilters;
  /** Absent when the scorecard failed to load; the digest says so explicitly. */
  scorecard?: AlmediaScorecardResponse | null;
  now?: Date;
}

export function buildAlmediaDigest(input: AlmediaDigestInput): string {
  const { deals, filters } = input;
  const scorecard = input.scorecard ?? null;
  const now = input.now ?? new Date();

  const activeFilters = activeFiltersOf(filters);
  const ignoredPlanFilters = Object.keys(activeFilters).filter(
    (key) => !PLAN_FILTER_KEYS.has(key as AlmediaDimensionId),
  );
  const planRows = (scorecard ? filterPlanRows(scorecard, filters) : [])
    .map((row) => ({
      cm: row.cm,
      market: row.market,
      month: row.month,
      targetAmount: row.targetAmount,
      committed: row.bookedAmount,
      remaining:
        row.targetAmount === null ? null : Math.max(0, row.targetAmount - row.bookedAmount),
      overTarget:
        row.targetAmount === null ? null : Math.max(0, row.bookedAmount - row.targetAmount),
      utilizationPct: round(row.utilization === null ? null : row.utilization * 100),
      pacePct: round(row.pace === null ? null : row.pace * 100),
      targetTiers: row.targetTiers,
      bookedTiers: row.bookedTiers,
      counts: row.counts,
      dropoutPct: round(row.dropoutRate === null ? null : row.dropoutRate * 100),
    }))
    .sort((a, b) => (b.remaining ?? -1) - (a.remaining ?? -1));

  const buckets = candidateBuckets(deals);
  const bucketRows = Object.values(buckets);
  const overview = enrichmentOverview(deals);
  const verticals = verticalPerformance(deals).slice(0, MAX_SEGMENT_ROWS);

  const createDigest = (candidateLimit: number): string => {
    const candidates = Object.fromEntries(
      Object.entries(buckets).map(([name, rows]) => {
        const included = rows.slice(0, candidateLimit).map(dealLine);

        return [
          name,
          {
            total: rows.length,
            included: included.length,
            truncated: included.length < rows.length,
            deals: included,
          },
        ];
      }),
    );
    const includedPlanRows = planRows.slice(0, MAX_PLAN_ROWS);

    return JSON.stringify({
      snapshot: {
        generatedAt: now.toISOString(),
        currentMonth: now.toISOString().slice(0, 7),
        nextCalendarMonth: nextIsoMonth(now),
        // Stated once, from the same constant the UI formats with, so the
        // analyst quotes the currency the reader is actually looking at.
        currency: ALMEDIA_CURRENCY,
        activeFilters,
      },
      evidenceRules: {
        returnActionsRequireMaturity:
          "matured means at least 14 days since publishedAt",
        returnTierIsServerStamped:
          "returnTier is derived server-side from returnPct; do not re-band it",
        candidateGroupsComplete: bucketRows.every(
          (rows) => rows.length <= candidateLimit,
        ),
        candidateLimitPerGroup: candidateLimit,
        planScope:
          "Plan rows are CM x market x month; other active filters cannot narrow plan totals.",
      },
      totals: totalsOf(deals),
      enrichment: {
        overview: {
          campaigns: overview.campaigns,
          enrichedCampaigns: overview.enrichedCampaigns,
          coveragePct: round(
            overview.coverageShare === null ? null : overview.coverageShare * 100,
          ),
          enrichedCreators: overview.enrichedCreators,
          controlledVerticals: overview.verticals,
          avgEngagementRatePct: round(overview.avgEngagementRatePct),
          lowSafetyRiskSharePct: round(
            overview.brandSafeShare === null ? null : overview.brandSafeShare * 100,
          ),
        },
        verticalPerformance: verticals.map((vertical) => ({
          vertical: vertical.vertical,
          campaigns: vertical.campaigns,
          measuredReturns: vertical.measuredReturns,
          enrichedCreators: vertical.enrichedCreators,
          cost: Math.round(vertical.cost),
          views: Math.round(vertical.views),
          d7Purchases: Math.round(vertical.d7Purchases),
          avgReturnPct: round(vertical.avgReturnPct),
          avgEngagementRatePct: round(vertical.avgEngagementRatePct),
          avgFollowers: round(vertical.avgFollowers),
          lowSafetyRiskSharePct: round(
            vertical.brandSafeShare === null ? null : vertical.brandSafeShare * 100,
          ),
        })),
      },
      segments: {
        byCm: groupSummary(deals, "cm"),
        byMarket: groupSummary(deals, "country"),
        byVertical: groupSummary(deals, "vertical"),
        byCategory: groupSummary(deals, "category"),
        bySize: groupSummary(deals, "sizeTier"),
      },
      candidates,
      plan: scorecard
        ? {
            available: true,
            appliedFilters: Object.fromEntries(
              Object.entries(activeFilters).filter(([key]) =>
                PLAN_FILTER_KEYS.has(key as AlmediaDimensionId),
              ),
            ),
            ignoredFilters: ignoredPlanFilters,
            totalRows: planRows.length,
            includedRows: includedPlanRows.length,
            truncated: includedPlanRows.length < planRows.length,
            rows: includedPlanRows,
          }
        : {
            available: false,
            reason: "Scorecard data was unavailable for this snapshot.",
            ignoredFilters: ignoredPlanFilters,
            totalRows: 0,
            includedRows: 0,
            truncated: false,
            rows: [],
          },
      unmeasured: {
        missingReturn: deals.filter((deal) => deal.returnPct === null).length,
        missingDelivery: deals.filter((deal) => deal.deliveryPct === null).length,
        unknownMaturity: deals.filter((deal) => deal.maturity.status === "unknown")
          .length,
      },
      painPoints: painPoints(deals)
        .slice(0, MAX_PAIN_POINTS)
        .map((point) => compactText(point.detail, 300)),
    });
  };

  for (const candidateLimit of CANDIDATE_LIMITS) {
    const digest = createDigest(candidateLimit);

    if (digest.length <= MAX_DIGEST_CHARS) {
      return digest;
    }
  }

  // Even the counts-only digest overflowed. Send the totals with an explicit
  // failure marker rather than a truncated JSON string the model would misread.
  return JSON.stringify({
    snapshot: { generatedAt: now.toISOString(), activeFilters },
    totals: totalsOf(deals),
    error: "Detailed evidence exceeded the analyst context limit.",
  });
}

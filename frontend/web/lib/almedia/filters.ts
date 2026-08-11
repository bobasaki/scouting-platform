import {
  ALMEDIA_DIMENSIONS,
  ALMEDIA_UNASSIGNED,
  type AlmediaDeal,
  type AlmediaDimensionId,
} from "@scouting-platform/contracts";

import type {
  AlmediaFilters,
  AlmediaTotals,
  DimensionGroup,
  PainPoint,
} from "./types";

/**
 * Client-side slicing of the deal feed. The join and its classifications happen
 * server-side; these are presentation aggregations that re-run instantly as the
 * user changes filters, with no extra requests.
 *
 * Ported from the standalone tracker's `dashboard/src/insights/enrich.ts`.
 */

export function dimensionValues(
  deal: AlmediaDeal,
  dimension: AlmediaDimensionId,
): string[] {
  if (dimension === "vertical") {
    return deal.verticals.length > 0
      ? [...new Set(deal.verticals)]
      : [ALMEDIA_UNASSIGNED];
  }

  const value = deal[dimension];

  return [value === null || value === "" ? ALMEDIA_UNASSIGNED : String(value)];
}

export function dimensionValue(
  deal: AlmediaDeal,
  dimension: AlmediaDimensionId,
): string {
  return dimensionValues(deal, dimension)[0] ?? ALMEDIA_UNASSIGNED;
}

export function filterDeals(
  deals: readonly AlmediaDeal[],
  filters: AlmediaFilters,
): AlmediaDeal[] {
  const active = ALMEDIA_DIMENSIONS.filter(({ id }) => filters[id] !== "all");

  if (active.length === 0) {
    return [...deals];
  }

  return deals.filter((deal) =>
    active.every(({ id }) => dimensionValues(deal, id).includes(filters[id])),
  );
}

function sum(values: ReadonlyArray<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function weightedReturn(deals: readonly AlmediaDeal[]): {
  value: number | null;
  measured: number;
} {
  let weighted = 0;
  let weight = 0;
  let measured = 0;

  for (const deal of deals) {
    if (deal.returnPct !== null && deal.cost !== null && deal.cost > 0) {
      weighted += deal.returnPct * deal.cost;
      weight += deal.cost;
      measured += 1;
    }
  }

  return { value: weight > 0 ? weighted / weight : null, measured };
}

function share(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

const LIVE_STATUSES = ["booked", "published", "longterm"];
const PUBLISHED_STATUSES = ["published", "longterm"];

export function groupByDimension(
  deals: readonly AlmediaDeal[],
  dimension: AlmediaDimensionId,
): DimensionGroup[] {
  const groups = new Map<string, AlmediaDeal[]>();

  for (const deal of deals) {
    for (const key of dimensionValues(deal, dimension)) {
      groups.set(key, [...(groups.get(key) ?? []), deal]);
    }
  }

  return [...groups.entries()]
    .map(([key, rows]) => {
      const expectedViews = sum(rows.map((row) => row.expectedViews));
      const actualViews = sum(rows.map((row) => row.viewCount));
      const withStatus = rows.filter((row) => row.status !== null);
      const live = withStatus.filter((row) => LIVE_STATUSES.includes(row.status ?? ""));
      const published = withStatus.filter((row) =>
        PUBLISHED_STATUSES.includes(row.status ?? ""),
      );
      const dropped = withStatus.filter((row) => row.status === "dropped");
      const { value: avgReturnPct, measured } = weightedReturn(rows);

      return {
        key,
        deals: rows.length,
        cost: sum(rows.map((row) => row.cost)),
        intBudget: sum(rows.map((row) => row.intBudget)),
        expectedViews,
        actualViews,
        deliveryPct: expectedViews > 0 ? (actualViews / expectedViews) * 100 : null,
        avgReturnPct,
        measured,
        publishedShare: share(published.length, live.length),
        droppedShare: share(dropped.length, withStatus.length),
      };
    })
    .sort((a, b) => b.cost + b.intBudget - (a.cost + a.intBudget));
}

/**
 * APPU (average payment per user) across a cohort, weighted by acquired users
 * (modeled signups = views × signupsPct). Campaigns without a user proxy count
 * once so a lone APPU value still contributes; null when none carry APPU.
 */
function weightedAppu(deals: readonly AlmediaDeal[]): number | null {
  let weighted = 0;
  let weight = 0;

  for (const deal of deals) {
    if (deal.appuD14 === null || !Number.isFinite(deal.appuD14)) {
      continue;
    }

    const users =
      deal.viewCount !== null && deal.signupsPct !== null
        ? deal.viewCount * deal.signupsPct
        : null;
    const rowWeight = users !== null && users > 0 ? users : 1;

    weighted += deal.appuD14 * rowWeight;
    weight += rowWeight;
  }

  return weight > 0 ? weighted / weight : null;
}

export function totalsOf(deals: readonly AlmediaDeal[]): AlmediaTotals {
  const expectedViews = sum(deals.map((deal) => deal.expectedViews));
  const actualViews = sum(deals.map((deal) => deal.viewCount));
  const withStatus = deals.filter((deal) => deal.status !== null);
  const live = withStatus.filter((deal) => LIVE_STATUSES.includes(deal.status ?? ""));
  const published = withStatus.filter((deal) =>
    PUBLISHED_STATUSES.includes(deal.status ?? ""),
  );

  return {
    deals: deals.length,
    campaigns: deals.filter((deal) => deal.hasCampaign).length,
    markets: new Set(
      deals
        .map((deal) => deal.country)
        .filter((country): country is string => country !== null && country !== ""),
    ).size,
    cost: sum(deals.map((deal) => deal.cost)),
    intBudget: sum(deals.map((deal) => deal.intBudget)),
    expectedViews,
    actualViews,
    deliveryPct: expectedViews > 0 ? (actualViews / expectedViews) * 100 : null,
    avgReturnPct: weightedReturn(deals).value,
    publishedShare: share(published.length, live.length),
    avgAppuD14: weightedAppu(deals),
  };
}

/** Best measurable deals, ranked by return %, for the per-CM leaderboard. */
export function bestDealsByCm(
  deals: readonly AlmediaDeal[],
  topPerCm = 3,
): Array<{ cm: string; avgReturnPct: number | null; deals: AlmediaDeal[] }> {
  const withReturn = deals.filter((deal) => deal.returnPct !== null);
  const byCm = new Map<string, AlmediaDeal[]>();

  for (const deal of withReturn) {
    const cm = deal.cm ?? ALMEDIA_UNASSIGNED;

    byCm.set(cm, [...(byCm.get(cm) ?? []), deal]);
  }

  return [...byCm.entries()]
    .map(([cm, rows]) => ({
      cm,
      avgReturnPct: weightedReturn(rows).value,
      deals: [...rows]
        .sort((a, b) => (b.returnPct ?? 0) - (a.returnPct ?? 0))
        .slice(0, topPerCm),
    }))
    .sort((a, b) => (b.avgReturnPct ?? -1) - (a.avgReturnPct ?? -1));
}

const PAIN_DIMENSIONS: AlmediaDimensionId[] = ["country", "vertical", "sizeTier"];
const MIN_MEASURED = 2;
const MIN_DEALS_FOR_PUBLISHING = 3;

/** Rule-based pain points per market / vertical / client size. */
export function painPoints(deals: readonly AlmediaDeal[]): PainPoint[] {
  const points: PainPoint[] = [];
  const label = (dimension: AlmediaDimensionId): string =>
    ALMEDIA_DIMENSIONS.find((entry) => entry.id === dimension)?.label ?? dimension;

  for (const dimension of PAIN_DIMENSIONS) {
    for (const group of groupByDimension(deals, dimension)) {
      if (group.key === ALMEDIA_UNASSIGNED && dimension !== "sizeTier") {
        continue;
      }

      const where = `${label(dimension)} ${group.key}`;

      if (group.avgReturnPct !== null && group.measured >= MIN_MEASURED) {
        if (group.avgReturnPct < 50) {
          points.push({
            dimension,
            key: group.key,
            severity: "high",
            issue: "low-return",
            detail: `${where}: avg return ${group.avgReturnPct.toFixed(0)}% across ${group.measured} measured deals. Drop tier; renegotiate or exit.`,
          });
        } else if (group.avgReturnPct < 80) {
          points.push({
            dimension,
            key: group.key,
            severity: "medium",
            issue: "low-return",
            detail: `${where}: avg return ${group.avgReturnPct.toFixed(0)}%. Rebook only with price adjustment.`,
          });
        }
      }

      if (group.deliveryPct !== null && group.expectedViews > 0 && group.deliveryPct < 70) {
        points.push({
          dimension,
          key: group.key,
          severity: group.deliveryPct < 50 ? "high" : "medium",
          issue: "under-delivery",
          detail: `${where}: views delivered at ${group.deliveryPct.toFixed(0)}% of expectation (${Math.round(group.actualViews).toLocaleString()} vs ${Math.round(group.expectedViews).toLocaleString()}). CPMs are priced too optimistically.`,
        });
      }

      if (
        group.publishedShare !== null &&
        group.deals >= MIN_DEALS_FOR_PUBLISHING &&
        group.publishedShare < 0.5
      ) {
        points.push({
          dimension,
          key: group.key,
          severity: "medium",
          issue: "publishing-lag",
          detail: `${where}: only ${(group.publishedShare * 100).toFixed(0)}% of booked deals are published. Chase creators or restructure timelines.`,
        });
      }

      if (group.droppedShare !== null && group.droppedShare > 0.25 && group.deals >= 4) {
        points.push({
          dimension,
          key: group.key,
          severity: "high",
          issue: "high-dropout",
          detail: `${where}: ${(group.droppedShare * 100).toFixed(0)}% of deals dropped. Review outreach quality and deal terms.`,
        });
      }
    }
  }

  const severityRank = { high: 0, medium: 1 } as const;

  return points.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

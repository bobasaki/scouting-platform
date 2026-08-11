import type { AlmediaDeal, AlmediaDimensionId } from "@scouting-platform/contracts";

import { dimensionValues, weightedReturn } from "./filters";
import { monthLabel } from "./labels";

/**
 * Pure aggregations for the standard performance-marketing charts:
 * return distribution, unit economics, a segment cross-tab (heatmap), spend
 * concentration (Pareto), the monthly return trend, rebooking / round-over-round
 * lift, and the maturity mix. No I/O.
 *
 * Ported from the standalone tracker's `dashboard/src/insights/charts.ts`;
 * maturity now reads the server-stamped classification on each deal.
 */

function sum(values: ReadonlyArray<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

// ── Return distribution (histogram) ─────────────────────────────────────────

export type ReturnTone = "bad" | "warn" | "neutral" | "good";

export interface ReturnBand {
  label: string;
  /** Inclusive lower bound, exclusive upper bound (Infinity for the top band). */
  min: number;
  max: number;
  tone: ReturnTone;
  deals: number;
  /** Almedia spend sitting in this band. */
  cost: number;
}

const RETURN_BANDS: ReadonlyArray<Omit<ReturnBand, "deals" | "cost">> = [
  { label: "<50%", min: Number.NEGATIVE_INFINITY, max: 50, tone: "bad" },
  { label: "50–80%", min: 50, max: 80, tone: "warn" },
  { label: "80–100%", min: 80, max: 100, tone: "neutral" },
  { label: "100–150%", min: 100, max: 150, tone: "good" },
  { label: "≥150%", min: 150, max: Number.POSITIVE_INFINITY, tone: "good" },
];

export interface ReturnDistribution {
  bands: ReturnBand[];
  /** Deals carrying a measured return %. */
  measured: number;
  /** Median return %, or null when nothing is measured. */
  medianReturnPct: number | null;
}

type MeasuredDeal = AlmediaDeal & { returnPct: number };

function measuredDealsOf(deals: readonly AlmediaDeal[]): MeasuredDeal[] {
  return deals.filter((deal): deal is MeasuredDeal => deal.returnPct !== null);
}

export function returnDistribution(deals: readonly AlmediaDeal[]): ReturnDistribution {
  const measuredDeals = measuredDealsOf(deals);
  const bands: ReturnBand[] = RETURN_BANDS.map((band) => {
    const rows = measuredDeals.filter(
      (deal) => deal.returnPct >= band.min && deal.returnPct < band.max,
    );

    return { ...band, deals: rows.length, cost: sum(rows.map((row) => row.cost)) };
  });

  const sorted = [...measuredDeals].sort((a, b) => a.returnPct - b.returnPct);
  const medianReturnPct =
    sorted[Math.floor((sorted.length - 1) / 2)]?.returnPct ?? null;

  return { bands, measured: measuredDeals.length, medianReturnPct };
}

// ── Unit economics (CPA view) ────────────────────────────────────────────────

export interface UnitEconomics {
  views: number;
  /** Almedia-modeled signups = Σ views × signupsPct (signupsPct is a fraction). */
  signups: number;
  d7Purchases: number;
  cost: number;
  /** Realised eCPM = cost ÷ views × 1000. */
  realisedCpm: number | null;
  /** Cost-weighted expected CPM the prices were set on. */
  expectedCpm: number | null;
  /** Signups ÷ views, as a fraction. */
  signupRate: number | null;
  costPerSignup: number | null;
  costPerPurchase: number | null;
  /** Average payment per user by D14, weighted by acquired users. */
  appuD14: number | null;
  measuredCampaigns: number;
}

/** signupsPct is a view→signup rate (fraction); absolute signups = views × rate. */
function signupsOf(deal: AlmediaDeal): number | null {
  if (deal.viewCount === null || deal.signupsPct === null) {
    return null;
  }

  return deal.viewCount * deal.signupsPct;
}

/**
 * APPU (average payment per user) weighted by the users behind each campaign.
 * Modeled signups (views × signupsPct) are the best available user-count proxy;
 * when a campaign lacks them we fall back to counting it as one observation so a
 * single APPU value still contributes. Returns null when nothing carries APPU.
 */
export function weightedAppu(deals: readonly AlmediaDeal[]): number | null {
  let weighted = 0;
  let weight = 0;

  for (const deal of deals) {
    if (deal.appuD14 === null || !Number.isFinite(deal.appuD14)) {
      continue;
    }

    const users = signupsOf(deal);
    const rowWeight = users !== null && users > 0 ? users : 1;

    weighted += deal.appuD14 * rowWeight;
    weight += rowWeight;
  }

  return weight > 0 ? weighted / weight : null;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/**
 * Cost-efficiency metrics. Each figure is computed over the cohort that
 * actually carries its inputs, so partial data never distorts the rest. These
 * are unit costs, deliberately NOT chained into a conversion funnel: Almedia's
 * signup and purchase figures are independently modeled and do not nest.
 */
export function unitEconomics(deals: readonly AlmediaDeal[]): UnitEconomics {
  const withCampaign = deals.filter((deal) => deal.hasCampaign);
  const costOf = (rows: readonly AlmediaDeal[]): number =>
    sum(rows.map((row) => row.cost));

  const viewCohort = withCampaign.filter(
    (deal) => deal.cost !== null && deal.viewCount !== null,
  );
  const signupCohort = viewCohort.filter((deal) => deal.signupsPct !== null);
  const purchaseCohort = withCampaign.filter(
    (deal) => deal.cost !== null && deal.d7Purchases !== null,
  );
  // Expected and realised CPM share this cohort and the same cost÷views basis,
  // so the two bars are directly comparable and track the delivery metric.
  const cpmCohort = viewCohort.filter((deal) => deal.expectedViews !== null);

  const cohortViews = sum(cpmCohort.map((deal) => deal.viewCount));
  const cohortExpectedViews = sum(cpmCohort.map((deal) => deal.expectedViews));
  const signups = sum(signupCohort.map(signupsOf));
  const signupViews = sum(signupCohort.map((deal) => deal.viewCount));
  const purchases = sum(purchaseCohort.map((deal) => deal.d7Purchases));

  return {
    views: sum(withCampaign.map((deal) => deal.viewCount)),
    signups,
    d7Purchases: sum(withCampaign.map((deal) => deal.d7Purchases)),
    cost: costOf(withCampaign),
    realisedCpm: cohortViews > 0 ? (costOf(cpmCohort) / cohortViews) * 1000 : null,
    expectedCpm:
      cohortExpectedViews > 0 ? (costOf(cpmCohort) / cohortExpectedViews) * 1000 : null,
    signupRate: ratio(signups, signupViews),
    costPerSignup: ratio(costOf(signupCohort), signups),
    costPerPurchase: ratio(costOf(purchaseCohort), purchases),
    appuD14: weightedAppu(withCampaign),
    measuredCampaigns: viewCohort.length,
  };
}

// ── Segment cross-tab (heatmap) ──────────────────────────────────────────────

export interface HeatCell {
  row: string;
  col: string;
  avgReturnPct: number | null;
  cost: number;
  deals: number;
  measured: number;
}

export interface CrossTab {
  rows: string[];
  cols: string[];
  cells: HeatCell[];
}

/**
 * Two-dimensional return matrix (e.g. market × vertical). Rows and columns are
 * ordered by total spend so the busiest segments lead.
 */
export function crossTab(
  deals: readonly AlmediaDeal[],
  rowDim: AlmediaDimensionId,
  colDim: AlmediaDimensionId,
): CrossTab {
  const spendByKey = (dimension: AlmediaDimensionId): string[] => {
    const totals = new Map<string, number>();

    for (const deal of deals) {
      for (const key of dimensionValues(deal, dimension)) {
        totals.set(key, (totals.get(key) ?? 0) + (deal.cost ?? deal.intBudget ?? 0));
      }
    }

    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  };

  const rows = spendByKey(rowDim);
  const cols = spendByKey(colDim);
  const cells: HeatCell[] = [];

  for (const row of rows) {
    for (const col of cols) {
      const group = deals.filter(
        (deal) =>
          dimensionValues(deal, rowDim).includes(row) &&
          dimensionValues(deal, colDim).includes(col),
      );

      if (group.length === 0) {
        continue;
      }

      const { value, measured } = weightedReturn(group);

      cells.push({
        row,
        col,
        avgReturnPct: value,
        cost: sum(group.map((deal) => deal.cost)),
        deals: group.length,
        measured,
      });
    }
  }

  return { rows, cols, cells };
}

// ── Spend concentration (Pareto) ─────────────────────────────────────────────

export interface ConcentrationRow {
  channelName: string;
  cost: number;
  /** Share of total spend for this single channel. */
  share: number;
  /** Cumulative share through this row (rows are spend-descending). */
  cumulativeShare: number;
}

export interface Concentration {
  rows: ConcentrationRow[];
  /** Spend not shown in the top-N rows. */
  othersCost: number;
  totalCost: number;
  /** Share of spend carried by the top-N channels. */
  topShare: number;
}

/** Pareto view of spend: the top-N channels by cost with cumulative share. */
export function spendConcentration(
  deals: readonly AlmediaDeal[],
  topN = 10,
): Concentration {
  const byChannel = new Map<string, number>();

  for (const deal of deals) {
    if (deal.cost === null || deal.cost <= 0) {
      continue;
    }

    byChannel.set(deal.channelName, (byChannel.get(deal.channelName) ?? 0) + deal.cost);
  }

  const ranked = [...byChannel.entries()].sort((a, b) => b[1] - a[1]);
  const totalCost = ranked.reduce((total, [, cost]) => total + cost, 0);
  const top = ranked.slice(0, topN);

  let running = 0;
  const rows: ConcentrationRow[] = top.map(([channelName, cost]) => {
    running += cost;

    return {
      channelName,
      cost,
      share: totalCost > 0 ? cost / totalCost : 0,
      cumulativeShare: totalCost > 0 ? running / totalCost : 0,
    };
  });

  return {
    rows,
    othersCost: totalCost - running,
    totalCost,
    topShare: totalCost > 0 ? running / totalCost : 0,
  };
}

// ── Efficiency scatter (cost vs return) ──────────────────────────────────────

export interface ScatterPoint {
  channelName: string;
  cost: number;
  returnPct: number;
  views: number | null;
  tone: ReturnTone;
}

function toneOfReturn(returnPct: number): ReturnTone {
  if (returnPct > 100) return "good";
  if (returnPct >= 80) return "neutral";
  if (returnPct >= 50) return "warn";
  return "bad";
}

/** One point per measured deal: spend on X, return% on Y, views as bubble size. */
export function efficiencyPoints(deals: readonly AlmediaDeal[]): ScatterPoint[] {
  return measuredDealsOf(deals)
    .filter((deal) => deal.cost !== null && deal.cost > 0)
    .map((deal) => ({
      channelName: deal.channelName,
      cost: deal.cost ?? 0,
      returnPct: deal.returnPct,
      views: deal.viewCount,
      tone: toneOfReturn(deal.returnPct),
    }));
}

// ── Monthly return trend ─────────────────────────────────────────────────────

export interface TrendPoint {
  /** YYYY-MM. */
  month: string;
  /** "Jul 2026" — full year so it never reads as a day. */
  label: string;
  cost: number;
  avgReturnPct: number | null;
  deals: number;
  measured: number;
}

/**
 * Cost-weighted return and spend per publish month — the executive "how are we
 * trending" read. Grouped by the campaign's publish month so it tracks realised
 * performance timing, not when a deal was booked.
 */
export function monthlyTrend(deals: readonly AlmediaDeal[]): TrendPoint[] {
  const groups = new Map<string, AlmediaDeal[]>();

  for (const deal of deals) {
    if (!deal.hasCampaign) {
      continue;
    }

    const month = deal.publishedAt?.slice(0, 7) ?? deal.month;

    if (!month) {
      continue;
    }

    groups.set(month, [...(groups.get(month) ?? []), deal]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => {
      const { value, measured } = weightedReturn(rows);

      return {
        month,
        label: monthLabel(month),
        cost: sum(rows.map((row) => row.cost)),
        avgReturnPct: value,
        deals: rows.length,
        measured,
      };
    });
}

// ── Rebooking / round-over-round lift ────────────────────────────────────────

/** Booking round parsed from the campaign name suffix (…_R2); null when absent. */
export function roundOf(campaignName: string | null): number | null {
  if (!campaignName) {
    return null;
  }

  const match = /_R(\d+)\b/iu.exec(campaignName);

  return match?.[1] === undefined ? null : Number(match[1]);
}

export interface RoundGroup {
  round: number;
  /** "R1" … "R4+". */
  label: string;
  channels: number;
  deals: number;
  cost: number;
  avgReturnPct: number | null;
  measured: number;
}

export interface RoundAnalysis {
  rounds: RoundGroup[];
  /** Distinct channels booked more than once (max round ≥ 2). */
  rebookedChannels: number;
  totalChannels: number;
  rebookRate: number | null;
}

const MAX_ROUND_BUCKET = 4;

/**
 * Round-over-round performance: does return improve as we re-engage a creator?
 * A campaign with no round suffix counts as round 1 (a first/only booking).
 * Rounds at or above 4 are bucketed together.
 */
export function roundAnalysis(deals: readonly AlmediaDeal[]): RoundAnalysis {
  const withCampaign = deals.filter((deal) => deal.hasCampaign);
  const buckets = new Map<number, AlmediaDeal[]>();
  const maxRoundByChannel = new Map<string, number>();

  for (const deal of withCampaign) {
    const round = roundOf(deal.campaignName) ?? 1;
    const bucket = Math.min(round, MAX_ROUND_BUCKET);

    buckets.set(bucket, [...(buckets.get(bucket) ?? []), deal]);
    maxRoundByChannel.set(
      deal.channelKey,
      Math.max(maxRoundByChannel.get(deal.channelKey) ?? 0, round),
    );
  }

  const rounds: RoundGroup[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, rows]) => {
      const { value, measured } = weightedReturn(rows);

      return {
        round,
        label: round >= MAX_ROUND_BUCKET ? `R${MAX_ROUND_BUCKET}+` : `R${round}`,
        channels: new Set(rows.map((row) => row.channelKey)).size,
        deals: rows.length,
        cost: sum(rows.map((row) => row.cost)),
        avgReturnPct: value,
        measured,
      };
    });

  const totalChannels = maxRoundByChannel.size;
  const rebookedChannels = [...maxRoundByChannel.values()].filter(
    (round) => round >= 2,
  ).length;

  return {
    rounds,
    rebookedChannels,
    totalChannels,
    rebookRate: totalChannels > 0 ? rebookedChannels / totalChannels : null,
  };
}

// ── Maturity mix ─────────────────────────────────────────────────────────────

export interface MaturityBucket {
  deals: number;
  cost: number;
  avgReturnPct: number | null;
  measured: number;
}

export interface MaturityMix {
  matured: MaturityBucket;
  maturing: MaturityBucket;
  unknown: MaturityBucket;
}

function maturityBucket(deals: readonly AlmediaDeal[]): MaturityBucket {
  const { value, measured } = weightedReturn(deals);

  return {
    deals: deals.length,
    cost: sum(deals.map((deal) => deal.cost)),
    avgReturnPct: value,
    measured,
  };
}

/**
 * Split live campaigns by maturity (Almedia gives a single return snapshot, not
 * a maturation curve, so this is the honest stand-in: a matured return is
 * trustworthy; a maturing one is still accruing and should not be judged yet).
 */
export function maturityMix(deals: readonly AlmediaDeal[]): MaturityMix {
  const byStatus = {
    matured: [] as AlmediaDeal[],
    maturing: [] as AlmediaDeal[],
    unknown: [] as AlmediaDeal[],
  };

  for (const deal of deals) {
    if (!deal.hasCampaign) {
      continue;
    }

    byStatus[deal.maturity.status].push(deal);
  }

  return {
    matured: maturityBucket(byStatus.matured),
    maturing: maturityBucket(byStatus.maturing),
    unknown: maturityBucket(byStatus.unknown),
  };
}

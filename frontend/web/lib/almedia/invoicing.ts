import type {
  AlmediaDeal,
  AlmediaInvoiceTierId,
  AlmediaMaturityStatus,
  BookingInvoice,
} from "@scouting-platform/contracts";

import { roundOf } from "./charts";
import { monthLabel } from "./labels";

/**
 * Client billing model (two calendar months, in USD — the Almedia `cost` field
 * is dollars). Every campaign is invoiced twice:
 *
 *   1. Publish month  → the raw Almedia `cost` for each campaign.
 *   2. Next month     → a performance fee on the whole month's batch.
 *
 * The Almedia `cost` embeds our base 20%, so the internal price is `INT =
 * cost / 1.2`. The month's blended return picks one commission tier, and the
 * client's total charge for that batch is `Σ INT × (1 + commission)`. Since the
 * cost was already invoiced up front, the performance fee is the remainder:
 *
 *   performance fee = Σ INT × (1 + commission) − Σ cost
 *
 * At the base tier (commission 20%) `INT × 1.2 = cost`, so the fee is exactly
 * zero and only the up-front cost is billed. The commission steps up with the
 * batch's blended return on internal cost — `Σ media spend ÷ Σ INT`, the rate
 * card's return multiple `x` (shown here ×100). The denominator is INT, NOT
 * cost: on a batch that returns 86.7% against cost, INT is 1.2× smaller, so `x`
 * is 104% and the fee is real.
 *
 * Matured channels (14+ days) can be invoiced at their final tier. A channel
 * that hasn't matured can be invoiced early; the snapshot in `booking_invoices`
 * freezes the amount at that moment and, once it matures, the difference is
 * what still needs charging.
 */

export interface InvoiceTier {
  id: AlmediaInvoiceTierId;
  label: string;
  /** Commission fraction on top of INT, e.g. 0.25 → client charge INT × 1.25. */
  markup: number;
  /** Exclusive upper bound of the return % for this tier (Infinity for the top). */
  maxReturn: number;
}

/** Inclusive lower bounds from the rate card, as exclusive upper bounds. */
export const INVOICE_TIERS: readonly InvoiceTier[] = [
  { id: "c20", label: "< 100%", markup: 0.2, maxReturn: 100 },
  { id: "c25", label: "100–109%", markup: 0.25, maxReturn: 110 },
  { id: "c30", label: "110–129%", markup: 0.3, maxReturn: 130 },
  { id: "c40", label: "130–149%", markup: 0.4, maxReturn: 150 },
  { id: "c50", label: "150–179%", markup: 0.5, maxReturn: 180 },
  { id: "c60", label: "180–249%", markup: 0.6, maxReturn: 250 },
  { id: "c80", label: "250–329%", markup: 0.8, maxReturn: 330 },
  { id: "c100", label: "≥ 330%", markup: 1, maxReturn: Number.POSITIVE_INFINITY },
];

const BASE_TIER: InvoiceTier = INVOICE_TIERS[0] as InvoiceTier;

/** The base 20% commission already baked into the Almedia cost field. */
export const BASE_MARKUP = 0.2;

/**
 * The Freecash client was invoiced the up-front cost (Stage 1 only, no
 * performance fees) for every publish month through this key. Later months'
 * cost and every month's performance fee are still outstanding.
 */
export const COST_INVOICED_THROUGH = "2026-06";

/** The tier a return % falls into. A missing return is treated as the base tier. */
export function invoiceTier(returnPct: number | null): InvoiceTier {
  const value = returnPct ?? 0;

  return INVOICE_TIERS.find((tier) => value < tier.maxReturn) ?? BASE_TIER;
}

/** The internal price: Almedia cost with the embedded base commission stripped. */
export function intPrice(cost: number): number {
  return cost / (1 + BASE_MARKUP);
}

/**
 * The full client charge for a campaign across both months: INT price (cost /
 * 1.2) marked up by the return-based commission. The up-front cost invoice plus
 * the next month's performance fee add up to exactly this.
 */
export function invoiceAmount(
  cost: number | null,
  returnPct: number | null,
): number | null {
  if (cost === null || !Number.isFinite(cost)) {
    return null;
  }

  return intPrice(cost) * (1 + invoiceTier(returnPct).markup);
}

/**
 * Media spend a campaign drove — the revenue people spent because of it:
 * `returnPct × cost / 100` (a campaign's return is exactly media spend ÷ cost).
 * Null until a return figure lands.
 */
export function mediaSpend(
  returnPct: number | null,
  cost: number | null,
): number | null {
  if (returnPct === null || !Number.isFinite(returnPct)) {
    return null;
  }

  if (cost === null || !Number.isFinite(cost)) {
    return null;
  }

  return (returnPct * cost) / 100;
}

/**
 * The batch's blended return on internal cost — Σ media spend ÷ Σ INT × 100.
 * The denominator is INT, NOT cost: the commission tier is selected on how the
 * media spend compares to what we actually pay creators, so a batch returning
 * 86.7% against cost is 104% against INT. A member with no measured return yet
 * still counts its INT in the denominator, dragging the blend down. This single
 * number picks one commission tier for the whole batch. Null when Σ INT is zero.
 */
export function blendedReturn(
  members: ReadonlyArray<{ int: number; mediaSpend: number | null }>,
): number | null {
  let spend = 0;
  let int = 0;

  for (const member of members) {
    int += member.int;
    spend += member.mediaSpend ?? 0;
  }

  return int > 0 ? (spend / int) * 100 : null;
}

/** A campaign inside a monthly batch, with whether it counts toward the bill. */
export interface BatchMember {
  /** Unique Almedia campaign name — the invoice identity. */
  campaignName: string;
  channelName: string;
  round: number | null;
  /** Almedia cost (USD) — invoiced up front in the publish month. */
  cost: number;
  /** INT price = Almedia cost ÷ 1.2 (USD). */
  int: number;
  /** Media spend the campaign drove = returnPct × cost ÷ 100 (USD). */
  mediaSpend: number | null;
  /** This member's own return % against cost; null with no return yet. */
  memberReturn: number | null;
  /**
   * The tier this member would earn on its own — per-channel reference.
   * Selected on the INT-based return (memberReturn × 1.2), the same denominator
   * the batch fee uses, so it can read higher than `memberReturn` shown.
   */
  ownTier: InvoiceTier;
  status: AlmediaMaturityStatus;
  daysRemaining: number | null;
  /** Publish month key this member belongs to, e.g. "2026-08". */
  month: string;
  /** Counted in the bill now — every matured member, plus any opted-in one. */
  included: boolean;
  /** Stage 1: the Almedia cost billed up front in the publish month. */
  baseAmount: number;
  /** The blended batch tier used for this member's invoice allocation. */
  batchTier: InvoiceTier;
  /**
   * Stage 2: this member's share of the batch performance fee, billed the next
   * calendar month — max(0, INT × (1 + batch commission) − cost). Zero for a
   * member not counted in the batch, or when the batch sits at the base tier.
   */
  performanceFee: number;
  /** Full snapshot amount at the batch tier: cost + allocated performance fee. */
  invoiceAmount: number;
  /** The recorded snapshot for this campaign, if a bill has been sent. */
  invoice: BookingInvoice | null;
  /**
   * What is still chargeable beyond the recorded snapshot: the campaign's full
   * commissioned charge minus what was actually billed, floored at zero. This
   * is the top-up owed when a campaign was invoiced before it matured and then
   * climbed a tier. Null when nothing has been invoiced yet.
   */
  topUp: number | null;
}

/**
 * One publish month's batch invoice. Stage 1 (cost up front) bills the raw
 * Almedia cost of EVERY campaign published that month, regardless of maturity —
 * the cost is known the moment it publishes. Stage 2 (performance fee) waits for
 * the return: only matured (or opted-in) members set the blended return, which
 * picks one commission tier, and the fee tops the matured cohort's already-billed
 * cost up to Σ INT × (1 + commission). Strong performers carry the flops.
 */
export interface InvoiceBatch {
  month: string;
  label: string;
  /** Every campaign published that month, largest cost first. */
  members: BatchMember[];
  /** Total campaigns published that month. */
  memberCount: number;
  /** Matured (or opted-in) channels — these set the blended return and the fee. */
  includedCount: number;
  /** Still-maturing channels available to opt into the fee blend. */
  maturingCount: number;
  /** Members with a recorded invoice snapshot. */
  invoicedCount: number;
  /** Σ chargeable top-ups across members that were billed before maturing. */
  topUpTotal: number;
  /** Σ media spend ÷ Σ INT × 100 across the included members. */
  blendedReturn: number | null;
  /** The single commission tier the fee bills at. */
  tier: InvoiceTier;
  /** Σ INT price (cost ÷ 1.2) across the included members — the fee basis. */
  intTotal: number;
  /** Stage 1 cost still outstanding after the cutoff and recorded snapshots. */
  baseTotal: number;
  /** Stage 1 cost already covered by the historical cutoff or invoice snapshots. */
  invoicedBaseTotal: number;
  /**
   * Stage 2 fee still outstanding. Unrecorded members contribute their batch-tier
   * allocation; recorded members contribute only a positive top-up.
   */
  performanceFee: number;
  /** Total still due for the month = baseTotal + performanceFee. */
  amount: number;
  /** The calendar month the fee is billed, e.g. publish "2026-06" → "2026-07". */
  feeMonth: string;
  /** The up-front cost for this publish month has already been invoiced. */
  costInvoiced: boolean;
  /** The whole cohort has matured, so the fee is final (not still moving). */
  feeSettled: boolean;
}

/** The calendar month after a `YYYY-MM` key, e.g. "2026-12" → "2027-01". */
function nextMonth(month: string): string {
  const { year, index } = splitMonth(month);

  return index >= 12
    ? formatMonth(year + 1, 1)
    : formatMonth(year, index + 1);
}

/** The calendar month before a `YYYY-MM` key, e.g. "2026-01" → "2025-12". */
export function prevMonth(month: string): string {
  const { year, index } = splitMonth(month);

  return index <= 1 ? formatMonth(year - 1, 12) : formatMonth(year, index - 1);
}

function splitMonth(month: string): { year: number; index: number } {
  const [year, index] = month.split("-");

  return { year: Number(year), index: Number(index) };
}

function formatMonth(year: number, index: number): string {
  return `${year}-${String(index).padStart(2, "0")}`;
}

/** Round a dollar amount to cents; `|| 0` normalises a rounded −0 back to 0. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}

/** A deal can be invoiced only once we have a cost to mark up and a campaign key. */
function isEligible(
  deal: AlmediaDeal,
): deal is AlmediaDeal & { cost: number; campaignName: string } {
  return (
    deal.campaignName !== null &&
    deal.cost !== null &&
    Number.isFinite(deal.cost) &&
    deal.cost > 0
  );
}

/**
 * A readable creator label. Booked channels carry their real name; campaign-only
 * deals fall back to the raw Almedia campaign name, so strip its `_PLATFORM_R#`
 * suffix (the round shows as its own badge). Casing/spacing is preserved.
 */
function displayName(channelName: string): string {
  return channelName.replace(/_[A-Za-z0-9]+_R\d+[A-Za-z0-9]*$/iu, "").trim() || channelName;
}

export interface InvoiceBatchOptions {
  /**
   * Still-maturing campaigns the user opted into the fee blend. Opting one in
   * re-blends the return and can move the whole batch's fee tier.
   */
  includedCampaigns?: ReadonlySet<string>;
  /** Recorded invoice snapshots, keyed by campaign name. */
  invoices?: ReadonlyMap<string, BookingInvoice>;
}

/**
 * Group eligible campaigns by publish month into batch invoices. INT is derived
 * from the Almedia cost (cost ÷ 1.2), so every campaign with a cost is billable.
 * Stage 1 (cost up front) starts with every member, then removes cost covered by
 * the historical cutoff or a recorded snapshot. Stage 2 counts only matured
 * members, plus any opted-in maturing one, and removes recorded charges except
 * for a positive top-up. Most recent month first.
 */
export function buildInvoiceBatches(
  deals: readonly AlmediaDeal[],
  options: InvoiceBatchOptions = {},
): InvoiceBatch[] {
  const includedCampaigns = options.includedCampaigns ?? new Set<string>();
  const invoices = options.invoices ?? new Map<string, BookingInvoice>();
  const byMonth = new Map<string, BatchMember[]>();

  for (const deal of deals.filter(isEligible)) {
    if (deal.publishedAt === null) {
      continue;
    }

    const month = deal.publishedAt.slice(0, 7);

    if (!/^\d{4}-\d{2}$/u.test(month)) {
      continue;
    }

    const int = intPrice(deal.cost);
    const memberReturn = deal.returnPct;
    const invoice = invoices.get(deal.campaignName) ?? null;

    byMonth.set(month, [
      ...(byMonth.get(month) ?? []),
      {
        campaignName: deal.campaignName,
        channelName: displayName(deal.channelName),
        round: roundOf(deal.campaignName),
        cost: deal.cost,
        int,
        mediaSpend: mediaSpend(memberReturn, deal.cost),
        memberReturn,
        ownTier: invoiceTier(
          memberReturn === null ? null : memberReturn * (1 + BASE_MARKUP),
        ),
        status: deal.maturity.status,
        daysRemaining: deal.maturity.daysRemaining,
        month,
        included:
          deal.maturity.status === "matured" ||
          includedCampaigns.has(deal.campaignName),
        baseAmount: deal.cost,
        batchTier: BASE_TIER,
        performanceFee: 0,
        invoiceAmount: deal.cost,
        invoice,
        topUp: null,
      },
    ]);
  }

  // A member's performance fee: its full client charge (INT × (1 + commission))
  // minus the cost already invoiced up front, floored at zero.
  const memberFee = (int: number, cost: number, markup: number): number =>
    toCents(Math.max(0, int * (1 + markup) - cost));

  return [...byMonth.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, members]) => {
      const included = members.filter((member) => member.included);
      const blended = blendedReturn(included);
      const tier = invoiceTier(blended);
      const intTotal = included.reduce((sum, member) => sum + member.int, 0);
      const maturingCount = members.filter(
        (member) => member.status !== "matured",
      ).length;
      const withFee = members.map((member) => {
        const performanceFee = member.included
          ? memberFee(member.int, member.cost, tier.markup)
          : 0;
        const currentAmount = toCents(member.cost + performanceFee);

        return {
          ...member,
          batchTier: tier,
          performanceFee,
          invoiceAmount: currentAmount,
          topUp:
            member.invoice === null
              ? null
              : toCents(Math.max(0, currentAmount - member.invoice.amount)),
        };
      });
      // The historical cutoff covers every earlier cost. A later invoice
      // snapshot covers that campaign's cost as well as its fee allocation.
      const baseTotal = toCents(
        withFee.reduce(
          (sum, member) =>
            sum +
            (month > COST_INVOICED_THROUGH && member.invoice === null
              ? member.cost
              : 0),
          0,
        ),
      );
      const invoicedBaseTotal = toCents(
        withFee.reduce((sum, member) => sum + member.cost, 0) - baseTotal,
      );
      // An unrecorded member owes its full batch fee allocation. A recorded
      // member owes only a positive top-up if the batch later climbs a tier.
      const performanceFee = toCents(
        withFee.reduce(
          (sum, member) =>
            sum +
            (member.invoice === null
              ? member.performanceFee
              : (member.topUp ?? 0)),
          0,
        ),
      );

      return {
        month,
        label: monthLabel(month),
        members: withFee.sort((left, right) => right.cost - left.cost),
        memberCount: members.length,
        includedCount: included.length,
        maturingCount,
        invoicedCount: members.filter((member) => member.invoice !== null).length,
        topUpTotal: toCents(
          withFee.reduce((sum, member) => sum + (member.topUp ?? 0), 0),
        ),
        blendedReturn: blended,
        tier,
        intTotal,
        baseTotal,
        invoicedBaseTotal,
        performanceFee,
        amount: toCents(baseTotal + performanceFee),
        feeMonth: nextMonth(month),
        costInvoiced: baseTotal === 0,
        feeSettled: maturingCount === 0,
      };
    });
}

/**
 * One calendar month's actual invoice. A publish-month batch spans two invoices
 * (cost now, fee next month), so the money that lands on any single month's
 * invoice is two different batches: THIS month's cost plus LAST month's fee.
 */
export interface InvoiceMonth {
  /** The calendar month this invoice is sent, e.g. "2026-07". */
  month: string;
  label: string;
  /** Outstanding Stage 1 cost from campaigns published THIS month. */
  newCost: number;
  /** Stage 1 cost already covered by the cutoff or recorded snapshots. */
  invoicedCost: number;
  /** Whether all cost is covered by the cutoff or recorded snapshots. */
  costInvoiced: boolean;
  /** The publish batch whose cost lands this month; null if none published. */
  costBatch: InvoiceBatch | null;
  /** Stage 2 fee carried from LAST month's batch — settled and billable now. */
  carriedFee: number;
  /** Fee from last month's batch still maturing (not yet billable). */
  feePending: number;
  /** Whether last month's batch has settled, so its fee is final. */
  feeSettled: boolean;
  /** The prior publish batch whose fee lands this month; null if none. */
  feeBatch: InvoiceBatch | null;
  /** Total billable on this month's invoice = newCost + carriedFee. */
  total: number;
}

interface InvoiceMonthAccumulator {
  month: string;
  newCost: number;
  invoicedCost: number;
  costInvoiced: boolean;
  costBatch: InvoiceBatch | null;
  carriedFee: number;
  feePending: number;
  feeSettled: boolean;
  feeBatch: InvoiceBatch | null;
}

/**
 * Regroup publish-month batches into the calendar months they are actually
 * invoiced. Each batch contributes its cost to its own publish month and its
 * performance fee to the next month, so a calendar month collects at most one
 * cost batch and one fee batch. Most recent invoice month first.
 */
export function buildInvoiceMonths(
  batches: readonly InvoiceBatch[],
): InvoiceMonth[] {
  const byMonth = new Map<string, InvoiceMonthAccumulator>();
  const ensure = (month: string): InvoiceMonthAccumulator => {
    const existing = byMonth.get(month);

    if (existing) {
      return existing;
    }

    const created: InvoiceMonthAccumulator = {
      month,
      newCost: 0,
      invoicedCost: 0,
      costInvoiced: true,
      costBatch: null,
      carriedFee: 0,
      feePending: 0,
      feeSettled: true,
      feeBatch: null,
    };

    byMonth.set(month, created);

    return created;
  };

  for (const batch of batches) {
    // Outstanding cost lands the month the batch publishes. One batch per
    // publish month, so a direct assignment of the invoiced flag is correct.
    const costRow = ensure(batch.month);

    costRow.newCost += batch.baseTotal;
    costRow.invoicedCost += batch.invoicedBaseTotal;
    costRow.costBatch = batch;
    costRow.costInvoiced = batch.costInvoiced;

    // Fee lands the month after. Settled fees are billable now; a still-maturing
    // batch's fee is only an estimate, so it sits in feePending.
    const feeRow = ensure(batch.feeMonth);

    feeRow.feeBatch = batch;

    if (batch.feeSettled) {
      feeRow.carriedFee += batch.performanceFee;
    } else {
      feeRow.feePending += batch.performanceFee;
      feeRow.feeSettled = false;
    }
  }

  return [...byMonth.values()]
    .map((row) => ({
      ...row,
      label: monthLabel(row.month),
      total: row.newCost + row.carriedFee,
    }))
    .sort((left, right) => right.month.localeCompare(left.month));
}

/** Campaigns with a cost but no usable publish date can't be placed in a month. */
export function undatedSpend(deals: readonly AlmediaDeal[]): {
  cost: number;
  count: number;
} {
  let cost = 0;
  let count = 0;

  for (const deal of deals) {
    if (deal.cost === null || !Number.isFinite(deal.cost) || deal.cost <= 0) {
      continue;
    }

    const month = deal.publishedAt?.slice(0, 7);

    if (month === undefined || !/^\d{4}-\d{2}$/u.test(month)) {
      cost += deal.cost;
      count += 1;
    }
  }

  return { cost, count };
}

/** Totals across the invoice months in view. */
export interface InvoiceTotals {
  costDue: number;
  costInvoiced: number;
  feesDue: number;
  feesPending: number;
  /** Unbilled cost plus settled performance fees. */
  dueNow: number;
}

export function invoiceTotals(
  months: readonly InvoiceMonth[],
): InvoiceTotals {
  let costDue = 0;
  let costInvoiced = 0;
  let feesDue = 0;
  let feesPending = 0;

  for (const entry of months) {
    costInvoiced += entry.invoicedCost;
    costDue += entry.newCost;

    feesDue += entry.carriedFee;
    feesPending += entry.feePending;
  }

  return { costDue, costInvoiced, feesDue, feesPending, dueNow: costDue + feesDue };
}

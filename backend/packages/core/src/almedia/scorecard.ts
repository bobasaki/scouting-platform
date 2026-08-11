import type {
  AlmediaScorecardMonth,
  AlmediaScorecardResponse,
  AlmediaScorecardRow,
  AlmediaStatusCounts,
  AlmediaTierCounts,
  Booking,
  BookingStatus,
} from "@scouting-platform/contracts";

/**
 * Scorecard: booked vs plan-target budget per CM x market x month, plus
 * company-level monthly totals. Pure functions — inject `now` for pace.
 *
 * A booking counts toward "booked" once it is committed (booked, published,
 * or longterm). Pipeline entries are shown but not counted; dropped entries
 * feed the dropout rate: dropped / (dropped + committed).
 *
 * Ported from the standalone tracker's `src/bookings/scorecard.ts`.
 */

const COMMITTED_STATUSES: ReadonlySet<BookingStatus> = new Set([
  "booked",
  "published",
  "longterm",
]);

/** One CM x market x month plan target. */
export interface BookingPlanTarget {
  cm: string;
  market: string;
  /** ISO YYYY-MM. */
  month: string;
  /**
   * Named for its Postgres column (`budget_eur`), which predates the workspace
   * settling on one currency. The figure is in ALMEDIA_CURRENCY like every
   * other amount here; the served field is `targetAmount`.
   */
  budgetEur: number;
  tierCounts: AlmediaTierCounts;
}

/** Company-level monthly revenue target (ISO YYYY-MM). */
export interface MonthlyRevenueTarget {
  month: string;
  /** Column-named like `budgetEur`; see the note there. */
  totalEur: number;
}

function emptyStatusCounts(): AlmediaStatusCounts {
  return { pipeline: 0, booked: 0, published: 0, longterm: 0, dropped: 0 };
}

function emptyTierCounts(): AlmediaTierCounts {
  return { under10k: 0, from10kTo20k: 0, from20kTo50k: 0, over50k: 0 };
}

function tierOf(intBudget: number): keyof AlmediaTierCounts {
  if (intBudget < 10_000) return "under10k";
  if (intBudget < 20_000) return "from10kTo20k";
  if (intBudget < 50_000) return "from20kTo50k";
  return "over50k";
}

/** ISO month (YYYY-MM) containing `now`, in UTC. */
export function isoMonthOf(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/** Share of the month elapsed at `now`, 0..1, in UTC. */
export function monthElapsedFraction(now: Date): number {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthStart = Date.UTC(year, month, 1);
  const nextMonthStart = Date.UTC(year, month + 1, 1);

  return (now.getTime() - monthStart) / (nextMonthStart - monthStart);
}

function ratio(numerator: number, denominator: number | null): number | null {
  return denominator === null || denominator <= 0 ? null : numerator / denominator;
}

function dropoutRate(counts: AlmediaStatusCounts): number | null {
  const committed = counts.booked + counts.published + counts.longterm;

  return ratio(counts.dropped, counts.dropped + committed);
}

function pace(utilization: number | null, month: string, now: Date): number | null {
  if (utilization === null || month !== isoMonthOf(now)) {
    return null;
  }

  const elapsed = monthElapsedFraction(now);

  return elapsed > 0 ? utilization / elapsed : null;
}

// CM names contain spaces, so join group keys on a control character.
const KEY_SEPARATOR = "\u001F";

function groupKey(cm: string | null, market: string | null, month: string): string {
  return [cm ?? "", market ?? "", month].join(KEY_SEPARATOR);
}

interface Accumulator {
  bookedAmount: number;
  bookedTiers: AlmediaTierCounts;
  counts: AlmediaStatusCounts;
}

type ScorecardBooking = Pick<
  Booking,
  "cm" | "country" | "month" | "status" | "intBudget"
>;

function accumulate(bookings: readonly ScorecardBooking[]): Map<string, Accumulator> {
  const groups = new Map<string, Accumulator>();

  for (const booking of bookings) {
    if (!booking.month) {
      continue;
    }

    const key = groupKey(booking.cm, booking.country, booking.month);
    const group = groups.get(key) ?? {
      bookedAmount: 0,
      bookedTiers: emptyTierCounts(),
      counts: emptyStatusCounts(),
    };

    group.counts[booking.status] += 1;

    if (COMMITTED_STATUSES.has(booking.status)) {
      group.bookedAmount += booking.intBudget ?? 0;

      if (booking.intBudget !== null) {
        group.bookedTiers[tierOf(booking.intBudget)] += 1;
      }
    }

    groups.set(key, group);
  }

  return groups;
}

/** Split a group key back into its CM / market / month parts. */
function parseGroupKey(key: string): { cm: string | null; market: string | null; month: string } {
  const [cm = "", market = "", month = ""] = key.split(KEY_SEPARATOR);

  return { cm: cm || null, market: market || null, month };
}

/** Build the scorecard from bookings, plan targets, and revenue targets. */
export function buildScorecard(
  bookings: readonly ScorecardBooking[],
  targets: readonly BookingPlanTarget[],
  revenueTargets: readonly MonthlyRevenueTarget[],
  now: Date,
): AlmediaScorecardResponse {
  const groups = accumulate(bookings);
  const rows: AlmediaScorecardRow[] = [];
  const seenKeys = new Set<string>();

  for (const target of targets) {
    const key = groupKey(target.cm, target.market, target.month);
    seenKeys.add(key);

    const group = groups.get(key);
    const bookedAmount = group?.bookedAmount ?? 0;
    const counts = group?.counts ?? emptyStatusCounts();
    const utilization = ratio(bookedAmount, target.budgetEur);

    rows.push({
      cm: target.cm,
      market: target.market,
      month: target.month,
      targetAmount: target.budgetEur,
      targetTiers: target.tierCounts,
      bookedAmount,
      bookedTiers: group?.bookedTiers ?? emptyTierCounts(),
      counts,
      utilization,
      pace: pace(utilization, target.month, now),
      dropoutRate: dropoutRate(counts),
    });
  }

  // Bookings whose CM/market/month has no plan target still surface as rows.
  for (const [key, group] of groups) {
    if (seenKeys.has(key)) {
      continue;
    }

    const { cm, market, month } = parseGroupKey(key);

    rows.push({
      cm,
      market,
      month,
      targetAmount: null,
      targetTiers: null,
      bookedAmount: group.bookedAmount,
      bookedTiers: group.bookedTiers,
      counts: group.counts,
      utilization: null,
      pace: null,
      dropoutRate: dropoutRate(group.counts),
    });
  }

  rows.sort(
    (a, b) =>
      a.month.localeCompare(b.month) ||
      (a.cm ?? "").localeCompare(b.cm ?? "") ||
      (a.market ?? "").localeCompare(b.market ?? ""),
  );

  const monthKeys = [
    ...new Set([
      ...rows.map((row) => row.month),
      ...revenueTargets.map((target) => target.month),
    ]),
  ].sort();
  const revenueByMonth = new Map(
    revenueTargets.map((target) => [target.month, target.totalEur]),
  );

  const months: AlmediaScorecardMonth[] = monthKeys.map((month) => {
    const monthRows = rows.filter((row) => row.month === month);
    const bookedAmount = monthRows.reduce((total, row) => total + row.bookedAmount, 0);
    const counts = monthRows.reduce((total, row) => {
      for (const status of Object.keys(total) as BookingStatus[]) {
        total[status] += row.counts[status];
      }

      return total;
    }, emptyStatusCounts());
    const targetAmount =
      revenueByMonth.get(month) ??
      (monthRows.some((row) => row.targetAmount !== null)
        ? monthRows.reduce((total, row) => total + (row.targetAmount ?? 0), 0)
        : null);
    const utilization = ratio(bookedAmount, targetAmount);

    return {
      month,
      targetAmount,
      bookedAmount,
      counts,
      utilization,
      pace: pace(utilization, month, now),
      dropoutRate: dropoutRate(counts),
    };
  });

  return {
    months,
    rows,
    unscheduledCount: bookings.filter((booking) => !booking.month).length,
  };
}

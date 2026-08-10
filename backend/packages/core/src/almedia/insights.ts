import type {
  AlmediaCampaignsResponse,
  AlmediaDealsResponse,
  AlmediaScorecardResponse,
} from "@scouting-platform/contracts";

import {
  listBookingPlanTargets,
  listBookings,
  listMonthlyRevenueTargets,
} from "./bookings";
import { getAlmediaSyncStatus, listAlmediaCampaigns } from "./campaigns";
import { dimensionOptions, joinDeals } from "./deals";
import { buildScorecard } from "./scorecard";

/**
 * Composed reads for the Almedia workspace tabs. Each returns everything one
 * tab needs in a single round trip, so the client can filter locally without
 * re-fetching.
 */

/** Insights tab: joined + classified deals, filter options, and sync freshness. */
export async function getAlmediaDeals(
  now: Date = new Date(),
): Promise<AlmediaDealsResponse> {
  const [campaigns, bookings, sync] = await Promise.all([
    listAlmediaCampaigns(),
    listBookings(),
    getAlmediaSyncStatus(),
  ]);
  const deals = joinDeals(campaigns, bookings, now);

  return { deals, options: dimensionOptions(deals), sync };
}

/** Performance tab: the raw campaign feed as stored, plus sync freshness. */
export async function getAlmediaCampaigns(): Promise<AlmediaCampaignsResponse> {
  const [campaigns, sync] = await Promise.all([
    listAlmediaCampaigns(),
    getAlmediaSyncStatus(),
  ]);

  return { campaigns, sync };
}

/** Scorecard tab: booked vs plan target per CM x market x month. */
export async function getBookingScorecard(
  now: Date = new Date(),
): Promise<AlmediaScorecardResponse> {
  const [bookings, targets, revenueTargets] = await Promise.all([
    listBookings(),
    listBookingPlanTargets(),
    listMonthlyRevenueTargets(),
  ]);

  return buildScorecard(bookings, targets, revenueTargets, now);
}

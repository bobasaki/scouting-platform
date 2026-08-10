import type {
  AlmediaCampaignRow,
  AlmediaDeal,
  AlmediaDimensionId,
  AlmediaDimensionOptions,
  Booking,
} from "@scouting-platform/contracts";
import { ALMEDIA_DIMENSIONS, ALMEDIA_UNASSIGNED } from "@scouting-platform/contracts";

import { getMaturityInfo, getReturnTier, getSizeTier } from "./analytics";
import { campaignBaseKey } from "./channel-key";
import { canonicalVertical } from "./verticals";

/**
 * The join behind the Insights view: internal bookings matched to the live
 * Almedia campaigns they produced, by normalized channel key. Campaign-only and
 * booking-only rows are kept too, so nothing silently drops out of totals.
 *
 * Ported from the standalone tracker's `dashboard/src/insights/enrich.ts`. The
 * join and the classifications (return tier, maturity, size tier) are business
 * rules, so they run here and are stamped onto every deal; presentation-level
 * filtering and chart shaping stay on the client.
 */

function expectedViewsOf(
  cost: number | null,
  expectedCpm: number | null,
): number | null {
  if (cost === null || expectedCpm === null || expectedCpm <= 0) {
    return null;
  }

  return (cost / expectedCpm) * 1000;
}

function deliveryOf(
  viewCount: number | null,
  expectedViews: number | null,
): number | null {
  if (viewCount === null || expectedViews === null || expectedViews <= 0) {
    return null;
  }

  return (viewCount / expectedViews) * 100;
}

function classify(
  deal: Omit<AlmediaDeal, "returnTier" | "maturity">,
  now: Date,
): AlmediaDeal {
  return {
    ...deal,
    returnTier: getReturnTier(deal.returnPct),
    maturity: getMaturityInfo(deal.publishedAt, now),
  };
}

function dealFromCampaign(
  campaign: AlmediaCampaignRow,
  booking: Booking | undefined,
  now: Date,
): AlmediaDeal {
  const expectedViews = expectedViewsOf(campaign.cost, campaign.expectedCpm);
  const budgetForTier = booking?.intBudget ?? campaign.cost;
  // Channel enrichment is not integrated yet (Phase 2), so a deal's verticals
  // come from its booking's own value.
  const bookingVertical =
    canonicalVertical(booking?.vertical) ?? booking?.vertical ?? null;
  const verticals = bookingVertical ? [bookingVertical] : [];

  return classify(
    {
      channelKey: campaignBaseKey(campaign.campaignName),
      channelName:
        booking?.channelName ?? campaign.channelName ?? campaign.campaignName,
      campaignName: campaign.campaignName,
      videoUrl: campaign.videoUrl ?? booking?.videoUrl ?? null,
      platform: booking?.platform ?? campaign.platform,
      publishedAt: campaign.publishedAt?.slice(0, 10) ?? booking?.publishedAt ?? null,
      cost: campaign.cost,
      expectedCpm: campaign.expectedCpm,
      viewCount: campaign.viewCount,
      returnPct: campaign.returnPct,
      signupsPct: campaign.signupsPct,
      d7Purchases: campaign.d7Purchases,
      roasReturn: campaign.roasReturn,
      appuD14: campaign.appuD14,
      expectedViews,
      deliveryPct: deliveryOf(campaign.viewCount, expectedViews),
      cm: booking?.cm ?? null,
      country: campaign.country || booking?.country || null,
      vertical: verticals[0] ?? null,
      verticals,
      category: booking?.category ?? null,
      hasEnrichment: false,
      creatorFollowers: null,
      creatorTypicalViews: null,
      creatorEngagementRatePct: null,
      creatorContentFormat: null,
      creatorBrandFit: null,
      creatorSafetyRisk: null,
      status: booking?.status ?? null,
      intBudget: booking?.intBudget ?? null,
      extBudget: booking?.extBudget ?? null,
      month: booking?.month ?? campaign.publishedAt?.slice(0, 7) ?? null,
      sizeTier: getSizeTier(budgetForTier),
      hasCampaign: true,
      hasBooking: booking !== undefined,
    },
    now,
  );
}

function dealFromBooking(booking: Booking, now: Date): AlmediaDeal {
  const vertical = canonicalVertical(booking.vertical) ?? booking.vertical;

  return classify(
    {
      channelKey: booking.channelKey,
      channelName: booking.channelName,
      campaignName: null,
      videoUrl: booking.videoUrl,
      platform: booking.platform,
      publishedAt: booking.publishedAt,
      cost: null,
      expectedCpm: null,
      viewCount: null,
      returnPct: null,
      signupsPct: null,
      d7Purchases: null,
      roasReturn: null,
      appuD14: null,
      expectedViews: null,
      deliveryPct: null,
      cm: booking.cm,
      country: booking.country,
      vertical,
      verticals: vertical ? [vertical] : [],
      category: booking.category,
      hasEnrichment: false,
      creatorFollowers: null,
      creatorTypicalViews: null,
      creatorEngagementRatePct: null,
      creatorContentFormat: null,
      creatorBrandFit: null,
      creatorSafetyRisk: null,
      status: booking.status,
      intBudget: booking.intBudget,
      extBudget: booking.extBudget,
      month: booking.month,
      sizeTier: getSizeTier(booking.intBudget),
      hasCampaign: false,
      hasBooking: true,
    },
    now,
  );
}

/**
 * Join live campaigns with internal bookings by normalized channel key.
 * One deal row per campaign; bookings without a matching campaign (pipeline,
 * not yet live) become metric-less rows so budgets and counts stay complete.
 */
export function joinDeals(
  campaigns: readonly AlmediaCampaignRow[],
  bookings: readonly Booking[],
  now: Date = new Date(),
): AlmediaDeal[] {
  const byKey = new Map<string, Booking>();

  for (const booking of bookings) {
    // Keep the first booking seen per key; callers pass them newest-first.
    if (!byKey.has(booking.channelKey)) {
      byKey.set(booking.channelKey, booking);
    }
  }

  const matchedKeys = new Set<string>();
  const deals = campaigns.map((campaign) => {
    const key = campaignBaseKey(campaign.campaignName);
    const booking = byKey.get(key);

    if (booking) {
      matchedKeys.add(key);
    }

    return dealFromCampaign(campaign, booking, now);
  });

  const unmatched = bookings
    .filter((booking) => !matchedKeys.has(booking.channelKey))
    .map((booking) => dealFromBooking(booking, now));

  return [...deals, ...unmatched];
}

/** Multi-value dimensions (currently vertical) contribute every assigned value. */
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

/** Distinct values per dimension, for the filter dropdowns. */
export function dimensionOptions(
  deals: readonly AlmediaDeal[],
): AlmediaDimensionOptions {
  const options = {} as AlmediaDimensionOptions;

  for (const { id } of ALMEDIA_DIMENSIONS) {
    const values = new Set(deals.flatMap((deal) => dimensionValues(deal, id)));

    options[id] = [...values].sort((a, b) =>
      a === ALMEDIA_UNASSIGNED
        ? 1
        : b === ALMEDIA_UNASSIGNED
          ? -1
          : a.localeCompare(b),
    );
  }

  return options;
}

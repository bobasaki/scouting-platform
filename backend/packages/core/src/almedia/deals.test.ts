import type {
  AlmediaCampaignRow,
  AlmediaChannelEnrichment,
  Booking,
} from "@scouting-platform/contracts";
import { ALMEDIA_UNASSIGNED } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import {
  dimensionOptions,
  joinDeals,
  needsManualVerticalInput,
} from "./deals";
import type { AlmediaEnrichmentLookup } from "./enrichments";

const CATALOG_CHANNEL_ID = "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b";

const NOW = new Date("2026-08-10T00:00:00.000Z");

function enrichment(
  overrides: Partial<{ niche: string; followers: number }> = {},
): AlmediaChannelEnrichment {
  return {
    channel: {
      id: "UCasmrfixy",
      title: "ASMR Fixy",
      description: "Sleep and relaxation.",
      country: "PL",
      topics: [],
      keywords: [],
    },
    metrics: {
      followers: overrides.followers ?? 236_000,
      typicalViews: { median: 30_542 },
      typicalEngagementRatePct: 3.97,
      contentFormat: { dominant: "long_form" },
    },
    classification: {
      niche: overrides.niche ?? "asmr",
      topics: [],
      audiencePositioning: "",
      brandFit: { suitability: "medium", categories: [] },
      brandSafety: { risk: "low" },
    },
    summary: "",
  };
}

/** The two link types, keyed the way the campaign resolution reads them. */
function lookup(
  links: Readonly<{
    campaign?: AlmediaChannelEnrichment;
    channelKey?: AlmediaChannelEnrichment;
  }>,
): AlmediaEnrichmentLookup {
  const resolved = (enrichmentValue: AlmediaChannelEnrichment) => ({
    enrichment: enrichmentValue,
    catalogChannelId: CATALOG_CHANNEL_ID,
    catalogEnrichmentStatus: "completed" as const,
    catalogInfluencerVertical: null,
  });

  return {
    byCampaign: new Map(
      links.campaign ? [["ASMRFIXY_YT_R1", resolved(links.campaign)]] : [],
    ),
    byChannelKey: new Map(
      links.channelKey ? [["ASMRFIXY", resolved(links.channelKey)]] : [],
    ),
  };
}

function campaign(overrides: Partial<AlmediaCampaignRow> = {}): AlmediaCampaignRow {
  return {
    campaignName: "ASMRFIXY_YT_R1",
    campaignSource: "Arch",
    platform: "youtube",
    country: "PL",
    publishedAt: "2026-07-13T18:00:20.000Z",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 40_000,
    signupsPct: null,
    roasD7pD14: null,
    roasReturn: null,
    returnPct: 90,
    appuD14: null,
    d7Purchases: null,
    channelName: "ASMR Fixy",
    videoUrl: "https://www.youtube.com/watch?v=asmrfixy",
    ...overrides,
  };
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    channelName: "ASMR Fixy",
    channelKey: "ASMRFIXY",
    channelUrl: null,
    country: "PL",
    cm: "Lucija P",
    platform: "youtube",
    status: "published",
    activation: null,
    numActivations: null,
    contractSigned: true,
    contractUrl: null,
    publishedAt: "2026-07-13",
    intBudget: 12_000,
    extBudget: 15_000,
    currency: "USD",
    month: "2026-07",
    note: null,
    videoUrl: null,
    vertical: "gaming",
    category: "integration",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("joinDeals", () => {
  it("joins campaigns to bookings via the normalized channel key", () => {
    const deals = joinDeals([campaign()], [booking()], { now: NOW });

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      channelKey: "ASMRFIXY",
      channelName: "ASMR Fixy",
      catalogChannelId: null,
      cm: "Lucija P",
      vertical: "Gaming",
      verticals: ["Gaming"],
      hasCampaign: true,
      hasBooking: true,
      expectedViews: 50_000,
      deliveryPct: 80,
      sizeTier: "10-20k",
    });
  });

  it("stamps the return tier and maturity onto each deal", () => {
    const [matured] = joinDeals([campaign()], [booking()], { now: NOW });
    const [maturing] = joinDeals(
      [campaign({ publishedAt: "2026-08-05T00:00:00.000Z", returnPct: 20 })],
      [],
      { now: NOW },
    );

    expect(matured).toMatchObject({
      returnTier: "rebooking",
      maturity: { status: "matured", daysRemaining: 0 },
    });
    expect(maturing).toMatchObject({
      returnTier: "drop",
      maturity: { status: "maturing", daysRemaining: 9 },
    });
  });

  it("leaves the return tier null when a campaign has no measured return", () => {
    const [deal] = joinDeals([campaign({ returnPct: null })], [], { now: NOW });

    expect(deal?.returnTier).toBeNull();
  });

  it("uses the campaign market when it differs from the booking market", () => {
    const [deal] = joinDeals(
      [campaign({ country: "DE" })],
      [booking({ country: "PL" })],
      { now: NOW },
    );

    expect(deal?.country).toBe("DE");
  });

  it("keeps unmatched campaigns and unmatched bookings as separate rows", () => {
    const deals = joinDeals(
      [campaign({ campaignName: "PHILFLIX_YT_R1" })],
      [booking({ channelKey: "DIABEUU", channelName: "Diabeuu", status: "pipeline" })],
      { now: NOW },
    );

    expect(deals).toHaveLength(2);
    expect(deals[0]).toMatchObject({ hasBooking: false, cm: null, country: "PL" });
    expect(deals[1]).toMatchObject({
      hasCampaign: false,
      cost: null,
      status: "pipeline",
    });
  });

  it("joins multiple campaign rounds of one channel to the same booking", () => {
    const deals = joinDeals(
      [campaign(), campaign({ campaignName: "ASMRFIXY_YT_R2", returnPct: 120 })],
      [booking()],
      { now: NOW },
    );

    expect(deals).toHaveLength(2);
    expect(deals.every((deal) => deal.cm === "Lucija P")).toBe(true);
    expect(deals.map((deal) => deal.returnTier)).toEqual(["rebooking", "longterm"]);
  });

  it("canonicalizes the booking vertical and keeps unknown ones verbatim", () => {
    const [canonical] = joinDeals([campaign()], [booking({ vertical: "finance" })], { now: NOW });
    const [unknown] = joinDeals(
      [campaign()],
      [booking({ vertical: "crypto shilling" })],
      { now: NOW },
    );

    expect(canonical).toMatchObject({ vertical: "Finance", verticals: ["Finance"] });
    expect(unknown).toMatchObject({
      vertical: "crypto shilling",
      verticals: ["crypto shilling"],
    });
  });

  it("reports no enrichment when the creator has none on file", () => {
    const [deal] = joinDeals([campaign()], [booking()], { now: NOW });

    expect(deal).toMatchObject({
      hasEnrichment: false,
      creatorFollowers: null,
      creatorEngagementRatePct: null,
      creatorSafetyRisk: null,
    });
  });

  it("stamps creator signals and derived verticals from the enrichment", () => {
    const [deal] = joinDeals([campaign()], [booking()], {
      enrichments: lookup({ channelKey: enrichment() }),
      now: NOW,
    });

    expect(deal).toMatchObject({
      hasEnrichment: true,
      catalogChannelId: CATALOG_CHANNEL_ID,
      creatorFollowers: 236_000,
      creatorTypicalViews: 30_542,
      creatorEngagementRatePct: 3.97,
      creatorContentFormat: "long_form",
      creatorBrandFit: "medium",
      creatorSafetyRisk: "low",
      // Derived from the creator's own content, not the booking's "gaming".
      vertical: "ASMR",
      verticals: ["ASMR"],
    });
  });

  it("keeps an admin creator override above enrichment and booking values", () => {
    const [deal] = joinDeals([campaign()], [booking({ vertical: "Gaming" })], {
      enrichments: lookup({ channelKey: enrichment({ niche: "asmr" }) }),
      verticalOverrides: new Map([["ASMRFIXY", "Family"]]),
      now: NOW,
    });

    expect(deal).toMatchObject({
      vertical: "Family",
      verticals: ["Family"],
      needsVerticalInput: false,
    });
  });

  it("prefers the campaign's own enrichment over the creator's", () => {
    const [deal] = joinDeals([campaign()], [], {
      enrichments: lookup({
        channelKey: enrichment({ niche: "asmr" }),
        campaign: enrichment({ niche: "gaming", followers: 10 }),
      }),
      now: NOW,
    });

    expect(deal).toMatchObject({ verticals: ["Gaming"], creatorFollowers: 10 });
  });

  it("resolves a later campaign round through the creator key", () => {
    const [deal] = joinDeals([campaign({ campaignName: "ASMRFIXY_YT_R4_LB" })], [], {
      enrichments: lookup({ channelKey: enrichment() }),
      now: NOW,
    });

    expect(deal).toMatchObject({ hasEnrichment: true, verticals: ["ASMR"] });
  });

  it("enriches a pipeline booking that has no campaign yet", () => {
    const [deal] = joinDeals([], [booking({ status: "pipeline" })], {
      enrichments: lookup({ channelKey: enrichment() }),
      now: NOW,
    });

    expect(deal).toMatchObject({
      hasCampaign: false,
      hasEnrichment: true,
      catalogChannelId: CATALOG_CHANNEL_ID,
      verticals: ["ASMR"],
    });
  });

  it("keeps the booking vertical when the enrichment derives nothing", () => {
    const [deal] = joinDeals([campaign()], [booking()], {
      enrichments: lookup({ channelKey: enrichment({ niche: "unclassifiable" }) }),
      now: NOW,
    });

    expect(deal).toMatchObject({ hasEnrichment: true, verticals: ["Gaming"] });
  });

  it("flags unassigned Instagram aliases for manual vertical input", () => {
    const [instagram] = joinDeals(
      [campaign({ platform: "instagram" })],
      [booking({ platform: "instagram", vertical: null })],
      { now: NOW },
    );
    const [ig] = joinDeals(
      [campaign({ platform: "ig" })],
      [],
      { now: NOW },
    );

    expect(instagram).toMatchObject({
      platform: "instagram",
      verticals: [],
      needsVerticalInput: true,
    });
    expect(ig?.needsVerticalInput).toBe(true);
  });

  it("does not flag YouTube or an Instagram creator with a manual vertical", () => {
    expect(needsManualVerticalInput("youtube", [])).toBe(false);
    expect(needsManualVerticalInput("instagram", ["Gaming"])).toBe(false);
    expect(needsManualVerticalInput("Instagram Reels", [])).toBe(true);
    expect(needsManualVerticalInput(null, [])).toBe(false);
  });

  it("falls back to the campaign publish month when the booking has none", () => {
    const [deal] = joinDeals([campaign()], [booking({ month: null })], { now: NOW });

    expect(deal?.month).toBe("2026-07");
  });
});

describe("dimensionOptions", () => {
  const deals = joinDeals(
    [
      campaign(),
      campaign({ campaignName: "PHILFLIX_YT_R1", country: "DE" }),
      campaign({ campaignName: "NOBOOKING_YT_R1" }),
    ],
    [
      booking(),
      booking({
        id: "00000000-0000-4000-8000-000000000002",
        channelKey: "PHILFLIX",
        channelName: "Philflix",
        country: "DE",
        cm: "Miro",
        vertical: "entertainment",
      }),
    ],
    { now: NOW },
  );

  it("lists every dimension, sorted, with Unassigned last", () => {
    const options = dimensionOptions(deals);

    expect(options.cm).toEqual(["Lucija P", "Miro", ALMEDIA_UNASSIGNED]);
    expect(options.country).toEqual(["DE", "PL"]);
    expect(options.vertical).toEqual([
      "Entertainment",
      "Gaming",
      ALMEDIA_UNASSIGNED,
    ]);
  });

  it("always returns an entry for all eight dimensions", () => {
    expect(Object.keys(dimensionOptions([])).sort()).toEqual([
      "category",
      "cm",
      "country",
      "month",
      "platform",
      "sizeTier",
      "status",
      "vertical",
    ]);
  });
});

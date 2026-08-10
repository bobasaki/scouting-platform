import type {
  AlmediaCampaignRow,
  Booking,
} from "@scouting-platform/contracts";
import { ALMEDIA_UNASSIGNED } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { dimensionOptions, joinDeals } from "./deals";

const NOW = new Date("2026-08-10T00:00:00.000Z");

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
    currency: "EUR",
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
    const deals = joinDeals([campaign()], [booking()], NOW);

    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      channelKey: "ASMRFIXY",
      channelName: "ASMR Fixy",
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
    const [matured] = joinDeals([campaign()], [booking()], NOW);
    const [maturing] = joinDeals(
      [campaign({ publishedAt: "2026-08-05T00:00:00.000Z", returnPct: 20 })],
      [],
      NOW,
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
    const [deal] = joinDeals([campaign({ returnPct: null })], [], NOW);

    expect(deal?.returnTier).toBeNull();
  });

  it("uses the campaign market when it differs from the booking market", () => {
    const [deal] = joinDeals(
      [campaign({ country: "DE" })],
      [booking({ country: "PL" })],
      NOW,
    );

    expect(deal?.country).toBe("DE");
  });

  it("keeps unmatched campaigns and unmatched bookings as separate rows", () => {
    const deals = joinDeals(
      [campaign({ campaignName: "PHILFLIX_YT_R1" })],
      [booking({ channelKey: "DIABEUU", channelName: "Diabeuu", status: "pipeline" })],
      NOW,
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
      NOW,
    );

    expect(deals).toHaveLength(2);
    expect(deals.every((deal) => deal.cm === "Lucija P")).toBe(true);
    expect(deals.map((deal) => deal.returnTier)).toEqual(["rebooking", "longterm"]);
  });

  it("canonicalizes the booking vertical and keeps unknown ones verbatim", () => {
    const [canonical] = joinDeals([campaign()], [booking({ vertical: "finance" })], NOW);
    const [unknown] = joinDeals(
      [campaign()],
      [booking({ vertical: "crypto shilling" })],
      NOW,
    );

    expect(canonical).toMatchObject({ vertical: "Finance", verticals: ["Finance"] });
    expect(unknown).toMatchObject({
      vertical: "crypto shilling",
      verticals: ["crypto shilling"],
    });
  });

  it("reports no enrichment in Phase 1", () => {
    const [deal] = joinDeals([campaign()], [booking()], NOW);

    expect(deal).toMatchObject({
      hasEnrichment: false,
      creatorFollowers: null,
      creatorEngagementRatePct: null,
      creatorSafetyRisk: null,
    });
  });

  it("falls back to the campaign publish month when the booking has none", () => {
    const [deal] = joinDeals([campaign()], [booking({ month: null })], NOW);

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
    NOW,
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

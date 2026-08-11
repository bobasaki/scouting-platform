import type { AlmediaDeal } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { enrichmentOverview, verticalPerformance } from "./enrichment";

function deal(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  return {
    channelKey: "ASMRFIXY",
    channelName: "ASMR Fixy",
    catalogChannelId: null,
    campaignName: "ASMRFIXY_YT_R1",
    videoUrl: null,
    platform: "youtube",
    publishedAt: "2026-07-13",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 40_000,
    returnPct: 90,
    signupsPct: null,
    d7Purchases: 100,
    roasReturn: null,
    appuD14: null,
    expectedViews: 50_000,
    deliveryPct: 80,
    cm: "Lucija P",
    country: "PL",
    vertical: "ASMR",
    verticals: ["ASMR"],
    category: "integration",
    hasEnrichment: true,
    creatorFollowers: 200_000,
    creatorTypicalViews: 30_000,
    creatorEngagementRatePct: 4,
    creatorContentFormat: "long_form",
    creatorBrandFit: "medium",
    creatorSafetyRisk: "low",
    status: "published",
    intBudget: 12_000,
    extBudget: 15_000,
    month: "2026-07",
    sizeTier: "10-20k",
    hasCampaign: true,
    hasBooking: true,
    returnTier: "rebooking",
    maturity: { status: "matured", daysRemaining: 0 },
    ...overrides,
  };
}

/** A creator with no enrichment on file. */
function bare(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  return deal({
    hasEnrichment: false,
    creatorFollowers: null,
    creatorTypicalViews: null,
    creatorEngagementRatePct: null,
    creatorContentFormat: null,
    creatorBrandFit: null,
    creatorSafetyRisk: null,
    ...overrides,
  });
}

describe("enrichmentOverview", () => {
  it("reports coverage over campaigns and quality over creators", () => {
    const overview = enrichmentOverview([
      deal(),
      deal({
        campaignName: "ASMRFIXY_YT_R2",
        creatorEngagementRatePct: 10,
        creatorSafetyRisk: "high",
      }),
      bare({
        channelKey: "PHILFLIX",
        campaignName: "PHILFLIX_YT_R1",
        verticals: ["Gaming"],
      }),
    ]);

    expect(overview).toMatchObject({
      campaigns: 3,
      enrichedCampaigns: 2,
      coverageShare: 2 / 3,
      // Both enriched rows are the same channel, so one creator.
      enrichedCreators: 1,
      verticals: 2,
      avgEngagementRatePct: 4,
      brandSafeShare: 1,
    });
  });

  it("ignores bookings that have no campaign", () => {
    const overview = enrichmentOverview([
      deal(),
      deal({
        channelKey: "DIABEUU",
        campaignName: null,
        hasCampaign: false,
        verticals: ["Gaming"],
      }),
    ]);

    expect(overview).toMatchObject({
      campaigns: 1,
      enrichedCampaigns: 1,
      coverageShare: 1,
      verticals: 1,
    });
  });

  it("returns null shares rather than zero when nothing is measurable", () => {
    expect(enrichmentOverview([])).toEqual({
      campaigns: 0,
      enrichedCampaigns: 0,
      coverageShare: null,
      enrichedCreators: 0,
      verticals: 0,
      avgEngagementRatePct: null,
      brandSafeShare: null,
    });
  });
});

describe("verticalPerformance", () => {
  it("ranks verticals by spend and weights return by cost", () => {
    const rows = verticalPerformance([
      deal({ cost: 1000, returnPct: 50 }),
      deal({ campaignName: "ASMRFIXY_YT_R2", cost: 3000, returnPct: 150 }),
      bare({
        channelKey: "PHILFLIX",
        campaignName: "PHILFLIX_YT_R1",
        cost: 500,
        verticals: ["Gaming"],
      }),
    ]);

    expect(rows.map((row) => row.vertical)).toEqual(["ASMR", "Gaming"]);
    expect(rows[0]).toMatchObject({
      campaigns: 2,
      measuredReturns: 2,
      enrichedCreators: 1,
      cost: 4000,
      // (50x1000 + 150x3000) / 4000
      avgReturnPct: 125,
      brandSafeShare: 1,
    });
    expect(rows[1]).toMatchObject({
      enrichedCreators: 0,
      avgEngagementRatePct: null,
      brandSafeShare: null,
    });
  });

  it("counts a two-vertical campaign in both", () => {
    const rows = verticalPerformance([deal({ verticals: ["ASMR", "Mystery"] })]);

    expect(rows.map((row) => row.vertical).sort()).toEqual(["ASMR", "Mystery"]);
    expect(rows.every((row) => row.campaigns === 1)).toBe(true);
  });

  it("averages creator quality once per channel, not once per campaign", () => {
    const rows = verticalPerformance([
      deal({ creatorFollowers: 100 }),
      deal({ campaignName: "ASMRFIXY_YT_R2", creatorFollowers: 100 }),
      deal({
        channelKey: "DIABEUU",
        campaignName: "DIABEUU_YT_R1",
        creatorFollowers: 300,
      }),
    ]);

    expect(rows[0]?.enrichedCreators).toBe(2);
    expect(rows[0]?.avgFollowers).toBe(200);
  });
});

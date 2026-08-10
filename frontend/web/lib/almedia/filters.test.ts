import type { AlmediaDeal } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import {
  bestDealsByCm,
  filterDeals,
  groupByDimension,
  painPoints,
  totalsOf,
} from "./filters";
import { ALL_ALMEDIA_FILTERS, ALMEDIA_UNASSIGNED } from "./types";

function deal(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  const result: AlmediaDeal = {
    channelKey: "ASMRFIXY",
    channelName: "ASMR Fixy",
    campaignName: "ASMRFIXY_YT_R1",
    videoUrl: null,
    platform: "youtube",
    publishedAt: "2026-07-13",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 40_000,
    returnPct: 90,
    signupsPct: null,
    d7Purchases: null,
    roasReturn: null,
    appuD14: null,
    expectedViews: 50_000,
    deliveryPct: 80,
    cm: "Lucija P",
    country: "PL",
    vertical: "Gaming",
    verticals: ["Gaming"],
    category: "integration",
    hasEnrichment: false,
    creatorFollowers: null,
    creatorTypicalViews: null,
    creatorEngagementRatePct: null,
    creatorContentFormat: null,
    creatorBrandFit: null,
    creatorSafetyRisk: null,
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

  if (overrides.vertical !== undefined && overrides.verticals === undefined) {
    return { ...result, verticals: overrides.vertical ? [overrides.vertical] : [] };
  }

  return result;
}

const deals = [
  deal(),
  deal({
    channelKey: "PHILFLIX",
    channelName: "Philflix",
    campaignName: "PHILFLIX_YT_R1",
    country: "DE",
    cm: "Miro",
    vertical: "Entertainment",
    cost: 500,
    returnPct: 30,
    viewCount: 5_000,
    expectedViews: 25_000,
    deliveryPct: 20,
    intBudget: 4_000,
  }),
];

describe("filterDeals", () => {
  it("filters by any dimension, mapping null to Unassigned", () => {
    expect(filterDeals(deals, { ...ALL_ALMEDIA_FILTERS, country: "PL" })).toHaveLength(1);
    expect(
      filterDeals(deals, { ...ALL_ALMEDIA_FILTERS, vertical: "Entertainment" }),
    ).toHaveLength(1);
    expect(
      filterDeals(deals, { ...ALL_ALMEDIA_FILTERS, cm: ALMEDIA_UNASSIGNED }),
    ).toHaveLength(0);
  });

  it("returns every deal when nothing is filtered", () => {
    expect(filterDeals(deals, ALL_ALMEDIA_FILTERS)).toHaveLength(2);
  });

  it("intersects multiple active dimensions", () => {
    expect(
      filterDeals(deals, { ...ALL_ALMEDIA_FILTERS, country: "PL", cm: "Miro" }),
    ).toHaveLength(0);
  });

  it("matches a deal through any of its verticals", () => {
    const multi = [deal({ verticals: ["Gaming", "Education"] })];

    expect(
      filterDeals(multi, { ...ALL_ALMEDIA_FILTERS, vertical: "Education" }),
    ).toHaveLength(1);
  });
});

describe("groupByDimension", () => {
  it("aggregates cost-weighted return and delivery per group", () => {
    const groups = groupByDimension(deals, "cm");
    const lucija = groups.find((group) => group.key === "Lucija P");
    const miro = groups.find((group) => group.key === "Miro");

    expect(lucija).toMatchObject({ deals: 1, cost: 1000, avgReturnPct: 90 });
    expect(miro?.avgReturnPct).toBe(30);
    // PHILFLIX expected views: 500 / 20 * 1000 = 25k; delivered 5k = 20%
    expect(miro?.deliveryPct).toBeCloseTo(20);
  });

  it("orders groups by combined spend and budget", () => {
    expect(groupByDimension(deals, "cm").map((group) => group.key)).toEqual([
      "Lucija P",
      "Miro",
    ]);
  });

  it("counts a multi-vertical deal in every one of its verticals", () => {
    const groups = groupByDimension(
      [deal({ verticals: ["Gaming", "Education"] })],
      "vertical",
    );

    expect(groups.map((group) => group.key).sort()).toEqual(["Education", "Gaming"]);
  });
});

describe("totalsOf", () => {
  it("computes totals across the filtered set", () => {
    const totals = totalsOf(deals);

    expect(totals.deals).toBe(2);
    expect(totals.markets).toBe(2);
    expect(totals.cost).toBe(1500);
    expect(totals.intBudget).toBe(16_000);
    // Weighted return: (90*1000 + 30*500) / 1500 = 70
    expect(totals.avgReturnPct).toBe(70);
    expect(totals.publishedShare).toBe(1);
  });

  it("returns null ratios for an empty set rather than NaN", () => {
    const totals = totalsOf([]);

    expect(totals).toMatchObject({
      deals: 0,
      cost: 0,
      deliveryPct: null,
      avgReturnPct: null,
      publishedShare: null,
      avgAppuD14: null,
    });
  });
});

describe("bestDealsByCm", () => {
  it("ranks CMs by weighted return and caps deals per CM", () => {
    const ranked = bestDealsByCm(
      [
        deal({ cm: "Miro", returnPct: 130 }),
        deal({ cm: "Miro", returnPct: 110 }),
        deal({ cm: "Miro", returnPct: 100 }),
        deal({ cm: "Miro", returnPct: 90 }),
        deal({ cm: "Lucija P", returnPct: 60 }),
      ],
      3,
    );

    expect(ranked.map((entry) => entry.cm)).toEqual(["Miro", "Lucija P"]);
    expect(ranked[0]?.deals).toHaveLength(3);
    expect(ranked[0]?.deals.map((entry) => entry.returnPct)).toEqual([130, 110, 100]);
  });

  it("groups deals with no CM under Unassigned", () => {
    expect(bestDealsByCm([deal({ cm: null })])[0]?.cm).toBe(ALMEDIA_UNASSIGNED);
  });
});

describe("painPoints", () => {
  it("flags low-return and under-delivery segments with enough evidence", () => {
    const points = painPoints([
      deal({
        country: "FR",
        returnPct: 20,
        cost: 1_000,
        viewCount: 10_000,
        expectedViews: 50_000,
      }),
      deal({
        country: "FR",
        returnPct: 40,
        cost: 1_000,
        viewCount: 12_000,
        expectedViews: 50_000,
      }),
    ]);
    const franceIssues = points.filter((point) => point.key === "FR");

    expect(franceIssues.map((point) => point.issue)).toContain("low-return");
    expect(franceIssues.map((point) => point.issue)).toContain("under-delivery");
    expect(franceIssues.every((point) => point.severity === "high")).toBe(true);
  });

  it("stays silent when a segment has too little measured evidence", () => {
    expect(
      painPoints([deal({ country: "FR", returnPct: 20, cost: 1_000 })]).filter(
        (point) => point.issue === "low-return",
      ),
    ).toHaveLength(0);
  });

  it("sorts high severity ahead of medium", () => {
    const severities = painPoints([
      deal({ country: "FR", returnPct: 20, cost: 1_000 }),
      deal({ country: "FR", returnPct: 40, cost: 1_000 }),
      deal({ country: "ES", returnPct: 60, cost: 1_000 }),
      deal({ country: "ES", returnPct: 70, cost: 1_000 }),
    ]).map((point) => point.severity);

    expect(severities).toEqual([...severities].sort());
  });
});

import type {
  AlmediaDeal,
  AlmediaScorecardResponse,
} from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { buildAlmediaDigest } from "./digest";
import { ALL_ALMEDIA_FILTERS } from "./types";

function deal(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  return {
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
}

const NOW = new Date("2026-08-11T09:00:00.000Z");

type Digest = {
  snapshot: {
    generatedAt: string;
    currentMonth: string;
    nextCalendarMonth: string;
    activeFilters: Record<string, string>;
  };
  evidenceRules: {
    candidateGroupsComplete: boolean;
    candidateLimitPerGroup: number;
  };
  totals: { deals: number; cost: number };
  candidates: Record<
    string,
    {
      total: number;
      included: number;
      truncated: boolean;
      deals: Array<Record<string, unknown>>;
    }
  >;
  segments: Record<
    string,
    { totalGroups: number; includedGroups: number; truncated: boolean }
  >;
  plan: {
    available: boolean;
    ignoredFilters: string[];
    appliedFilters?: Record<string, string>;
    totalRows: number;
    rows: Array<{ market: string | null; remaining: number | null }>;
  };
  unmeasured: { missingReturn: number; unknownMaturity: number };
  enrichment: { overview: { coveragePct: number | null } };
};

function digestOf(
  deals: readonly AlmediaDeal[],
  overrides: Partial<Parameters<typeof buildAlmediaDigest>[0]> = {},
): Digest {
  return JSON.parse(
    buildAlmediaDigest({ deals, filters: ALL_ALMEDIA_FILTERS, now: NOW, ...overrides }),
  ) as Digest;
}

describe("buildAlmediaDigest", () => {
  it("stamps the snapshot with the current and next calendar month", () => {
    const digest = digestOf([deal()]);

    expect(digest.snapshot.generatedAt).toBe("2026-08-11T09:00:00.000Z");
    expect(digest.snapshot.currentMonth).toBe("2026-08");
    expect(digest.snapshot.nextCalendarMonth).toBe("2026-09");
  });

  it("reports only the filters that are actually narrowing the view", () => {
    const digest = digestOf([deal()], {
      filters: { ...ALL_ALMEDIA_FILTERS, country: "PL", vertical: "Gaming" },
    });

    expect(digest.snapshot.activeFilters).toEqual({
      country: "PL",
      vertical: "Gaming",
    });
  });

  it("bands matured deals by the server-stamped return tier", () => {
    const digest = digestOf([
      deal({ returnPct: 140, returnTier: "longterm" }),
      deal({ channelKey: "B", returnPct: 90, returnTier: "rebooking" }),
      deal({ channelKey: "C", returnPct: 60, returnTier: "price_adjusted" }),
      deal({ channelKey: "D", returnPct: 20, returnTier: "drop" }),
    ]);

    expect(digest.candidates.longterm?.total).toBe(1);
    expect(digest.candidates.rebooking?.total).toBe(1);
    expect(digest.candidates.priceAdjusted?.total).toBe(1);
    expect(digest.candidates.drop?.total).toBe(1);
  });

  it("keeps an unmatured campaign out of every action bucket", () => {
    const digest = digestOf([
      deal({ returnPct: 140, returnTier: "longterm", maturity: { status: "maturing", daysRemaining: 6 } }),
    ]);

    expect(digest.candidates.longterm?.total).toBe(0);
    expect(digest.candidates.underDelivery?.total).toBe(0);
    expect(digest.candidates.notActionableYet?.total).toBe(1);
  });

  it("counts unknown maturity separately from a missing return", () => {
    const digest = digestOf([
      deal({ returnPct: null, maturity: { status: "unknown", daysRemaining: null } }),
      deal({ channelKey: "B", returnPct: 90 }),
    ]);

    expect(digest.unmeasured.missingReturn).toBe(1);
    expect(digest.unmeasured.unknownMaturity).toBe(1);
  });

  it("carries the renegotiation anchor only for an under-delivering deal", () => {
    const digest = digestOf([deal({ deliveryPct: 80, cost: 1000 })]);
    const row = digest.candidates.underDelivery?.deals[0];

    expect(row?.deliveryAlignedCost).toBe(800);
    expect(row?.realisedCpm).toBe(25);
  });

  it("never anchors above the price actually paid when delivery overshot", () => {
    const digest = digestOf([
      deal({ channelKey: "OVER", deliveryPct: 130, cost: 1000, returnPct: 140, returnTier: "longterm" }),
    ]);
    const row = digest.candidates.longterm?.deals[0];

    expect(row?.deliveryAlignedCost).toBe(1000);
  });

  it("discloses truncation once a bucket exceeds the candidate limit", () => {
    const many = Array.from({ length: 45 }, (_, index) =>
      deal({ channelKey: `CH${String(index)}`, returnPct: 140, returnTier: "longterm" }),
    );
    const digest = digestOf(many);

    expect(digest.candidates.longterm?.total).toBe(45);
    expect(digest.candidates.longterm?.included).toBe(40);
    expect(digest.candidates.longterm?.truncated).toBe(true);
    expect(digest.evidenceRules.candidateGroupsComplete).toBe(false);
  });

  it("marks the candidate set complete when nothing was dropped", () => {
    const digest = digestOf([deal()]);

    expect(digest.evidenceRules.candidateGroupsComplete).toBe(true);
    expect(digest.candidates.rebooking?.truncated).toBe(false);
  });

  it("shrinks the candidate limit until the digest fits the context cap", () => {
    // Long names blow the per-deal payload up, and the tiers are spread so
    // every bucket fills to the limit. The builder must fall back to a smaller
    // limit rather than emit a digest past the context cap.
    const tiers = [
      { returnPct: 140, returnTier: "longterm" },
      { returnPct: 90, returnTier: "rebooking" },
      { returnPct: 60, returnTier: "price_adjusted" },
      { returnPct: 20, returnTier: "drop" },
    ] as const;
    const bulky = Array.from({ length: 400 }, (_, index) => {
      const tier = tiers[index % tiers.length] ?? tiers[0];

      return deal({
        channelKey: `CH${String(index)}`,
        channelName: "X".repeat(200),
        campaignName: "Y".repeat(200),
        returnPct: tier.returnPct,
        returnTier: tier.returnTier,
        ...(index % 7 === 0
          ? { maturity: { status: "maturing" as const, daysRemaining: 4 } }
          : {}),
      });
    });
    const raw = buildAlmediaDigest({
      deals: bulky,
      filters: ALL_ALMEDIA_FILTERS,
      now: NOW,
    });
    const digest = JSON.parse(raw) as Digest;

    expect(raw.length).toBeLessThanOrEqual(190_000);
    expect(digest.evidenceRules.candidateLimitPerGroup).toBeLessThan(40);
    // The counts stay whole even though the rows behind them were dropped, and
    // every bucket still totals back to the full deal set.
    const totals = Object.values(digest.candidates);

    expect(digest.candidates.longterm?.truncated).toBe(true);
    expect(digest.candidates.longterm?.included).toBe(
      digest.evidenceRules.candidateLimitPerGroup,
    );
    expect(
      totals.filter((bucket) => bucket.total > 0).every((bucket) => bucket.truncated),
    ).toBe(true);
    expect(digest.candidates.notActionableYet?.total).toBe(58);
  });

  it("says the plan is unavailable rather than implying a zero target", () => {
    const digest = digestOf([deal()], { scorecard: null });

    expect(digest.plan.available).toBe(false);
    expect(digest.plan.rows).toEqual([]);
  });

  it("scopes plan rows to CM, market, and month and names the filters it cannot honour", () => {
    const tiers = { under10k: 0, from10kTo20k: 1, from20kTo50k: 0, over50k: 0 };
    const counts = { pipeline: 0, booked: 1, published: 1, longterm: 0, dropped: 0 };
    const scorecard: AlmediaScorecardResponse = {
      months: [],
      rows: [
        {
          cm: "Lucija P",
          market: "PL",
          month: "2026-07",
          targetAmount: 50_000,
          targetTiers: tiers,
          bookedAmount: 30_000,
          bookedTiers: tiers,
          counts,
          utilization: 0.6,
          pace: null,
          dropoutRate: 0,
        },
        {
          cm: "Miro",
          market: "DE",
          month: "2026-07",
          targetAmount: 20_000,
          targetTiers: tiers,
          bookedAmount: 5_000,
          bookedTiers: tiers,
          counts,
          utilization: 0.25,
          pace: null,
          dropoutRate: 0,
        },
      ],
      unscheduledCount: 0,
    };

    const digest = digestOf([deal()], {
      filters: { ...ALL_ALMEDIA_FILTERS, country: "PL", vertical: "Gaming" },
      scorecard,
    });

    expect(digest.plan.available).toBe(true);
    expect(digest.plan.totalRows).toBe(1);
    expect(digest.plan.rows[0]?.market).toBe("PL");
    expect(digest.plan.rows[0]?.remaining).toBe(20_000);
    expect(digest.plan.appliedFilters).toEqual({ country: "PL" });
    expect(digest.plan.ignoredFilters).toEqual(["vertical"]);
  });

  it("survives an empty deal set", () => {
    const digest = digestOf([]);

    expect(digest.totals.deals).toBe(0);
    expect(digest.enrichment.overview.coveragePct).toBeNull();
    expect(digest.candidates.longterm?.total).toBe(0);
  });
});

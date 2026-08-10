import type { AlmediaDeal } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import { bookingSuggestions } from "./suggestions";

function deal(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  const result: AlmediaDeal = {
    channelKey: "CHAN",
    channelName: "Channel",
    campaignName: "CHAN_YT_R1",
    videoUrl: null,
    platform: "youtube",
    publishedAt: "2026-06-01",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 50_000,
    returnPct: 120,
    signupsPct: null,
    d7Purchases: null,
    roasReturn: null,
    appuD14: null,
    expectedViews: 50_000,
    deliveryPct: 100,
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
    month: "2026-06",
    sizeTier: "10-20k",
    hasCampaign: true,
    hasBooking: true,
    returnTier: "longterm",
    maturity: { status: "matured", daysRemaining: 0 },
    ...overrides,
  };

  if (overrides.vertical !== undefined && overrides.verticals === undefined) {
    return { ...result, verticals: overrides.vertical ? [overrides.vertical] : [] };
  }

  return result;
}

describe("bookingSuggestions", () => {
  it("recommends the strongest verticals with their evidence", () => {
    const suggestions = bookingSuggestions([
      deal({ vertical: "Gaming", returnPct: 130, cost: 2_000 }),
      deal({ vertical: "Gaming", returnPct: 120, cost: 2_000 }),
    ]);
    const bookMore = suggestions.find(
      (suggestion) => suggestion.id === "vertical-Gaming",
    );

    expect(bookMore).toMatchObject({
      kind: "book-more",
      priority: "high",
      headline: "Book more Gaming",
    });
    expect(bookMore?.metric).toContain("125% return");
  });

  it("ignores deals that have not matured", () => {
    expect(
      bookingSuggestions([
        deal({ returnPct: 130, maturity: { status: "maturing", daysRemaining: 4 } }),
        deal({ returnPct: 120, maturity: { status: "maturing", daysRemaining: 6 } }),
      ]),
    ).toEqual([]);
  });

  it("ignores deals with no measured return", () => {
    expect(bookingSuggestions([deal({ returnPct: null })])).toEqual([]);
  });

  it("lists proven channels to rebook", () => {
    const rebook = bookingSuggestions([
      deal({ channelName: "Alpha", returnPct: 130 }),
      deal({ channelName: "Beta", returnPct: 95 }),
      deal({ channelName: "Gamma", returnPct: 40 }),
    ]).find((suggestion) => suggestion.kind === "rebook");

    expect(rebook?.headline).toBe("Rebook 2 proven channels");
    expect(rebook?.detail).toContain("Alpha");
    expect(rebook?.detail).toContain("Beta");
    expect(rebook?.detail).not.toContain("Gamma");
  });

  it("steers budget toward the better platform when the gap is material", () => {
    const platform = bookingSuggestions([
      deal({ platform: "youtube", returnPct: 130, cost: 1_000 }),
      deal({ platform: "youtube", returnPct: 130, cost: 1_000 }),
      deal({ platform: "tiktok", returnPct: 40, cost: 1_000 }),
      deal({ platform: "tiktok", returnPct: 40, cost: 1_000 }),
    ]).find((suggestion) => suggestion.kind === "platform");

    expect(platform?.headline).toBe("Shift budget toward YouTube");
    expect(platform?.metric).toContain("TikTok");
  });

  it("flags segments to ease off", () => {
    const reduce = bookingSuggestions([
      deal({ vertical: "Finance", returnPct: 30, cost: 1_000 }),
      deal({ vertical: "Finance", returnPct: 40, cost: 1_000 }),
    ]).find((suggestion) => suggestion.kind === "reduce");

    expect(reduce).toMatchObject({
      headline: "Ease off Finance",
      priority: "medium",
    });
  });

  it("sorts high priority first", () => {
    const priorities = bookingSuggestions([
      deal({ vertical: "Gaming", returnPct: 130, cost: 2_000 }),
      deal({ vertical: "Gaming", returnPct: 120, cost: 2_000 }),
      deal({ vertical: "Finance", returnPct: 30, cost: 1_000 }),
      deal({ vertical: "Finance", returnPct: 40, cost: 1_000 }),
    ]).map((suggestion) => suggestion.priority);

    expect(priorities).toEqual([...priorities].sort());
  });

  it("omits the creator-profile suggestion while enrichment is unavailable", () => {
    expect(
      bookingSuggestions([
        deal({ channelName: "A", returnPct: 130 }),
        deal({ channelName: "B", returnPct: 130 }),
        deal({ channelName: "C", returnPct: 130 }),
      ]).some((suggestion) => suggestion.kind === "creator-profile"),
    ).toBe(false);
  });
});

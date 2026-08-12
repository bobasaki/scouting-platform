import type {
  AlmediaCampaignRow,
  AlmediaDeal,
  AlmediaDimensionOptions,
  AlmediaScorecardResponse,
  Booking,
  BookingInvoice,
} from "@scouting-platform/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlmediaBookingsTab } from "./almedia-bookings-tab";
import { AlmediaInsightsTab } from "./almedia-insights-tab";
import {
  AlmediaInstagramVerticalQueue,
  instagramVerticalInputRows,
} from "./almedia-instagram-vertical-queue";
import { youtubeEnrichmentOverview } from "./almedia-youtube-enrichment-panel";
import { AlmediaInvoicesTab } from "./almedia-invoices-tab";
import { AlmediaPerformanceTab } from "./almedia-performance-tab";
import { AlmediaScorecardTab } from "./almedia-scorecard-tab";

/**
 * Render smoke tests. The three tabs mount fifteen widgets between them, each
 * doing its own arithmetic on the deal set; these render both a populated and
 * an empty snapshot so a divide-by-zero or a missing null guard fails here
 * rather than in the browser.
 */

function deal(overrides: Partial<AlmediaDeal> = {}): AlmediaDeal {
  return {
    channelKey: "CHAN",
    channelName: "Channel",
    catalogChannelId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
    catalogEnrichmentStatus: "completed",
    campaignName: "CHAN_YT_R1",
    videoUrl: "https://youtu.be/abc",
    platform: "youtube",
    publishedAt: "2026-07-13",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 50_000,
    returnPct: 120,
    signupsPct: 0.02,
    d7Purchases: 100,
    roasReturn: 1.2,
    appuD14: 3.5,
    expectedViews: 50_000,
    deliveryPct: 100,
    cm: "Lucija P",
    country: "PL",
    vertical: "Gaming",
    verticals: ["Gaming"],
    needsVerticalInput: false,
    category: "integration",
    hasEnrichment: true,
    creatorFollowers: 236_000,
    creatorTypicalViews: 30_000,
    creatorEngagementRatePct: 4.2,
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
    returnTier: "longterm",
    maturity: { status: "matured", daysRemaining: 0 },
    ...overrides,
  };
}

const DEALS: readonly AlmediaDeal[] = [
  deal(),
  deal({
    channelKey: "SECOND",
    channelName: "Second",
    catalogChannelId: null,
    campaignName: "SECOND_TT_R2",
    platform: "tiktok",
    country: "DE",
    vertical: "Lifestyle",
    verticals: ["Lifestyle"],
    cm: "Ana K",
    cost: 4000,
    returnPct: 42,
    returnTier: "drop",
    viewCount: 20_000,
    expectedViews: 40_000,
    deliveryPct: 50,
    maturity: { status: "maturing", daysRemaining: 6 },
    month: "2026-08",
    publishedAt: "2026-08-05",
    sizeTier: ">50k",
    status: "booked",
  }),
  // Booking with no campaign yet: every widget must tolerate the null side.
  deal({
    channelKey: "PIPELINE",
    channelName: "Pipeline",
    campaignName: null,
    videoUrl: null,
    platform: null,
    publishedAt: null,
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
    hasCampaign: false,
    returnTier: null,
    status: "pipeline",
    maturity: { status: "unknown", daysRemaining: null },
  }),
];

const OPTIONS: AlmediaDimensionOptions = {
  cm: ["Ana K", "Lucija P"],
  country: ["DE", "PL"],
  vertical: ["Gaming", "Lifestyle"],
  category: ["integration"],
  platform: ["tiktok", "youtube"],
  sizeTier: ["10-20k", ">50k"],
  status: ["booked", "pipeline", "published"],
  month: ["2026-07", "2026-08"],
};

const EMPTY_OPTIONS: AlmediaDimensionOptions = {
  cm: [],
  country: [],
  vertical: [],
  category: [],
  platform: [],
  sizeTier: [],
  status: [],
  month: [],
};

const CAMPAIGNS: readonly AlmediaCampaignRow[] = [
  {
    campaignName: "CHAN_YT_R1",
    campaignSource: "youtube",
    platform: "youtube",
    country: "PL",
    publishedAt: "2026-07-13T00:00:00.000Z",
    cost: 1000,
    expectedCpm: 20,
    viewCount: 50_000,
    signupsPct: 0.02,
    roasD7pD14: 1.1,
    roasReturn: 1.2,
    returnPct: 120,
    appuD14: 3.5,
    d7Purchases: 100,
    channelName: "Channel",
    videoUrl: "https://youtu.be/abc",
  },
  {
    campaignName: "SECOND_TT_R2",
    campaignSource: "tiktok",
    platform: "tiktok",
    country: "DE",
    publishedAt: null,
    cost: null,
    expectedCpm: null,
    viewCount: null,
    signupsPct: null,
    roasD7pD14: null,
    roasReturn: null,
    returnPct: null,
    appuD14: null,
    d7Purchases: null,
    channelName: null,
    videoUrl: null,
  },
];

const SCORECARD: AlmediaScorecardResponse = {
  months: [
    {
      month: "2026-07",
      targetAmount: 40_000,
      bookedAmount: 27_000,
      counts: {
        pipeline: 1,
        booked: 2,
        published: 3,
        longterm: 1,
        dropped: 1,
      },
      utilization: 0.675,
      pace: 0.9,
      dropoutRate: 0.125,
    },
  ],
  rows: [
    {
      cm: "Lucija P",
      market: "PL",
      month: "2026-07",
      targetAmount: 40_000,
      targetTiers: {
        under10k: 1,
        from10kTo20k: 2,
        from20kTo50k: 1,
        over50k: 0,
      },
      bookedAmount: 27_000,
      bookedTiers: {
        under10k: 1,
        from10kTo20k: 1,
        from20kTo50k: 1,
        over50k: 0,
      },
      counts: {
        pipeline: 1,
        booked: 2,
        published: 3,
        longterm: 1,
        dropped: 1,
      },
      utilization: 0.675,
      pace: 0.9,
      dropoutRate: 0.125,
    },
  ],
  unscheduledCount: 2,
};

const EMPTY_SCORECARD: AlmediaScorecardResponse = {
  months: [],
  rows: [],
  unscheduledCount: 0,
};

const BOOKING: Booking = {
  id: "8f4b1b0e-4d3a-4d5e-9a6f-6e2c1a9b7d31",
  channelName: "ASMR Fixy",
  channelKey: "ASMRFIXY",
  channelUrl: null,
  country: "PL",
  cm: "Lucija P",
  platform: "youtube",
  vertical: "Gaming",
  category: "integration",
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
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
};

/**
 * Billed early at the base tier. The campaign has since returned 120%, which on
 * INT is 144% → c40, so its full charge is 833.33 x 1.4 = 1,166.67 and the
 * snapshot leaves a shortfall the view must surface.
 */
const INVOICE: BookingInvoice = {
  id: "b1c07d1a-6a4c-4c0f-9e2e-2f6f1d0a5b44",
  campaignName: "CHAN_YT_R1",
  channelName: "Channel",
  invoicedAt: "2026-07-20T00:00:00.000Z",
  maturedAtInvoice: false,
  cost: 1000,
  returnPct: 60,
  tier: "c20",
  amount: 900,
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z",
};

describe("almedia tabs render", () => {
  it("renders every insights widget against a populated snapshot", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, { deals: DEALS, options: OPTIONS }),
    );

    expect(html).toContain("Booking suggestions");
    expect(html).toContain("Returns by parameter");
    expect(html).toContain("Views vs realised views");
    expect(html).toContain("Published content");
    expect(html).toContain("Return distribution");
    expect(html).toContain("Unit economics");
    expect(html).toContain("Segment heatmap");
    expect(html).toContain("Budget");
    expect(html).toContain("Best deals per CM");
    expect(html).toContain("Pain points");
    expect(html).toContain("Spend concentration");
    expect(html).toContain("Efficiency scatter");
    expect(html).toContain("Return trend");
    expect(html).toContain("Rebooking &amp; round lift");
    expect(html).toContain("Maturity mix");
    expect(html).toContain("AI analyst");
    // Live spend across the two campaigns that carry a cost.
    expect(html).toContain("$5,000");
  });

  it("offers the analyst's starter questions before the status probe lands", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, { deals: DEALS, options: OPTIONS }),
    );

    expect(html).toContain("Ask anything about the data currently in view");
    expect(html).toContain("Which markets under-deliver on views?");
    // Server-rendered, before the status probe: the composer stays inert so a
    // question cannot be sent to a route that may not be configured.
    expect(html).toContain('placeholder="Ask the analyst…"');
    expect(html).toContain("almedia-analyst__suggestion");
  });

  it("renders the vertical panel with coverage over campaigns only", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, { deals: DEALS, options: OPTIONS }),
    );

    expect(html).toContain("Which verticals pay off?");
    // Both campaigns are enriched; the pipeline booking is not counted.
    expect(html).toContain("2 of 2 campaigns");
    expect(html).toContain("Gaming");
    expect(html).toContain("Lifestyle");
  });

  it("flags Instagram creators and offers controlled manual vertical input", () => {
    const instagramDeal = deal({
      channelKey: "IGCREATOR",
      channelName: "IG Creator",
      campaignName: "IGCREATOR_IG_R1",
      platform: "instagram",
      vertical: null,
      verticals: [],
      needsVerticalInput: true,
      hasEnrichment: false,
      hasBooking: false,
    });
    const secondRound = {
      ...instagramDeal,
      campaignName: "IGCREATOR_IG_R2",
    };
    const rows = instagramVerticalInputRows([instagramDeal, secondRound]);
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, {
        deals: [instagramDeal, secondRound],
        options: EMPTY_OPTIONS,
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      campaignCount: 2,
      channelKey: "IGCREATOR",
    });
    expect(html).toContain("Instagram channels need a vertical");
    expect(html).toContain("Vertical for IG Creator");
    expect(html).toContain("Choose vertical…");
    expect(html).toContain("Save vertical");
    expect(html).toContain("Gaming");
  });

  it("uses a later campaign video when the first creator row has no link", () => {
    const instagramDeal = deal({
      channelKey: "IGCREATOR",
      channelName: "IG Creator",
      platform: "instagram",
      videoUrl: null,
      vertical: null,
      verticals: [],
      needsVerticalInput: true,
    });
    const laterCampaign = {
      ...instagramDeal,
      campaignName: "IGCREATOR_IG_R2",
      videoUrl: "https://www.instagram.com/reel/creator-evidence/",
    };

    expect(
      instagramVerticalInputRows([instagramDeal, laterCampaign])[0]?.videoUrl,
    ).toBe("https://www.instagram.com/reel/creator-evidence/");
  });

  it("offers a vertical override and video evidence without requiring a booking", () => {
    const instagramDeal = deal({
      channelKey: "UNBOOKEDIG",
      channelName: "Unbooked IG",
      platform: "instagram",
      videoUrl: "https://www.instagram.com/reel/unbooked-evidence/",
      vertical: null,
      verticals: [],
      needsVerticalInput: true,
      hasBooking: false,
    });
    const html = renderToStaticMarkup(
      createElement(AlmediaInstagramVerticalQueue, {
        deals: [instagramDeal],
        onMutated: () => undefined,
      }),
    );

    expect(instagramVerticalInputRows([instagramDeal])[0]).toMatchObject({
      channelKey: "UNBOOKEDIG",
      videoUrl: "https://www.instagram.com/reel/unbooked-evidence/",
    });
    expect(html).toContain("Vertical for Unbooked IG");
    expect(html).toContain("https://www.instagram.com/reel/unbooked-evidence/");
    expect(html).toContain("Open an Instagram campaign video for Unbooked IG");
    expect(html).not.toContain("Add this creator in Bookings first");
  });

  it("does not render unsafe API video links", () => {
    const instagramDeal = deal({
      channelKey: "UNSAFEIG",
      channelName: "Unsafe IG",
      platform: "instagram",
      videoUrl: "javascript:alert(document.domain)",
      vertical: null,
      verticals: [],
      needsVerticalInput: true,
    });
    const html = renderToStaticMarkup(
      createElement(AlmediaInstagramVerticalQueue, {
        deals: [instagramDeal],
        onMutated: () => undefined,
      }),
    );

    expect(instagramVerticalInputRows([instagramDeal])[0]?.videoUrl).toBeNull();
    expect(html).not.toContain("javascript:");
  });

  it("shows automatic YouTube status and a manual pending action", () => {
    const pending = deal({
      catalogEnrichmentStatus: "missing",
      vertical: null,
      verticals: [],
    });
    const running = deal({
      channelKey: "RUNNING",
      catalogChannelId: "7fcbcf96-bca7-4bf1-b8ef-71f20f0f703c",
      catalogEnrichmentStatus: "running",
    });
    const unlinked = deal({
      channelKey: "UNLINKED",
      catalogChannelId: null,
      catalogEnrichmentStatus: null,
    });
    const overview = youtubeEnrichmentOverview([pending, running, unlinked]);
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, {
        deals: [pending, running, unlinked],
        options: EMPTY_OPTIONS,
      }),
    );

    expect(overview).toMatchObject({
      linked: 2,
      ready: 0,
      inProgress: 1,
      needsEnrichment: 1,
      unlinked: 1,
    });
    expect(html).toContain("YouTube enrichment");
    expect(html).toContain("Enrich pending (1)");
    expect(html).toContain("awaiting catalog link");
  });

  it("renders the insights tab without any deals", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInsightsTab, { deals: [], options: EMPTY_OPTIONS }),
    );

    expect(html).toContain("Booking suggestions");
    expect(html).toContain("almedia-widget__empty");
    expect(html).toContain("No campaigns in view carry a vertical yet");
  });

  it("renders the performance tab for populated and empty campaign sets", () => {
    const populated = renderToStaticMarkup(
      createElement(AlmediaPerformanceTab, { campaigns: CAMPAIGNS, deals: DEALS }),
    );

    expect(populated).toContain("Your campaigns, clearly measured");
    expect(populated).toContain("Return action tiers");
    expect(populated).toContain("CHAN_YT_R1");
    expect(populated).toContain(
      'href="/catalog/6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b"',
    );

    const unlinked = renderToStaticMarkup(
      createElement(AlmediaPerformanceTab, {
        campaigns: CAMPAIGNS,
        deals: [deal({ catalogChannelId: null })],
      }),
    );

    expect(unlinked).toContain(">Channel</td>");
    expect(unlinked).not.toContain('href="/catalog/');

    const empty = renderToStaticMarkup(
      createElement(AlmediaPerformanceTab, { campaigns: [] }),
    );

    expect(empty).toContain("Your campaigns, clearly measured");
  });

  it("renders the bookings tab, and invites the first booking when empty", () => {
    const populated = renderToStaticMarkup(
      createElement(AlmediaBookingsTab, {
        bookings: [BOOKING],
        deals: [deal({ channelKey: "ASMRFIXY" })],
        onMutated: () => undefined,
      }),
    );

    expect(populated).toContain("What have we booked?");
    expect(populated).toContain("ASMR Fixy");
    expect(populated).toContain("ASMRFIXY");
    expect(populated).toContain("Published");
    expect(populated).toContain("1 of 1");
    expect(populated).toContain(
      'href="/catalog/6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b"',
    );

    const unlinked = renderToStaticMarkup(
      createElement(AlmediaBookingsTab, {
        bookings: [BOOKING],
        deals: [deal({ channelKey: "ASMRFIXY", catalogChannelId: null })],
        onMutated: () => undefined,
      }),
    );

    expect(unlinked).toContain(">ASMR Fixy</span>");
    expect(unlinked).not.toContain('href="/catalog/');

    const empty = renderToStaticMarkup(
      createElement(AlmediaBookingsTab, { bookings: [], onMutated: () => undefined }),
    );

    expect(empty).toContain("No bookings yet");
  });

  it("renders the invoices tab with both billing lenses", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInvoicesTab, {
        deals: DEALS,
        invoices: [INVOICE],
        onMutated: () => undefined,
      }),
    );

    expect(html).toContain("What is still to invoice?");
    expect(html).toContain("By invoice month");
    expect(html).toContain("By publish month");
    // July (cost 1,000) and August (cost 4,000) publish batches.
    expect(html).toContain("Jul 2026");
    expect(html).toContain("Aug 2026");
    // The recorded July charge is excluded; only its $267 top-up plus August's
    // $4,000 cost remains outstanding, through the shared formatter.
    expect(html).toContain("$4,267");
    // The recorded snapshot for the July campaign, and the shortfall it leaves.
    expect(html).toContain("billed $900");
    expect(html).toContain("still owed");
  });

  it("renders the invoices tab with nothing billable", () => {
    const html = renderToStaticMarkup(
      createElement(AlmediaInvoicesTab, {
        deals: [],
        invoices: [],
        onMutated: () => undefined,
      }),
    );

    expect(html).toContain("What is still to invoice?");
    expect(html).toContain("No invoice activity for this month");
  });

  it("renders the scorecard tab for populated and empty plans", () => {
    const populated = renderToStaticMarkup(
      createElement(AlmediaScorecardTab, { scorecard: SCORECARD }),
    );

    expect(populated).toContain("Are we on pace?");
    expect(populated).toContain("Lucija P");

    const empty = renderToStaticMarkup(
      createElement(AlmediaScorecardTab, { scorecard: EMPTY_SCORECARD }),
    );

    expect(empty).toContain("Are we on pace?");
  });
});

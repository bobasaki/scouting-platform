import { describe, expect, it } from "vitest";

import {
  ALMEDIA_DIMENSIONS,
  almediaCampaignsResponseSchema,
  almediaChannelEnrichmentSchema,
  almediaDealsResponseSchema,
  almediaScorecardResponseSchema,
  almediaSyncStatusSchema,
  bookingInputSchema,
  bookingInvoiceInputSchema,
  bookingSchema,
  bookingUpdateInputSchema,
  type AlmediaDeal,
} from "./almedia";
import { parseJobPayload } from "./jobs";

const TEST_UUID = "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b";

const syncStatus = {
  status: "completed",
  agency: "ARCH.",
  campaignCount: 2,
  syncedAt: "2026-08-10T09:00:00.000Z",
  startedAt: "2026-08-10T08:59:00.000Z",
  completedAt: "2026-08-10T09:00:00.000Z",
  lastError: null,
};

const allOptions = {
  cm: ["Marin"],
  country: ["DE"],
  vertical: ["ASMR"],
  category: ["integration"],
  platform: ["youtube"],
  sizeTier: ["10-20k"],
  status: ["published"],
  month: ["2026-03"],
};

const deal: AlmediaDeal = {
  channelKey: "ASMRFIXY",
  channelName: "ASMR Fixy",
  campaignName: "ASMRFIXY_YT_R1",
  videoUrl: "https://www.youtube.com/watch?v=abc",
  platform: "youtube",
  publishedAt: "2026-03-01",
  cost: 1000,
  expectedCpm: 12.5,
  viewCount: 84_000,
  returnPct: 110,
  signupsPct: 0.021,
  d7Purchases: 210,
  roasReturn: 1.12,
  appuD14: 3.4,
  expectedViews: 80_000,
  deliveryPct: 105,
  cm: "Marin",
  country: "DE",
  vertical: "ASMR",
  verticals: ["ASMR"],
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
  month: "2026-03",
  sizeTier: "10-20k",
  hasCampaign: true,
  hasBooking: true,
  returnTier: "longterm",
  maturity: { status: "matured", daysRemaining: 0 },
};

describe("almedia contracts", () => {
  it("round-trips a deals response", () => {
    const payload = {
      deals: [deal],
      options: allOptions,
      sync: syncStatus,
    };

    expect(almediaDealsResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects a deal whose month is not ISO YYYY-MM", () => {
    const result = almediaDealsResponseSchema.safeParse({
      deals: [{ ...deal, month: "March 2026" }],
      options: allOptions,
      sync: syncStatus,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown booking status", () => {
    const result = almediaDealsResponseSchema.safeParse({
      deals: [{ ...deal, status: "cancelled" }],
      options: allOptions,
      sync: syncStatus,
    });

    expect(result.success).toBe(false);
  });

  it("round-trips a campaigns response", () => {
    const payload = {
      campaigns: [
        {
          campaignName: "ASMRFIXY_YT_R1",
          campaignSource: "ARCH.",
          platform: "youtube",
          country: "DE",
          publishedAt: "2026-03-01T00:00:00.000Z",
          cost: 1000,
          expectedCpm: 12.5,
          viewCount: 84_000,
          signupsPct: 0.021,
          roasD7pD14: 0.63,
          roasReturn: 1.12,
          returnPct: 110,
          appuD14: 3.4,
          d7Purchases: 210,
          channelName: "ASMR Fixy",
          videoUrl: null,
        },
      ],
      sync: syncStatus,
    };

    expect(almediaCampaignsResponseSchema.parse(payload)).toEqual(payload);
  });

  it("round-trips a scorecard response", () => {
    const tiers = { under10k: 1, from10kTo20k: 2, from20kTo50k: 0, over50k: 0 };
    const counts = {
      pipeline: 1,
      booked: 2,
      published: 3,
      longterm: 0,
      dropped: 1,
    };
    const payload = {
      months: [
        {
          month: "2026-03",
          targetEur: 50_000,
          bookedEur: 42_000,
          counts,
          utilization: 0.84,
          pace: null,
          dropoutRate: 0.16,
        },
      ],
      rows: [
        {
          cm: "Marin",
          market: "DE",
          month: "2026-03",
          targetEur: 50_000,
          targetTiers: tiers,
          bookedEur: 42_000,
          bookedTiers: tiers,
          counts,
          utilization: 0.84,
          pace: null,
          dropoutRate: 0.16,
        },
      ],
      unscheduledCount: 4,
    };

    expect(almediaScorecardResponseSchema.parse(payload)).toEqual(payload);
  });

  it("accepts a sync status that has never run", () => {
    expect(
      almediaSyncStatusSchema.parse({
        status: null,
        agency: null,
        campaignCount: 0,
        syncedAt: null,
        startedAt: null,
        completedAt: null,
        lastError: null,
      }).status,
    ).toBeNull();
  });

  it("requires bookings to carry an ISO day publishedAt", () => {
    const base = {
      id: TEST_UUID,
      channelName: "ASMR Fixy",
      channelKey: "ASMRFIXY",
      channelUrl: null,
      country: "DE",
      cm: "Marin",
      platform: "youtube",
      vertical: "ASMR",
      category: null,
      status: "booked",
      activation: null,
      numActivations: null,
      contractSigned: true,
      contractUrl: null,
      intBudget: 12_000,
      extBudget: 15_000,
      currency: "EUR",
      month: "2026-03",
      note: null,
      videoUrl: null,
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-02T00:00:00.000Z",
    };

    expect(bookingSchema.parse({ ...base, publishedAt: "2026-03-01" }).publishedAt).toBe(
      "2026-03-01",
    );
    expect(bookingSchema.safeParse({ ...base, publishedAt: "01/03/2026" }).success).toBe(
      false,
    );
  });

  it("lists the eight filter dimensions in filter-bar order", () => {
    expect(ALMEDIA_DIMENSIONS.map((dimension) => dimension.id)).toEqual([
      "cm",
      "country",
      "vertical",
      "category",
      "platform",
      "sizeTier",
      "status",
      "month",
    ]);
  });

  it("parses an almedia.campaigns.sync job payload", () => {
    expect(
      parseJobPayload("almedia.campaigns.sync", {
        initiatedBy: "admin",
        syncRunId: TEST_UUID,
        requestedByUserId: TEST_UUID,
      }),
    ).toEqual({
      initiatedBy: "admin",
      syncRunId: TEST_UUID,
      requestedByUserId: TEST_UUID,
    });

    expect(
      parseJobPayload("almedia.campaigns.sync", {
        initiatedBy: "system",
        syncRunId: TEST_UUID,
      }),
    ).toEqual({ initiatedBy: "system", syncRunId: TEST_UUID });

    expect(() =>
      parseJobPayload("almedia.campaigns.sync", { initiatedBy: "system" }),
    ).toThrow();
  });
});

/** Shaped like a real tracker document, trimmed to the projected keys. */
const enrichmentDocument = {
  channel: {
    id: "UChoZqpn_fLmoExx2g4KL58A",
    title: "Damon Verial",
    description: "True Crime.",
    country: null,
    topics: ["Entertainment", "Society"],
    keywords: ["true crime", "interrogation analysis"],
  },
  metrics: {
    followers: 236_000,
    typicalViews: { median: 30_542 },
    typicalEngagementRatePct: 3.97,
    contentFormat: { dominant: "long_form" },
  },
  classification: {
    niche: "finance",
    topics: ["true crime", "criminal psychology"],
    audiencePositioning: "finance creator publishing primarily long form content",
    brandFit: { suitability: "medium", categories: ["fintech", "finance"] },
    brandSafety: { risk: "low" },
  },
  summary: "Damon Verial is classified as a finance YouTube creator.",
};

describe("channel enrichment contract", () => {
  it("parses a tracker document and strips the keys the workspace never reads", () => {
    const parsed = almediaChannelEnrichmentSchema.parse({
      ...enrichmentDocument,
      schemaVersion: "1.0",
      recentContent: [{ id: "4Om3pODlh24", views: 27_967 }],
      confidence: { overall: 0.86 },
      meta: { analyzer: "rule_based_metadata_v1" },
      channel: { ...enrichmentDocument.channel, subscribersHidden: false },
    });

    expect(parsed).toEqual(enrichmentDocument);
  });

  it("rejects a document with an unknown brand-fit or safety value", () => {
    expect(
      almediaChannelEnrichmentSchema.safeParse({
        ...enrichmentDocument,
        classification: {
          ...enrichmentDocument.classification,
          brandFit: { suitability: "excellent", categories: [] },
        },
      }).success,
    ).toBe(false);

    expect(
      almediaChannelEnrichmentSchema.safeParse({
        ...enrichmentDocument,
        classification: {
          ...enrichmentDocument.classification,
          brandSafety: { risk: "catastrophic" },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps a creator whose metrics were never measured", () => {
    const parsed = almediaChannelEnrichmentSchema.parse({
      ...enrichmentDocument,
      metrics: {
        followers: null,
        typicalViews: { median: null },
        typicalEngagementRatePct: null,
        contentFormat: { dominant: "unknown" },
      },
    });

    expect(parsed.metrics.followers).toBeNull();
    expect(parsed.metrics.contentFormat.dominant).toBe("unknown");
  });
});

describe("booking write contracts", () => {
  it("normalizes blank text to null and leaves omitted keys unset", () => {
    const parsed = bookingInputSchema.parse({
      channelName: "  ASMR Fixy  ",
      channelKey: "",
      channelUrl: "",
      country: "DE",
      cm: "",
      platform: "youtube",
      vertical: "",
      category: "",
      activation: "",
      contractUrl: "",
      publishedAt: "",
      month: "",
      note: "",
      videoUrl: "",
    });

    expect(parsed).toEqual({
      channelName: "ASMR Fixy",
      channelKey: null,
      channelUrl: null,
      country: "DE",
      cm: null,
      platform: "youtube",
      vertical: null,
      category: null,
      activation: null,
      contractUrl: null,
      publishedAt: null,
      month: null,
      note: null,
      videoUrl: null,
    });
  });

  it("uppercases the currency and keeps well-formed dates", () => {
    const parsed = bookingInputSchema.parse({
      channelName: "ASMR Fixy",
      currency: "usd",
      month: "2026-03",
      publishedAt: "2026-03-14",
      intBudget: 12_000,
      extBudget: 15_000,
      status: "booked",
      numActivations: 2,
      contractSigned: true,
    });

    expect(parsed.currency).toBe("USD");
    expect(parsed.month).toBe("2026-03");
    expect(parsed.publishedAt).toBe("2026-03-14");
    expect(parsed.status).toBe("booked");
  });

  it("rejects an empty channel name, a bad month, and a negative budget", () => {
    expect(() => bookingInputSchema.parse({ channelName: "   " })).toThrow();
    expect(() =>
      bookingInputSchema.parse({ channelName: "ASMR Fixy", month: "2026-3" }),
    ).toThrow();
    expect(() =>
      bookingInputSchema.parse({ channelName: "ASMR Fixy", intBudget: -1 }),
    ).toThrow();
  });

  it("accepts a partial update but rejects an empty one", () => {
    expect(bookingUpdateInputSchema.parse({ status: "published" })).toEqual({
      status: "published",
    });
    expect(() => bookingUpdateInputSchema.parse({})).toThrow();
  });
});

describe("bookingInvoiceInputSchema", () => {
  const invoice = {
    campaignName: "ASMRFIXY_YT_R1",
    channelName: "ASMR Fixy",
    invoicedAt: "2026-07-31T09:00:00.000Z",
    maturedAtInvoice: false,
    cost: 12_000,
    returnPct: 118.4,
    tier: "c30",
    amount: 13_000,
  } as const;

  it("accepts a snapshot taken before the campaign matured", () => {
    expect(bookingInvoiceInputSchema.parse(invoice)).toEqual(invoice);
  });

  it("accepts a campaign with no return figure yet", () => {
    expect(
      bookingInvoiceInputSchema.parse({ ...invoice, returnPct: null }).returnPct,
    ).toBeNull();
  });

  it("rejects an off-card tier, a negative amount, and a blank campaign name", () => {
    expect(() =>
      bookingInvoiceInputSchema.parse({ ...invoice, tier: "c35" }),
    ).toThrow();
    expect(() =>
      bookingInvoiceInputSchema.parse({ ...invoice, amount: -1 }),
    ).toThrow();
    expect(() =>
      bookingInvoiceInputSchema.parse({ ...invoice, campaignName: "   " }),
    ).toThrow();
  });
});

import type {
  AlmediaDeal,
  AlmediaMaturityStatus,
  BookingInvoice,
} from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import {
  blendedReturn,
  buildInvoiceBatches,
  buildInvoiceMonths,
  invoiceAmount,
  invoiceTier,
  invoiceTotals,
  prevMonth,
  undatedSpend,
  type InvoiceBatch,
  type InvoiceMonth,
} from "./invoicing";

/**
 * Maturity is stamped server-side on the deal, so these fixtures set it
 * directly rather than deriving it from a publish date and a clock.
 */
function deal(
  overrides: Partial<AlmediaDeal> & { campaignName: string },
): AlmediaDeal {
  return {
    channelKey: overrides.campaignName,
    channelName: overrides.campaignName,
    videoUrl: null,
    platform: null,
    publishedAt: null,
    cost: 10_000,
    expectedCpm: null,
    viewCount: null,
    returnPct: 50,
    signupsPct: null,
    d7Purchases: null,
    roasReturn: null,
    appuD14: null,
    expectedViews: null,
    deliveryPct: null,
    cm: null,
    country: null,
    vertical: null,
    verticals: [],
    category: null,
    hasEnrichment: false,
    creatorFollowers: null,
    creatorTypicalViews: null,
    creatorEngagementRatePct: null,
    creatorContentFormat: null,
    creatorBrandFit: null,
    creatorSafetyRisk: null,
    status: null,
    intBudget: null,
    extBudget: null,
    month: null,
    sizeTier: null,
    hasCampaign: true,
    hasBooking: false,
    returnTier: null,
    maturity: { status: "matured", daysRemaining: 0 },
    ...overrides,
  };
}

function maturity(
  status: AlmediaMaturityStatus,
  daysRemaining: number | null = null,
): AlmediaDeal["maturity"] {
  return { status, daysRemaining };
}

const MATURING = maturity("maturing", 12);

function byMonth<T extends { month: string }>(
  entries: readonly T[],
): Record<string, T> {
  return Object.fromEntries(entries.map((entry) => [entry.month, entry]));
}

function batchFor(entries: readonly InvoiceBatch[], month: string): InvoiceBatch {
  const found = byMonth(entries)[month];

  if (!found) {
    throw new Error(`No batch for ${month}`);
  }

  return found;
}

function monthFor(entries: readonly InvoiceMonth[], month: string): InvoiceMonth {
  const found = byMonth(entries)[month];

  if (!found) {
    throw new Error(`No invoice month for ${month}`);
  }

  return found;
}

describe("invoiceTier / invoiceAmount", () => {
  it("maps the return % to its commission tier on inclusive lower bounds", () => {
    expect(invoiceTier(50).id).toBe("c20");
    expect(invoiceTier(99).id).toBe("c20");
    expect(invoiceTier(100).id).toBe("c25");
    expect(invoiceTier(109).id).toBe("c25");
    expect(invoiceTier(110).id).toBe("c30");
    expect(invoiceTier(129).id).toBe("c30");
    expect(invoiceTier(130).id).toBe("c40");
    expect(invoiceTier(149).id).toBe("c40");
    expect(invoiceTier(150).id).toBe("c50");
    expect(invoiceTier(179).id).toBe("c50");
    expect(invoiceTier(180).id).toBe("c60");
    expect(invoiceTier(249).id).toBe("c60");
    expect(invoiceTier(250).id).toBe("c80");
    expect(invoiceTier(329).id).toBe("c80");
    expect(invoiceTier(330).id).toBe("c100");
    expect(invoiceTier(900).id).toBe("c100");
    expect(invoiceTier(null).id).toBe("c20");
  });

  it("charges the INT price (cost / 1.2) marked up by the tier commission", () => {
    // cost 12,000 → INT 10,000
    expect(invoiceAmount(12_000, 50)).toBe(12_000); // base +20% → INT x 1.2 = cost
    expect(invoiceAmount(12_000, 100)).toBe(12_500);
    expect(invoiceAmount(12_000, 150)).toBe(15_000);
    expect(invoiceAmount(12_000, 330)).toBe(20_000);
    expect(invoiceAmount(12_000, 900)).toBe(20_000); // open-ended top tier
    expect(invoiceAmount(null, 50)).toBeNull();
  });
});

describe("blendedReturn", () => {
  it("blends media spend against INT — the multiple that picks the tier", () => {
    expect(
      blendedReturn([
        { int: 5_000, mediaSpend: 15_000 },
        { int: 5_000, mediaSpend: 5_000 },
      ]),
    ).toBeCloseTo(200, 6);
  });

  it("uses INT, not cost, as the denominator", () => {
    // INT 178,622.50 against 185,766.23 media spend → 104% (86.7% against cost).
    const value = blendedReturn([{ int: 178_622.5, mediaSpend: 185_766.23 }]);

    expect(value).toBeCloseTo(104, 1);
    expect(invoiceTier(value).id).toBe("c25");
  });

  it("counts INT even with no media spend yet, and is null with no INT", () => {
    expect(blendedReturn([{ int: 5_000, mediaSpend: null }])).toBe(0);
    expect(blendedReturn([])).toBeNull();
  });
});

describe("buildInvoiceBatches", () => {
  it("bills the whole month at the tier its blended return earns", () => {
    // INT = cost / 1.2 → 5k each, Σ INT 10,000. Media spend 18,000 + 6,000.
    // Blended on INT: 24,000 / 10,000 = 240% → c60 (180 ≤ 240 < 250).
    const batches = buildInvoiceBatches([
      deal({ campaignName: "A", publishedAt: "2026-08-01", cost: 6_000, returnPct: 300 }),
      deal({ campaignName: "B", publishedAt: "2026-08-01", cost: 6_000, returnPct: 100 }),
    ]);

    expect(batches).toHaveLength(1);

    const batch = batchFor(batches, "2026-08");

    expect(batch.blendedReturn).toBeCloseTo(240, 6);
    expect(batch.tier.id).toBe("c60");
    expect(batch.intTotal).toBe(10_000);
    expect(batch.baseTotal).toBe(12_000); // Σ Almedia cost billed up front
    expect(batch.performanceFee).toBe(4_000); // ΣINT x 1.6 − Σcost
    expect(batch.amount).toBe(16_000);
    expect(batch.memberCount).toBe(2);
    expect(batch.includedCount).toBe(2);
    expect(batch.maturingCount).toBe(0);
    expect(batch.feeSettled).toBe(true);

    // Per member at the batch tier: INT 5k x 1.6 − cost 6k = 2,000.
    const members = Object.fromEntries(
      batch.members.map((member) => [member.campaignName, member]),
    );

    expect(members.A?.baseAmount).toBe(6_000);
    expect(members.A?.int).toBe(5_000);
    expect(members.A?.mediaSpend).toBe(18_000);
    expect(members.A?.performanceFee).toBe(2_000);
    expect(members.B?.performanceFee).toBe(2_000);
  });

  it("bills cost up front for every campaign but fees only the matured cohort", () => {
    const batch = batchFor(
      buildInvoiceBatches([
        deal({
          campaignName: "DONE",
          publishedAt: "2026-08-01",
          cost: 6_000,
          returnPct: 300,
        }),
        deal({
          campaignName: "YOUNG",
          publishedAt: "2026-08-18",
          cost: 9_000,
          returnPct: 300,
          maturity: MATURING,
        }),
      ]),
      "2026-08",
    );

    expect(batch.memberCount).toBe(2);
    expect(batch.includedCount).toBe(1);
    expect(batch.maturingCount).toBe(1);
    expect(batch.feeSettled).toBe(false);
    expect(batch.baseTotal).toBe(15_000); // every campaign's cost up front
    // Fee on the matured cohort only: 18,000 / 5,000 = 360% → c100.
    expect(batch.blendedReturn).toBeCloseTo(360, 6);
    expect(batch.tier.id).toBe("c100");
    expect(batch.performanceFee).toBe(4_000);
    expect(batch.amount).toBe(19_000);
  });

  it("marks cost invoiced through the cutoff month", () => {
    const batches = buildInvoiceBatches([
      deal({ campaignName: "OLD", publishedAt: "2026-05-10", cost: 6_000 }),
      deal({ campaignName: "NEW", publishedAt: "2026-07-10", cost: 6_000 }),
    ]);

    expect(batchFor(batches, "2026-05").costInvoiced).toBe(true);
    expect(batchFor(batches, "2026-07").costInvoiced).toBe(false);
  });

  it("floors the fee at zero when the blend sits at or below the base tier", () => {
    // cost 6k → INT 5k, media spend 2,880 → 57.6% on INT → c20, so INT x 1.2 = cost.
    const batch = batchFor(
      buildInvoiceBatches([
        deal({
          campaignName: "LOW",
          publishedAt: "2026-08-01",
          cost: 6_000,
          returnPct: 48,
        }),
      ]),
      "2026-08",
    );

    expect(batch.blendedReturn).toBeCloseTo(57.6, 6);
    expect(batch.tier.id).toBe("c20");
    expect(batch.performanceFee).toBe(0);
    expect(batch.amount).toBe(6_000);
    expect(batch.members[0]?.performanceFee).toBe(0);
  });

  it("re-blends and can jump the batch tier when a maturing member opts in", () => {
    const deals = [
      deal({ campaignName: "MAT", publishedAt: "2026-08-01", cost: 6_000, returnPct: 48 }),
      deal({
        campaignName: "FRESH",
        publishedAt: "2026-08-18",
        cost: 6_000,
        returnPct: 480,
        maturity: MATURING,
      }),
    ];

    // Only the 48% flop counts → c20, fee floored to zero.
    const before = batchFor(buildInvoiceBatches(deals), "2026-08");

    expect(before.tier.id).toBe("c20");
    expect(before.performanceFee).toBe(0);
    expect(before.includedCount).toBe(1);
    expect(before.baseTotal).toBe(12_000); // both costs billed regardless

    // Opting the giant in: (2,880 + 28,800) / 10,000 INT = 316.8% → c80.
    const after = batchFor(
      buildInvoiceBatches(deals, { includedCampaigns: new Set(["FRESH"]) }),
      "2026-08",
    );

    expect(after.tier.id).toBe("c80");
    expect(after.baseTotal).toBe(12_000);
    expect(after.performanceFee).toBe(6_000); // 10,000 x 1.8 − 12,000
    expect(after.includedCount).toBe(2);
  });

  it("excludes campaigns with no publish date or no cost", () => {
    const batches = buildInvoiceBatches([
      deal({ campaignName: "NOCOST", publishedAt: "2026-08-01", cost: null }),
      deal({ campaignName: "NODATE", publishedAt: null, cost: 12_000 }),
      deal({ campaignName: "OK", publishedAt: "2026-08-01", cost: 12_000 }),
    ]);

    expect(batches).toHaveLength(1);
    expect(batches[0]?.members).toHaveLength(1);
    expect(batches[0]?.members[0]?.campaignName).toBe("OK");
  });

  it("orders batches most-recent publish month first", () => {
    const batches = buildInvoiceBatches([
      deal({ campaignName: "OLD", publishedAt: "2026-05-02", cost: 6_000 }),
      deal({ campaignName: "NEW", publishedAt: "2026-07-02", cost: 6_000 }),
    ]);

    expect(batches.map((batch) => batch.month)).toEqual(["2026-07", "2026-05"]);
    expect(batches[0]?.feeMonth).toBe("2026-08");
  });

  it("strips the campaign suffix from an unbooked creator's display name", () => {
    const batch = batchFor(
      buildInvoiceBatches([
        deal({
          campaignName: "ASMRFIXY_YT_R3",
          channelName: "ASMRFIXY_YT_R3",
          publishedAt: "2026-08-01",
          cost: 6_000,
        }),
      ]),
      "2026-08",
    );

    expect(batch.members[0]?.channelName).toBe("ASMRFIXY");
    expect(batch.members[0]?.round).toBe(3);
  });
});

describe("invoice snapshots", () => {
  function snapshot(overrides: Partial<BookingInvoice> = {}): BookingInvoice {
    return {
      id: "3f6a3d5e-2b39-4a0e-9c11-9f0f7f4a1c22",
      campaignName: "EARLY",
      channelName: "Early",
      invoicedAt: "2026-08-05T00:00:00.000Z",
      maturedAtInvoice: false,
      cost: 6_000,
      returnPct: 50,
      tier: "c20",
      amount: 6_000,
      createdAt: "2026-08-05T00:00:00.000Z",
      updatedAt: "2026-08-05T00:00:00.000Z",
      ...overrides,
    };
  }

  it("owes the difference when a campaign billed early climbs a tier", () => {
    // Billed at the base tier for 6,000. It has since returned 300%, which on
    // INT is 360% → c100, so the full charge is 5,000 x 2 = 10,000.
    const batch = batchFor(
      buildInvoiceBatches(
        [
          deal({
            campaignName: "EARLY",
            publishedAt: "2026-08-01",
            cost: 6_000,
            returnPct: 300,
          }),
        ],
        { invoices: new Map([["EARLY", snapshot()]]) },
      ),
      "2026-08",
    );

    expect(batch.invoicedCount).toBe(1);
    expect(batch.members[0]?.invoice?.tier).toBe("c20");
    expect(batch.members[0]?.topUp).toBe(4_000);
    expect(batch.topUpTotal).toBe(4_000);
  });

  it("owes nothing further when the snapshot already covers the charge", () => {
    const batch = batchFor(
      buildInvoiceBatches(
        [
          deal({
            campaignName: "EARLY",
            publishedAt: "2026-08-01",
            cost: 6_000,
            returnPct: 300,
          }),
        ],
        {
          invoices: new Map([
            ["EARLY", snapshot({ tier: "c100", amount: 10_000 })],
          ]),
        },
      ),
      "2026-08",
    );

    expect(batch.members[0]?.topUp).toBe(0);
    expect(batch.topUpTotal).toBe(0);
  });

  it("leaves the top-up null for a campaign that was never invoiced", () => {
    const batch = batchFor(
      buildInvoiceBatches([
        deal({ campaignName: "NEVER", publishedAt: "2026-08-01", cost: 6_000 }),
      ]),
      "2026-08",
    );

    expect(batch.members[0]?.invoice).toBeNull();
    expect(batch.members[0]?.topUp).toBeNull();
    expect(batch.invoicedCount).toBe(0);
  });
});

describe("buildInvoiceMonths", () => {
  it("puts this month's cost and last month's fee on one calendar invoice", () => {
    const batches = buildInvoiceBatches([
      deal({ campaignName: "JUN-A", publishedAt: "2026-06-01", cost: 6_000, returnPct: 300 }),
      deal({ campaignName: "JUN-B", publishedAt: "2026-06-01", cost: 6_000, returnPct: 100 }),
      deal({ campaignName: "JUL-A", publishedAt: "2026-07-01", cost: 6_000, returnPct: 300 }),
      deal({ campaignName: "JUL-B", publishedAt: "2026-07-01", cost: 6_000, returnPct: 100 }),
    ]);
    const months = buildInvoiceMonths(batches);

    // The July invoice = July's new cost + June's carried fee.
    const july = monthFor(months, "2026-07");

    expect(july.newCost).toBe(12_000);
    expect(july.carriedFee).toBe(4_000);
    expect(july.feeBatch?.month).toBe("2026-06");
    expect(july.feeSettled).toBe(true);
    expect(july.total).toBe(16_000);

    // June carries no prior fee here — there is no May batch.
    const june = monthFor(months, "2026-06");

    expect(june.newCost).toBe(12_000);
    expect(june.carriedFee).toBe(0);
    expect(june.total).toBe(12_000);

    // A trailing fee-only month appears for July's fee.
    const august = monthFor(months, "2026-08");

    expect(august.newCost).toBe(0);
    expect(august.costBatch).toBeNull();
    expect(august.carriedFee).toBe(4_000);
    expect(august.total).toBe(4_000);
  });

  it("keeps a still-maturing fee out of the billable total as pending", () => {
    const batches = buildInvoiceBatches([
      deal({ campaignName: "DONE", publishedAt: "2026-08-01", cost: 6_000, returnPct: 300 }),
      deal({
        campaignName: "YOUNG",
        publishedAt: "2026-08-18",
        cost: 9_000,
        returnPct: 300,
        maturity: MATURING,
      }),
    ]);

    expect(batches[0]?.feeSettled).toBe(false);

    const september = monthFor(buildInvoiceMonths(batches), "2026-09");

    expect(september.newCost).toBe(0);
    expect(september.feeSettled).toBe(false);
    expect(september.carriedFee).toBe(0);
    expect(september.feePending).toBeGreaterThan(0);
    expect(september.total).toBe(0);
  });

  it("carries no fee for a base-tier month", () => {
    const months = buildInvoiceMonths(
      buildInvoiceBatches([
        deal({ campaignName: "LOW", publishedAt: "2026-06-01", cost: 6_000, returnPct: 48 }),
      ]),
    );
    const july = monthFor(months, "2026-07");

    expect(july.carriedFee).toBe(0);
    expect(july.feePending).toBe(0);
    expect(july.total).toBe(0);
  });
});

describe("invoiceTotals / undatedSpend / prevMonth", () => {
  it("splits totals into invoiced cost, cost due, and settled versus pending fees", () => {
    const months = buildInvoiceMonths(
      buildInvoiceBatches([
        // May is inside the invoiced-through cutoff; August is not.
        deal({ campaignName: "MAY", publishedAt: "2026-05-01", cost: 6_000, returnPct: 300 }),
        deal({ campaignName: "AUG", publishedAt: "2026-08-01", cost: 6_000, returnPct: 300 }),
      ]),
    );
    const totals = invoiceTotals(months);

    expect(totals.costInvoiced).toBe(6_000);
    expect(totals.costDue).toBe(6_000);
    // Each batch is a single 300% campaign → c100, so INT 5,000 x 2 − 6,000.
    expect(totals.feesDue).toBe(8_000);
    expect(totals.feesPending).toBe(0);
    expect(totals.dueNow).toBe(14_000);
  });

  it("counts spend that has no usable publish month", () => {
    expect(
      undatedSpend([
        deal({ campaignName: "DATED", publishedAt: "2026-08-01", cost: 6_000 }),
        deal({ campaignName: "UNDATED", publishedAt: null, cost: 4_000 }),
        deal({ campaignName: "FREE", publishedAt: null, cost: 0 }),
      ]),
    ).toEqual({ cost: 4_000, count: 1 });
  });

  it("rolls the month key back across a year boundary", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(prevMonth("2026-08")).toBe("2026-07");
  });
});

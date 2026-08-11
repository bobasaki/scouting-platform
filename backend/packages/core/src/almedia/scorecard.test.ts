import type { Booking } from "@scouting-platform/contracts";
import { describe, expect, it } from "vitest";

import {
  buildScorecard,
  isoMonthOf,
  monthElapsedFraction,
  type BookingPlanTarget,
  type MonthlyRevenueTarget,
} from "./scorecard";

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    channelName: "Channel",
    channelKey: "CHANNEL",
    channelUrl: null,
    country: "PL",
    cm: "Lucija P",
    platform: null,
    vertical: null,
    category: null,
    status: "booked",
    activation: null,
    numActivations: null,
    contractSigned: false,
    contractUrl: null,
    publishedAt: null,
    intBudget: null,
    extBudget: null,
    currency: "USD",
    month: "2026-08",
    note: null,
    videoUrl: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const TARGETS: BookingPlanTarget[] = [
  {
    cm: "Lucija P",
    market: "PL",
    month: "2026-08",
    budgetEur: 70_000,
    tierCounts: { under10k: 0, from10kTo20k: 2, from20kTo50k: 1, over50k: 0 },
  },
  {
    cm: "Miro",
    market: "US",
    month: "2026-08",
    budgetEur: 50_000,
    tierCounts: { under10k: 0, from10kTo20k: 2, from20kTo50k: 1, over50k: 0 },
  },
];

const REVENUE: MonthlyRevenueTarget[] = [{ month: "2026-08", totalEur: 560_000 }];

// 2026-08-16T12:00Z is exactly half of August elapsed.
const MID_AUGUST = new Date("2026-08-16T12:00:00Z");

describe("buildScorecard", () => {
  it("sums committed bookings against the matching target", () => {
    const scorecard = buildScorecard(
      [
        booking({ intBudget: 15_000, status: "booked" }),
        booking({ intBudget: 20_000, status: "published" }),
        booking({ intBudget: 8_000, status: "longterm" }),
        booking({ intBudget: 99_000, status: "pipeline" }), // not committed
        booking({ intBudget: 12_000, status: "dropped" }), // not committed
      ],
      TARGETS,
      REVENUE,
      MID_AUGUST,
    );

    const row = scorecard.rows.find((entry) => entry.cm === "Lucija P");

    expect(row).toMatchObject({
      market: "PL",
      month: "2026-08",
      targetAmount: 70_000,
      bookedAmount: 43_000,
      bookedTiers: { under10k: 1, from10kTo20k: 1, from20kTo50k: 1, over50k: 0 },
      counts: { pipeline: 1, booked: 1, published: 1, longterm: 1, dropped: 1 },
    });
    expect(row?.utilization).toBeCloseTo(43_000 / 70_000, 10);
    // dropped=1 vs committed=3
    expect(row?.dropoutRate).toBeCloseTo(0.25, 10);
    // half the month elapsed: pace = utilization / 0.5
    expect(row?.pace).toBeCloseTo((43_000 / 70_000) * 2, 10);
  });

  it("emits zeroed rows for targets with no bookings", () => {
    const scorecard = buildScorecard([], TARGETS, REVENUE, MID_AUGUST);
    const miro = scorecard.rows.find((entry) => entry.cm === "Miro");

    expect(miro).toMatchObject({ bookedAmount: 0, utilization: 0, dropoutRate: null });
    expect(scorecard.rows).toHaveLength(2);
  });

  it("surfaces bookings outside the plan as untargeted rows", () => {
    const scorecard = buildScorecard(
      [booking({ cm: "JB", country: "BR", intBudget: 5_000 })],
      TARGETS,
      REVENUE,
      MID_AUGUST,
    );

    expect(scorecard.rows.find((entry) => entry.cm === "JB")).toMatchObject({
      market: "BR",
      targetAmount: null,
      utilization: null,
      bookedAmount: 5_000,
    });
  });

  it("keeps CM names containing spaces intact when splitting group keys", () => {
    const scorecard = buildScorecard(
      [booking({ cm: "Ana Maria Perez", country: "ES", intBudget: 3_000 })],
      [],
      [],
      MID_AUGUST,
    );

    expect(scorecard.rows[0]).toMatchObject({
      cm: "Ana Maria Perez",
      market: "ES",
      month: "2026-08",
    });
  });

  it("computes monthly summaries against revenue targets", () => {
    const scorecard = buildScorecard(
      [booking({ intBudget: 56_000 })],
      TARGETS,
      REVENUE,
      MID_AUGUST,
    );

    expect(scorecard.months).toHaveLength(1);
    expect(scorecard.months[0]).toMatchObject({
      month: "2026-08",
      targetAmount: 560_000,
      bookedAmount: 56_000,
    });
    expect(scorecard.months[0]?.utilization).toBeCloseTo(0.1, 10);
    expect(scorecard.months[0]?.pace).toBeCloseTo(0.2, 10);
  });

  it("only paces the month containing now", () => {
    const august = TARGETS[0];

    if (!august) {
      throw new Error("expected an August target fixture");
    }

    const september: BookingPlanTarget = { ...august, month: "2026-09" };
    const scorecard = buildScorecard(
      [booking({ intBudget: 10_000 }), booking({ intBudget: 10_000, month: "2026-09" })],
      [august, september],
      [],
      MID_AUGUST,
    );

    expect(scorecard.rows.find((row) => row.month === "2026-08")?.pace).not.toBeNull();
    expect(scorecard.rows.find((row) => row.month === "2026-09")?.pace).toBeNull();
  });

  it("counts bookings without a month as unscheduled", () => {
    const scorecard = buildScorecard(
      [booking({ month: null })],
      TARGETS,
      REVENUE,
      MID_AUGUST,
    );

    expect(scorecard.unscheduledCount).toBe(1);
    expect(scorecard.rows.find((row) => row.cm === "Lucija P")?.bookedAmount).toBe(0);
  });
});

describe("time helpers", () => {
  it("formats the ISO month in UTC", () => {
    expect(isoMonthOf(new Date("2026-08-01T00:30:00Z"))).toBe("2026-08");
  });

  it("computes the elapsed fraction of the month", () => {
    expect(monthElapsedFraction(new Date("2026-08-01T00:00:00Z"))).toBe(0);
    expect(monthElapsedFraction(MID_AUGUST)).toBeCloseTo(0.5, 10);
  });
});

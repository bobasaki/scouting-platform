import { BookingStatus as PrismaBookingStatus } from "@prisma/client";
import type { Booking, BookingStatus } from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";

import type { BookingPlanTarget, MonthlyRevenueTarget } from "./scorecard";

/**
 * Read-only accessors over the imported booking tracker. Phase 1 serves these
 * for the Insights and Scorecard tabs; CRUD lands in Phase 2.
 */

const BOOKING_STATUS_BY_PRISMA = {
  [PrismaBookingStatus.PIPELINE]: "pipeline",
  [PrismaBookingStatus.BOOKED]: "booked",
  [PrismaBookingStatus.PUBLISHED]: "published",
  [PrismaBookingStatus.LONGTERM]: "longterm",
  [PrismaBookingStatus.DROPPED]: "dropped",
} as const satisfies Record<PrismaBookingStatus, BookingStatus>;

type BookingRecord = {
  id: string;
  channelName: string;
  channelKey: string;
  channelUrl: string | null;
  country: string | null;
  cm: string | null;
  platform: string | null;
  vertical: string | null;
  category: string | null;
  status: PrismaBookingStatus;
  activation: string | null;
  numActivations: number | null;
  contractSigned: boolean;
  contractUrl: string | null;
  publishedAt: string | null;
  intBudget: number | null;
  extBudget: number | null;
  currency: string;
  month: string | null;
  note: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toBooking(record: BookingRecord): Booking {
  return {
    id: record.id,
    channelName: record.channelName,
    channelKey: record.channelKey,
    channelUrl: record.channelUrl,
    country: record.country,
    cm: record.cm,
    platform: record.platform,
    vertical: record.vertical,
    category: record.category,
    status: BOOKING_STATUS_BY_PRISMA[record.status],
    activation: record.activation,
    numActivations: record.numActivations,
    contractSigned: record.contractSigned,
    contractUrl: record.contractUrl,
    publishedAt: record.publishedAt,
    intBudget: record.intBudget,
    extBudget: record.extBudget,
    currency: record.currency,
    month: record.month,
    note: record.note,
    videoUrl: record.videoUrl,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Every booking, newest month first — the order the deal join expects. */
export async function listBookings(): Promise<Booking[]> {
  const rows = await prisma.booking.findMany({
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(toBooking);
}

export async function listBookingPlanTargets(): Promise<BookingPlanTarget[]> {
  const rows = await prisma.bookingTarget.findMany({
    orderBy: [{ month: "asc" }, { cm: "asc" }, { market: "asc" }],
  });

  return rows.map((row) => ({
    cm: row.cm,
    market: row.market,
    month: row.month,
    budgetEur: row.budgetEur,
    tierCounts: {
      under10k: row.tierUnder10k,
      from10kTo20k: row.tier10kTo20k,
      from20kTo50k: row.tier20kTo50k,
      over50k: row.tierOver50k,
    },
  }));
}

export async function listMonthlyRevenueTargets(): Promise<MonthlyRevenueTarget[]> {
  const rows = await prisma.revenueTarget.findMany({
    orderBy: { month: "asc" },
  });

  return rows.map((row) => ({ month: row.month, totalEur: row.totalEur }));
}

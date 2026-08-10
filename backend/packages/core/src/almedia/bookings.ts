import { BookingStatus as PrismaBookingStatus } from "@prisma/client";
import type {
  Booking,
  BookingInput,
  BookingStatus,
  BookingUpdateInput,
} from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";

import { recordAuditEvent } from "../audit";
import { ServiceError } from "../errors";
import { requireAlmediaAdminUser } from "./access";
import { normalizeChannelKey } from "./channel-key";
import type { BookingPlanTarget, MonthlyRevenueTarget } from "./scorecard";

/**
 * The booking tracker: read accessors for the Insights and Scorecard tabs, plus
 * the admin-only CRUD the Bookings tab writes through. Bookings are typed by
 * hand — they are the internal half of every deal, and nothing else in the
 * platform produces them.
 */

const BOOKING_STATUS_BY_PRISMA = {
  [PrismaBookingStatus.PIPELINE]: "pipeline",
  [PrismaBookingStatus.BOOKED]: "booked",
  [PrismaBookingStatus.PUBLISHED]: "published",
  [PrismaBookingStatus.LONGTERM]: "longterm",
  [PrismaBookingStatus.DROPPED]: "dropped",
} as const satisfies Record<PrismaBookingStatus, BookingStatus>;

const PRISMA_BOOKING_STATUS = {
  pipeline: PrismaBookingStatus.PIPELINE,
  booked: PrismaBookingStatus.BOOKED,
  published: PrismaBookingStatus.PUBLISHED,
  longterm: PrismaBookingStatus.LONGTERM,
  dropped: PrismaBookingStatus.DROPPED,
} as const satisfies Record<BookingStatus, PrismaBookingStatus>;

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

/**
 * The join key is what matches a booking to its Almedia campaigns, so it is
 * always stored normalized. Callers may pass one explicitly for creators whose
 * campaign name does not normalize to their display name.
 */
function resolveChannelKey(channelName: string, explicitKey: string | null): string {
  const channelKey = normalizeChannelKey(explicitKey ?? channelName);

  if (channelKey.length === 0) {
    throw new ServiceError(
      "ALMEDIA_BOOKING_CHANNEL_KEY_EMPTY",
      422,
      "Channel name must contain at least one letter or digit",
    );
  }

  return channelKey;
}

/**
 * Plain column values rather than Prisma's field-update operations, so the same
 * object is valid for both `create` and `update`.
 */
type BookingWritableFields = Partial<{
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
}>;

/** The supplied subset of writable columns. */
function toWritableFields(input: BookingUpdateInput): BookingWritableFields {
  return {
    ...(input.channelUrl !== undefined ? { channelUrl: input.channelUrl } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.cm !== undefined ? { cm: input.cm } : {}),
    ...(input.platform !== undefined ? { platform: input.platform } : {}),
    ...(input.vertical !== undefined ? { vertical: input.vertical } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.status !== undefined
      ? { status: PRISMA_BOOKING_STATUS[input.status] }
      : {}),
    ...(input.activation !== undefined ? { activation: input.activation } : {}),
    ...(input.numActivations !== undefined
      ? { numActivations: input.numActivations }
      : {}),
    ...(input.contractSigned !== undefined
      ? { contractSigned: input.contractSigned }
      : {}),
    ...(input.contractUrl !== undefined ? { contractUrl: input.contractUrl } : {}),
    ...(input.publishedAt !== undefined ? { publishedAt: input.publishedAt } : {}),
    ...(input.intBudget !== undefined ? { intBudget: input.intBudget } : {}),
    ...(input.extBudget !== undefined ? { extBudget: input.extBudget } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.month !== undefined ? { month: input.month } : {}),
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.videoUrl !== undefined ? { videoUrl: input.videoUrl } : {}),
  };
}

export async function createBooking(input: {
  requestedByUserId: string;
  booking: BookingInput;
}): Promise<Booking> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const created = await prisma.booking.create({
    data: {
      ...toWritableFields(input.booking),
      channelName: input.booking.channelName,
      channelKey: resolveChannelKey(
        input.booking.channelName,
        input.booking.channelKey ?? null,
      ),
    },
  });

  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.booking.created",
    entityType: "booking",
    entityId: created.id,
    metadata: { channelKey: created.channelKey, status: created.status },
  });

  return toBooking(created);
}

export async function updateBooking(input: {
  requestedByUserId: string;
  bookingId: string;
  booking: BookingUpdateInput;
}): Promise<Booking> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, channelName: true },
  });

  if (!existing) {
    throw new ServiceError("ALMEDIA_BOOKING_NOT_FOUND", 404, "Booking not found");
  }

  // An omitted `channelKey` leaves the established join alone; an explicit
  // `null` re-derives it from the (possibly renamed) channel name.
  const channelName = input.booking.channelName ?? existing.channelName;
  const channelKey =
    input.booking.channelKey === undefined
      ? undefined
      : resolveChannelKey(channelName, input.booking.channelKey);

  const updated = await prisma.booking.update({
    where: { id: input.bookingId },
    data: {
      ...toWritableFields(input.booking),
      ...(input.booking.channelName !== undefined ? { channelName } : {}),
      ...(channelKey === undefined ? {} : { channelKey }),
    },
  });

  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.booking.updated",
    entityType: "booking",
    entityId: updated.id,
    metadata: { fields: Object.keys(input.booking).sort() },
  });

  return toBooking(updated);
}

export async function deleteBooking(input: {
  requestedByUserId: string;
  bookingId: string;
}): Promise<void> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const existing = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, channelKey: true },
  });

  if (!existing) {
    throw new ServiceError("ALMEDIA_BOOKING_NOT_FOUND", 404, "Booking not found");
  }

  await prisma.booking.delete({ where: { id: input.bookingId } });

  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.booking.deleted",
    entityType: "booking",
    entityId: existing.id,
    metadata: { channelKey: existing.channelKey },
  });
}

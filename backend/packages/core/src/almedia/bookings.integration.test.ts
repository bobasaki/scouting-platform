import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type BookingsModule = typeof import("./bookings");

integration("almedia booking CRUD", () => {
  let prisma: PrismaClient;
  let adminId: string;
  let memberId: string;

  async function loadBookings(): Promise<BookingsModule> {
    return import("./bookings");
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;

    const db = await import("@scouting-platform/db");
    prisma = db.createPrismaClient({ databaseUrl });

    await prisma.$connect();
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    vi.resetModules();

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE bookings, audit_events, users RESTART IDENTITY CASCADE`,
    );

    const admin = await prisma.user.create({
      data: {
        email: "almedia-admin@example.com",
        passwordHash: "hash",
        role: Role.ADMIN,
      },
      select: { id: true },
    });
    const member = await prisma.user.create({
      data: {
        email: "almedia-member@example.com",
        passwordHash: "hash",
        role: Role.USER,
      },
      select: { id: true },
    });

    adminId = admin.id;
    memberId = member.id;

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
  });

  afterAll(async () => {
    vi.resetModules();

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    await prisma.$disconnect();
  });

  it("creates a booking, deriving the join key from the channel name", async () => {
    const { createBooking } = await loadBookings();

    const created = await createBooking({
      requestedByUserId: adminId,
      booking: { channelName: "ASMR Fixy", cm: "Lucija P", month: "2026-09" },
    });

    expect(created.channelKey).toBe("ASMRFIXY");
    expect(created.status).toBe("pipeline");
    expect(created.currency).toBe("USD");
    expect(created.contractSigned).toBe(false);
    expect(created.month).toBe("2026-09");

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "almedia.booking.created" },
      select: { entityId: true, actorUserId: true },
    });

    expect(audit).toEqual({ entityId: created.id, actorUserId: adminId });
  });

  it("honours an explicit join key over the channel name", async () => {
    const { createBooking } = await loadBookings();

    const created = await createBooking({
      requestedByUserId: adminId,
      booking: { channelName: "Fixy (DE)", channelKey: "asmr fixy" },
    });

    expect(created.channelKey).toBe("ASMRFIXY");
  });

  it("writes only the supplied fields on update and keeps the join key", async () => {
    const { createBooking, updateBooking } = await loadBookings();

    const created = await createBooking({
      requestedByUserId: adminId,
      booking: { channelName: "ASMR Fixy", cm: "Lucija P", intBudget: 12_000 },
    });

    const updated = await updateBooking({
      requestedByUserId: adminId,
      bookingId: created.id,
      booking: { status: "booked", channelName: "ASMR Fixy DE" },
    });

    expect(updated.status).toBe("booked");
    expect(updated.channelName).toBe("ASMR Fixy DE");
    // The rename must not silently break the established campaign join.
    expect(updated.channelKey).toBe("ASMRFIXY");
    expect(updated.cm).toBe("Lucija P");
    expect(updated.intBudget).toBe(12_000);
  });

  it("re-derives the join key when it is explicitly cleared", async () => {
    const { createBooking, updateBooking } = await loadBookings();

    const created = await createBooking({
      requestedByUserId: adminId,
      booking: { channelName: "ASMR Fixy" },
    });

    const updated = await updateBooking({
      requestedByUserId: adminId,
      bookingId: created.id,
      booking: { channelName: "Diabeuu", channelKey: null },
    });

    expect(updated.channelKey).toBe("DIABEUU");
  });

  it("deletes a booking and records the audit event", async () => {
    const { createBooking, deleteBooking, listBookings } = await loadBookings();

    const created = await createBooking({
      requestedByUserId: adminId,
      booking: { channelName: "ASMR Fixy" },
    });

    await deleteBooking({ requestedByUserId: adminId, bookingId: created.id });

    expect(await listBookings()).toEqual([]);
    expect(
      await prisma.auditEvent.count({ where: { action: "almedia.booking.deleted" } }),
    ).toBe(1);
  });

  it("rejects non-admin writes and unknown bookings", async () => {
    const { createBooking, updateBooking, deleteBooking } = await loadBookings();

    await expect(
      createBooking({
        requestedByUserId: memberId,
        booking: { channelName: "ASMR Fixy" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    const missingId = "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b";

    await expect(
      updateBooking({
        requestedByUserId: adminId,
        bookingId: missingId,
        booking: { status: "dropped" },
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      deleteBooking({ requestedByUserId: adminId, bookingId: missingId }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a channel name with no usable join key", async () => {
    const { createBooking } = await loadBookings();

    await expect(
      createBooking({ requestedByUserId: adminId, booking: { channelName: "!!!" } }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

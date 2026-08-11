import {
  AlmediaSyncRunStatus as PrismaAlmediaSyncRunStatus,
  BookingStatus as PrismaBookingStatus,
  PrismaClient,
  Role,
} from "@prisma/client";
import {
  almediaAnalystStatusResponseSchema,
  almediaCampaignsResponseSchema,
  almediaDealsResponseSchema,
  almediaInvoiceResponseSchema,
  almediaInvoicesResponseSchema,
  almediaScorecardResponseSchema,
  almediaSyncResponseSchema,
} from "@scouting-platform/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type SessionUser = { id: string; role: "admin" | "user" } | null;

let currentSessionUser: SessionUser = null;

vi.mock("../../auth", () => ({
  auth: vi.fn(async () => (currentSessionUser ? { user: currentSessionUser } : null)),
}));

// `unstable_cache` would serve one test's response to the next assertion.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

integration("almedia API integration", () => {
  let prisma: PrismaClient;
  let dealsRoute: typeof import("./almedia/deals/route");
  let campaignsRoute: typeof import("./almedia/campaigns/route");
  let scorecardRoute: typeof import("./almedia/scorecard/route");
  let syncRoute: typeof import("./almedia/sync/route");
  let invoicesRoute: typeof import("./almedia/invoices/route");
  let invoiceRoute: typeof import("./almedia/invoices/[invoiceId]/route");
  let analystRoute: typeof import("./almedia/analyst/route");

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "almedia-api-auth-secret";

    const db = await import("@scouting-platform/db");
    prisma = db.createPrismaClient({ databaseUrl });

    await prisma.$connect();

    dealsRoute = await import("./almedia/deals/route");
    campaignsRoute = await import("./almedia/campaigns/route");
    scorecardRoute = await import("./almedia/scorecard/route");
    syncRoute = await import("./almedia/sync/route");
    invoicesRoute = await import("./almedia/invoices/route");
    invoiceRoute = await import("./almedia/invoices/[invoiceId]/route");
    analystRoute = await import("./almedia/analyst/route");
  });

  beforeEach(async () => {
    currentSessionUser = null;

    // The sync route enqueues through the real pg-boss runtime; clear only the
    // jobs this suite creates so other suites' queues are untouched.
    await prisma.$executeRawUnsafe(
      `DELETE FROM pgboss.job WHERE name = 'almedia.campaigns.sync'`,
    );
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        almedia_campaign_snapshots,
        almedia_sync_runs,
        booking_invoices,
        booking_targets,
        revenue_targets,
        bookings,
        audit_events,
        user_provider_credentials,
        sessions,
        accounts,
        verification_tokens,
        users
      RESTART IDENTITY CASCADE
    `);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(email: string, role: Role): Promise<{ id: string }> {
    return prisma.user.create({
      data: {
        email,
        name: role === Role.ADMIN ? "Admin" : "Manager",
        role,
        passwordHash: "hash",
        isActive: true,
      },
      select: { id: true },
    });
  }

  async function seedAlmediaData(): Promise<void> {
    const syncedAt = new Date("2026-08-10T09:00:00.000Z");

    await prisma.almediaSyncRun.create({
      data: {
        status: PrismaAlmediaSyncRunStatus.COMPLETED,
        agency: "ARCH.",
        campaignCount: 1,
        pageCount: 1,
        startedAt: syncedAt,
        completedAt: syncedAt,
      },
    });
    await prisma.almediaCampaignSnapshot.create({
      data: {
        campaignName: "ASMRFIXY_YT_R1",
        campaignSource: "ARCH.",
        platform: "youtube",
        country: "PL",
        publishedAt: new Date("2026-07-13T18:00:20.000Z"),
        cost: 1000,
        expectedCpm: 20,
        viewCount: 40_000,
        returnPct: 90,
        channelName: "ASMR Fixy",
        syncedAt,
      },
    });
    await prisma.booking.create({
      data: {
        legacySourceId: 1,
        channelName: "ASMR Fixy",
        channelKey: "ASMRFIXY",
        country: "PL",
        cm: "Lucija P",
        platform: "youtube",
        vertical: "gaming",
        status: PrismaBookingStatus.PUBLISHED,
        contractSigned: true,
        publishedAt: "2026-07-13",
        intBudget: 12_000,
        extBudget: 15_000,
        month: "2026-07",
      },
    });
    await prisma.bookingTarget.create({
      data: {
        cm: "Lucija P",
        market: "PL",
        month: "2026-07",
        budgetEur: 60_000,
        tier10kTo20k: 2,
        tier20kTo50k: 1,
      },
    });
    await prisma.revenueTarget.create({
      data: { month: "2026-07", totalEur: 500_000 },
    });
  }

  it("gates every Almedia read behind an admin session", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const user = await createUser("manager@example.com", Role.USER);

    const handlers = [
      dealsRoute.GET,
      campaignsRoute.GET,
      scorecardRoute.GET,
      syncRoute.POST,
      invoicesRoute.GET,
      analystRoute.GET,
    ];

    for (const handler of handlers) {
      currentSessionUser = null;
      expect((await handler()).status).toBe(401);

      currentSessionUser = { id: user.id, role: "user" };
      expect((await handler()).status).toBe(403);
    }

    currentSessionUser = { id: admin.id, role: "admin" };
    expect((await dealsRoute.GET()).status).toBe(200);
  });

  it("returns joined, classified deals with filter options and sync freshness", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    await seedAlmediaData();

    currentSessionUser = { id: admin.id, role: "admin" };

    const response = await dealsRoute.GET();

    expect(response.status).toBe(200);

    const payload = almediaDealsResponseSchema.parse(await response.json());

    expect(payload.deals).toHaveLength(1);
    expect(payload.deals[0]).toMatchObject({
      channelKey: "ASMRFIXY",
      cm: "Lucija P",
      vertical: "Gaming",
      returnTier: "rebooking",
      sizeTier: "10-20k",
      hasBooking: true,
      hasCampaign: true,
    });
    expect(payload.options.cm).toEqual(["Lucija P"]);
    expect(payload.sync).toMatchObject({
      status: "completed",
      agency: "ARCH.",
      campaignCount: 1,
    });
  });

  it("returns the stored campaign feed", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    await seedAlmediaData();

    currentSessionUser = { id: admin.id, role: "admin" };

    const payload = almediaCampaignsResponseSchema.parse(
      await (await campaignsRoute.GET()).json(),
    );

    expect(payload.campaigns).toHaveLength(1);
    expect(payload.campaigns[0]?.campaignName).toBe("ASMRFIXY_YT_R1");
  });

  it("returns the booking scorecard", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    await seedAlmediaData();

    currentSessionUser = { id: admin.id, role: "admin" };

    const payload = almediaScorecardResponseSchema.parse(
      await (await scorecardRoute.GET()).json(),
    );

    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0]).toMatchObject({
      cm: "Lucija P",
      market: "PL",
      month: "2026-07",
      targetAmount: 60_000,
      bookedAmount: 12_000,
    });
    expect(payload.months[0]).toMatchObject({
      month: "2026-07",
      targetAmount: 500_000,
    });
  });

  it("reports empty results before the first sync instead of failing", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);

    currentSessionUser = { id: admin.id, role: "admin" };

    const payload = almediaDealsResponseSchema.parse(
      await (await dealsRoute.GET()).json(),
    );

    expect(payload.deals).toEqual([]);
    expect(payload.sync).toMatchObject({ status: null, campaignCount: 0 });
  });

  it("records, replaces, and removes an invoice snapshot", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);

    currentSessionUser = { id: admin.id, role: "admin" };

    const invoice = {
      campaignName: "ASMRFIXY_YT_R1",
      channelName: "ASMR Fixy",
      invoicedAt: "2026-07-31T09:00:00.000Z",
      maturedAtInvoice: false,
      cost: 1000,
      returnPct: 90,
      tier: "c20",
      amount: 1000,
    };

    const created = await invoicesRoute.PUT(
      new Request("http://localhost/api/almedia/invoices", {
        method: "PUT",
        body: JSON.stringify(invoice),
      }),
    );

    expect(created.status).toBe(200);

    const saved = almediaInvoiceResponseSchema.parse(await created.json()).invoice;

    expect(saved).toMatchObject({ campaignName: "ASMRFIXY_YT_R1", tier: "c20" });
    expect(
      await prisma.auditEvent.findFirst({
        where: { action: "almedia.invoice.recorded", entityId: saved.id },
      }),
    ).toMatchObject({ actorUserId: admin.id });

    // Re-invoicing after maturity replaces the snapshot rather than duplicating it.
    const topped = almediaInvoiceResponseSchema.parse(
      await (
        await invoicesRoute.PUT(
          new Request("http://localhost/api/almedia/invoices", {
            method: "PUT",
            body: JSON.stringify({
              ...invoice,
              maturedAtInvoice: true,
              returnPct: 140,
              tier: "c40",
              amount: 1166.67,
            }),
          }),
        )
      ).json(),
    ).invoice;

    expect(topped.id).toBe(saved.id);
    expect(topped).toMatchObject({ tier: "c40", maturedAtInvoice: true });

    const listed = almediaInvoicesResponseSchema.parse(
      await (await invoicesRoute.GET()).json(),
    );

    expect(listed.invoices).toHaveLength(1);

    const deleted = await invoiceRoute.DELETE(
      new Request("http://localhost/api/almedia/invoices/x", { method: "DELETE" }),
      { params: Promise.resolve({ invoiceId: saved.id }) },
    );

    expect(deleted.status).toBe(204);
    expect(await prisma.bookingInvoice.count()).toBe(0);
    expect(
      await prisma.auditEvent.findFirst({
        where: { action: "almedia.invoice.deleted", entityId: saved.id },
      }),
    ).toMatchObject({ actorUserId: admin.id });
  });

  it("rejects an invoice payload with an off-card tier", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);

    currentSessionUser = { id: admin.id, role: "admin" };

    const response = await invoicesRoute.PUT(
      new Request("http://localhost/api/almedia/invoices", {
        method: "PUT",
        body: JSON.stringify({
          campaignName: "ASMRFIXY_YT_R1",
          channelName: "ASMR Fixy",
          invoicedAt: "2026-07-31T09:00:00.000Z",
          maturedAtInvoice: false,
          cost: 1000,
          returnPct: 90,
          tier: "c35",
          amount: 1000,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await prisma.bookingInvoice.count()).toBe(0);
  });

  it("reports analyst status from the server-side key, never the key itself", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const previousKey = process.env.OPENAI_API_KEY;

    currentSessionUser = { id: admin.id, role: "admin" };

    try {
      process.env.OPENAI_API_KEY = "sk-analyst-secret";

      const response = await analystRoute.GET();
      const body = almediaAnalystStatusResponseSchema.parse(await response.json());

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(body.configured).toBe(true);
      expect(JSON.stringify(body)).not.toContain("sk-analyst-secret");

      delete process.env.OPENAI_API_KEY;

      const unconfigured = almediaAnalystStatusResponseSchema.parse(
        await (await analystRoute.GET()).json(),
      );

      expect(unconfigured.configured).toBe(false);
    } finally {
      process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("gates the analyst stream and rejects a malformed conversation", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const user = await createUser("manager@example.com", Role.USER);
    const ask = (body: unknown): Request =>
      new Request("http://localhost/api/almedia/analyst", {
        method: "POST",
        body: JSON.stringify(body),
      });
    const question = {
      messages: [{ role: "user", content: "Where should we shift budget?" }],
      context: '{"totals":{}}',
    };

    currentSessionUser = null;
    expect((await analystRoute.POST(ask(question))).status).toBe(401);

    currentSessionUser = { id: user.id, role: "user" };
    expect((await analystRoute.POST(ask(question))).status).toBe(403);

    currentSessionUser = { id: admin.id, role: "admin" };
    expect((await analystRoute.POST(ask({ messages: [] }))).status).toBe(400);

    // No provider call was reachable, so nothing should have been audited.
    expect(
      await prisma.auditEvent.count({ where: { action: "almedia.analyst.asked" } }),
    ).toBe(0);
  });

  it("answers with 503 rather than an empty stream when no key is configured", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const previousKey = process.env.OPENAI_API_KEY;

    currentSessionUser = { id: admin.id, role: "admin" };

    try {
      delete process.env.OPENAI_API_KEY;

      const response = await analystRoute.POST(
        new Request("http://localhost/api/almedia/analyst", {
          method: "POST",
          body: JSON.stringify({
            messages: [{ role: "user", content: "Where should we shift budget?" }],
          }),
        }),
      );

      expect(response.status).toBe(503);
      expect(response.headers.get("Content-Type")).not.toContain("event-stream");
    } finally {
      process.env.OPENAI_API_KEY = previousKey;
    }
  });

  it("records a durable run and an audit event when an admin requests a sync", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);

    currentSessionUser = { id: admin.id, role: "admin" };

    const response = await syncRoute.POST();

    expect(response.status).toBe(202);

    const { runId } = almediaSyncResponseSchema.parse(await response.json());
    const run = await prisma.almediaSyncRun.findUnique({ where: { id: runId } });

    expect(run).toMatchObject({
      status: PrismaAlmediaSyncRunStatus.QUEUED,
      requestedByUserId: admin.id,
      lastError: null,
    });

    expect(
      await prisma.auditEvent.findFirst({
        where: { action: "almedia.campaigns.sync.requested", entityId: runId },
      }),
    ).toMatchObject({ actorUserId: admin.id });

    const queued = await prisma.$queryRawUnsafe<Array<{ data: unknown }>>(
      `SELECT data FROM pgboss.job WHERE name = 'almedia.campaigns.sync'`,
    );

    expect(queued).toHaveLength(1);
    expect(queued[0]?.data).toMatchObject({ initiatedBy: "admin", syncRunId: runId });
  });
});

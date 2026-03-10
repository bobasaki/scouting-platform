import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type SessionUser = { id: string; role: "admin" | "user" } | null;

let currentSessionUser: SessionUser = null;

vi.mock("../../auth", () => ({
  auth: vi.fn(async () => (currentSessionUser ? { user: currentSessionUser } : null)),
}));

integration("week 5 csv import API integration", () => {
  let prisma: PrismaClient;
  let batchesRoute: typeof import("./admin/csv-import-batches/route");
  let batchDetailRoute: typeof import("./admin/csv-import-batches/[id]/route");
  let core: typeof import("@scouting-platform/core");

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "week5-csv-import-api-auth-secret";

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    await prisma.$connect();
    core = await import("@scouting-platform/core");
    batchesRoute = await import("./admin/csv-import-batches/route");
    batchDetailRoute = await import("./admin/csv-import-batches/[id]/route");
  });

  beforeEach(async () => {
    currentSessionUser = null;

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        csv_import_rows,
        channel_metrics,
        channel_contacts,
        csv_import_batches,
        advanced_report_requests,
        channel_provider_payloads,
        channel_insights,
        channel_enrichments,
        channel_youtube_contexts,
        channel_manual_overrides,
        saved_segments,
        run_results,
        run_requests,
        audit_events,
        user_provider_credentials,
        sessions,
        accounts,
        verification_tokens,
        channels,
        users
      RESTART IDENTITY CASCADE
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM pgboss.job WHERE name = 'imports.csv.process'
    `);
  });

  afterAll(async () => {
    await core.stopCsvImportsQueue();
    await prisma.$disconnect();
  });

  async function createUser(email: string, role: Role = Role.ADMIN): Promise<{ id: string }> {
    return prisma.user.create({
      data: {
        email,
        name: role === Role.ADMIN ? "Admin" : "User",
        role,
        passwordHash: "hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  function makeFormData(csvText: string, name = "contacts.csv"): FormData {
    const formData = new FormData();
    formData.append("file", new File([csvText], name, { type: "text/csv" }));
    return formData;
  }

  it("creates a batch via POST and returns list/detail responses for admins", async () => {
    const admin = await createUser("admin@example.com");
    currentSessionUser = { id: admin.id, role: "admin" };

    const uploadResponse = await batchesRoute.POST(
      new Request("http://localhost/api/admin/csv-import-batches", {
        method: "POST",
        body: makeFormData([
          "youtubeChannelId,channelTitle,contactEmail,subscriberCount,viewCount,videoCount,notes,sourceLabel",
          "UC-CSV-1,Creator One,creator@example.com,1000,20000,50,Top creator,ops",
          "UC-CSV-2,Creator Two,invalid-email,2000,30000,60,,ops",
        ].join("\n")),
      }),
    );

    expect(uploadResponse.status).toBe(202);
    const uploadPayload = await uploadResponse.json();
    expect(uploadPayload.status).toBe("queued");
    expect(uploadPayload.totalRowCount).toBe(2);
    expect(uploadPayload.failedRowCount).toBe(1);

    const listResponse = await batchesRoute.GET();
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.items).toHaveLength(1);
    expect(listPayload.items[0]?.id).toBe(uploadPayload.id);

    const detailResponse = await batchDetailRoute.GET(
      new Request(`http://localhost/api/admin/csv-import-batches/${uploadPayload.id}?page=1&pageSize=1`),
      { params: Promise.resolve({ id: uploadPayload.id }) },
    );
    expect(detailResponse.status).toBe(200);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.rows).toHaveLength(1);
    expect(detailPayload.rows[0]?.rowNumber).toBe(2);
  });

  it("enforces admin-only access on csv import routes", async () => {
    const admin = await createUser("admin@example.com");
    const user = await createUser("user@example.com", Role.USER);

    currentSessionUser = null;
    const unauthenticated = await batchesRoute.GET();
    expect(unauthenticated.status).toBe(401);

    currentSessionUser = { id: user.id, role: "user" };
    const forbidden = await batchesRoute.GET();
    expect(forbidden.status).toBe(403);

    currentSessionUser = { id: admin.id, role: "admin" };
    const allowed = await batchesRoute.GET();
    expect(allowed.status).toBe(200);
  });

  it("returns 400 for missing file or strict-template header mismatch", async () => {
    const admin = await createUser("admin@example.com");
    currentSessionUser = { id: admin.id, role: "admin" };

    const missingFileResponse = await batchesRoute.POST(
      new Request("http://localhost/api/admin/csv-import-batches", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(missingFileResponse.status).toBe(400);

    const invalidHeaderResponse = await batchesRoute.POST(
      new Request("http://localhost/api/admin/csv-import-batches", {
        method: "POST",
        body: makeFormData([
          "youtubeChannelId,channelTitle,contactEmail",
          "UC-CSV-1,Creator One,creator@example.com",
        ].join("\n"), "invalid.csv"),
      }),
    );
    expect(invalidHeaderResponse.status).toBe(400);
  });
});

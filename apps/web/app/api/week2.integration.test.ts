import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type SessionUser = { id: string; role: "admin" | "user" } | null;

let currentSessionUser: SessionUser = null;

vi.mock("../../auth", () => ({
  auth: vi.fn(async () => (currentSessionUser ? { user: currentSessionUser } : null)),
}));

integration("week 2 API integration", () => {
  let prisma: PrismaClient;
  let segmentsRoute: typeof import("./segments/route");
  let segmentDetailRoute: typeof import("./segments/[id]/route");

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "week2-integration-auth-secret";

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    await prisma.$connect();
    segmentsRoute = await import("./segments/route");
    segmentDetailRoute = await import("./segments/[id]/route");
  });

  beforeEach(async () => {
    currentSessionUser = null;
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createUser(email: string): Promise<{ id: string }> {
    return prisma.user.create({
      data: {
        email,
        name: "User",
        role: Role.USER,
        passwordHash: "user-hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  it("returns 401 for unauthenticated segment routes", async () => {
    const listResponse = await segmentsRoute.GET();
    expect(listResponse.status).toBe(401);

    const deleteResponse = await segmentDetailRoute.DELETE(
      new Request("http://localhost/api/segments/any"),
      { params: Promise.resolve({ id: "2b97ca47-a0f0-44a2-bf11-d6f0eb20f998" }) },
    );
    expect(deleteResponse.status).toBe(401);
  });

  it("returns 400 for invalid payload and invalid params", async () => {
    const user = await createUser("user@example.com");
    currentSessionUser = { id: user.id, role: "user" };

    const invalidPayloadResponse = await segmentsRoute.POST(
      new Request("http://localhost/api/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "",
          filters: {
            channelIds: ["abc123"],
          },
        }),
      }),
    );

    expect(invalidPayloadResponse.status).toBe(400);

    const invalidParamResponse = await segmentDetailRoute.PUT(
      new Request("http://localhost/api/segments/not-a-uuid", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Segment",
          filters: {
            locale: "en",
          },
        }),
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(invalidParamResponse.status).toBe(400);
  });

  it("supports segment create/list/update/delete for authenticated user", async () => {
    const user = await createUser("user@example.com");
    currentSessionUser = { id: user.id, role: "user" };

    const createResponse = await segmentsRoute.POST(
      new Request("http://localhost/api/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "English creators",
          filters: {
            locale: "en",
            minSubscribers: 10000,
          },
        }),
      }),
    );

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.name).toBe("English creators");

    const listResponse = await segmentsRoute.GET();
    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload.items).toHaveLength(1);
    expect(listPayload.items[0]?.id).toBe(created.id);

    const updateResponse = await segmentDetailRoute.PUT(
      new Request(`http://localhost/api/segments/${created.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "US creators",
          filters: {
            locale: "en-US",
          },
        }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    expect(updateResponse.status).toBe(200);
    const updated = await updateResponse.json();
    expect(updated.name).toBe("US creators");

    const deleteResponse = await segmentDetailRoute.DELETE(
      new Request(`http://localhost/api/segments/${created.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    expect(deleteResponse.status).toBe(204);

    const listAfterDelete = await segmentsRoute.GET();
    expect(listAfterDelete.status).toBe(200);
    const listAfterDeletePayload = await listAfterDelete.json();
    expect(listAfterDeletePayload.items).toEqual([]);
  });

  it("returns 404 for non-owned segment updates and deletes", async () => {
    const owner = await createUser("owner@example.com");
    const otherUser = await createUser("other@example.com");
    const segment = await prisma.savedSegment.create({
      data: {
        userId: owner.id,
        name: "Owner segment",
        filters: {
          locale: "en",
        },
      },
      select: {
        id: true,
      },
    });

    currentSessionUser = { id: otherUser.id, role: "user" };

    const updateResponse = await segmentDetailRoute.PUT(
      new Request(`http://localhost/api/segments/${segment.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Should not update",
          filters: {
            locale: "fr",
          },
        }),
      }),
      { params: Promise.resolve({ id: segment.id }) },
    );
    expect(updateResponse.status).toBe(404);

    const deleteResponse = await segmentDetailRoute.DELETE(
      new Request(`http://localhost/api/segments/${segment.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: segment.id }) },
    );
    expect(deleteResponse.status).toBe(404);
  });
});

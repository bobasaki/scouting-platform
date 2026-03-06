import { PrismaClient, Role, RunRequestStatus, RunResultSource } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type CoreModule = typeof import("./index");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

integration("week 3 core integration", () => {
  let prisma: PrismaClient;
  let core: CoreModule;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_ENCRYPTION_KEY = "12345678901234567890123456789012";

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    await prisma.$connect();
    core = await import("./index");
  });

  beforeEach(async () => {
    vi.restoreAllMocks();

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        run_results,
        run_requests,
        saved_segments,
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
      DELETE FROM pgboss.job WHERE name = 'runs.discover'
    `);
  });

  afterAll(async () => {
    await core.stopRunsQueue();
    await prisma.$disconnect();
  });

  it("creates queued run request and enqueues runs.discover job when key exists", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    await core.setUserYoutubeApiKey({
      userId: user.id,
      rawKey: "yt-key-1",
      actorUserId: user.id,
    });

    const created = await core.createRunRequest({
      userId: user.id,
      name: "Gaming Run",
      query: "gaming creators",
    });

    expect(created.status).toBe("queued");

    const runRequest = await prisma.runRequest.findUnique({
      where: {
        id: created.runId,
      },
    });
    expect(runRequest?.status).toBe(RunRequestStatus.QUEUED);

    const jobs = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pgboss.job
      WHERE name = 'runs.discover'
    `;
    expect(jobs[0]?.count ?? 0).toBeGreaterThan(0);
  });

  it("fails run creation when user has no assigned youtube key", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    await expect(
      core.createRunRequest({
        userId: user.id,
        name: "Gaming Run",
        query: "gaming creators",
      }),
    ).rejects.toMatchObject({
      code: "YOUTUBE_KEY_REQUIRED",
      status: 400,
    });

    const runRequestsCount = await prisma.runRequest.count();
    expect(runRequestsCount).toBe(0);
  });

  it("executes discovery and writes minimal run results", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    await core.setUserYoutubeApiKey({
      userId: user.id,
      rawKey: "yt-key-1",
      actorUserId: user.id,
    });

    await prisma.channel.createMany({
      data: [
        {
          youtubeChannelId: "UC-CATALOG-1",
          title: "Gaming Channel A",
        },
        {
          youtubeChannelId: "UC-CATALOG-2",
          title: "Gaming Channel B",
        },
        {
          youtubeChannelId: "UC-NON-MATCH",
          title: "Cooking Channel",
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              { id: { channelId: "UC-CATALOG-2" } },
              { id: { channelId: "UC-DISCOVER-1" } },
              { id: { channelId: "UC-DISCOVER-2" } },
            ],
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              {
                id: "UC-CATALOG-2",
                snippet: {
                  title: "Gaming Channel B",
                  description: "Catalog overlap",
                  customUrl: "gaming-b",
                  thumbnails: {
                    default: { url: "https://img.example.com/b.jpg" },
                  },
                },
              },
              {
                id: "UC-DISCOVER-1",
                snippet: {
                  title: "Gaming Discover One",
                  description: "Discovery one",
                  customUrl: "gaming-one",
                  thumbnails: {
                    default: { url: "https://img.example.com/d1.jpg" },
                  },
                },
              },
              {
                id: "UC-DISCOVER-2",
                snippet: {
                  title: "Gaming Discover Two",
                  description: "Discovery two",
                  customUrl: "gaming-two",
                  thumbnails: {
                    default: { url: "https://img.example.com/d2.jpg" },
                  },
                },
              },
            ],
          }),
        ),
    );

    const created = await core.createRunRequest({
      userId: user.id,
      name: "Gaming Run",
      query: "gaming",
    });

    await core.executeRunDiscover({
      runRequestId: created.runId,
      requestedByUserId: user.id,
    });

    const runRequest = await prisma.runRequest.findUniqueOrThrow({
      where: {
        id: created.runId,
      },
    });

    expect(runRequest.status).toBe(RunRequestStatus.COMPLETED);
    expect(runRequest.lastError).toBeNull();

    const results = await prisma.runResult.findMany({
      where: {
        runRequestId: created.runId,
      },
      orderBy: {
        rank: "asc",
      },
    });
    expect(results).toHaveLength(4);
    expect(results[0]?.rank).toBe(1);
    expect(results[0]?.source).toBe(RunResultSource.CATALOG);
    expect(results[1]?.source).toBe(RunResultSource.CATALOG);
    expect(results[2]?.source).toBe(RunResultSource.DISCOVERY);
    expect(results[3]?.source).toBe(RunResultSource.DISCOVERY);

    const catalogOverlapChannel = await prisma.channel.findUniqueOrThrow({
      where: {
        youtubeChannelId: "UC-CATALOG-2",
      },
      select: {
        id: true,
      },
    });
    const dedupedCatalogOverlap = results.filter(
      (result) => result.channelId === catalogOverlapChannel.id,
    );
    expect(dedupedCatalogOverlap).toHaveLength(1);
    expect(dedupedCatalogOverlap[0]?.source).toBe(RunResultSource.CATALOG);

    const discoveredChannels = await prisma.channel.findMany({
      where: {
        youtubeChannelId: {
          in: ["UC-DISCOVER-1", "UC-DISCOVER-2"],
        },
      },
      orderBy: {
        youtubeChannelId: "asc",
      },
    });
    expect(discoveredChannels).toHaveLength(2);
  });

  it("persists failed status and last error when discovery validation fails", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    const runRequest = await prisma.runRequest.create({
      data: {
        requestedByUserId: user.id,
        name: "Gaming Run",
        query: "gaming creators",
      },
    });

    await expect(
      core.executeRunDiscover({
        runRequestId: runRequest.id,
        requestedByUserId: user.id,
      }),
    ).rejects.toMatchObject({
      code: "YOUTUBE_KEY_REQUIRED",
      status: 400,
    });

    const updated = await prisma.runRequest.findUniqueOrThrow({
      where: {
        id: runRequest.id,
      },
    });
    expect(updated.status).toBe(RunRequestStatus.FAILED);
    expect(updated.lastError).toContain("YouTube API key");
  });

  it("persists failed status and last error when youtube quota is exceeded", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    await core.setUserYoutubeApiKey({
      userId: user.id,
      rawKey: "yt-key-1",
      actorUserId: user.id,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              errors: [{ reason: "quotaExceeded" }],
            },
          },
          403,
        ),
      ),
    );

    const runRequest = await prisma.runRequest.create({
      data: {
        requestedByUserId: user.id,
        name: "Gaming Run",
        query: "gaming",
      },
    });

    await expect(
      core.executeRunDiscover({
        runRequestId: runRequest.id,
        requestedByUserId: user.id,
      }),
    ).rejects.toMatchObject({
      code: "YOUTUBE_QUOTA_EXCEEDED",
      status: 429,
    });

    const updated = await prisma.runRequest.findUniqueOrThrow({
      where: {
        id: runRequest.id,
      },
    });
    expect(updated.status).toBe(RunRequestStatus.FAILED);
    expect(updated.lastError).toBe("YouTube API quota exceeded");
  });

  it("is idempotent when duplicate discovery execution happens", async () => {
    const user = await prisma.user.create({
      data: {
        email: "manager@example.com",
        name: "Manager",
        role: Role.USER,
        passwordHash: "hash",
        isActive: true,
      },
    });

    await core.setUserYoutubeApiKey({
      userId: user.id,
      rawKey: "yt-key-1",
      actorUserId: user.id,
    });

    await prisma.channel.create({
      data: {
        youtubeChannelId: "UC-A",
        title: "Gaming Channel A",
      },
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: { channelId: "UC-A" } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "UC-A",
              snippet: {
                title: "Gaming Channel A",
                thumbnails: {},
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const runRequest = await prisma.runRequest.create({
      data: {
        requestedByUserId: user.id,
        name: "Gaming Run",
        query: "gaming",
      },
    });

    await core.executeRunDiscover({
      runRequestId: runRequest.id,
      requestedByUserId: user.id,
    });
    await core.executeRunDiscover({
      runRequestId: runRequest.id,
      requestedByUserId: user.id,
    });

    const resultsCount = await prisma.runResult.count({
      where: {
        runRequestId: runRequest.id,
      },
    });
    expect(resultsCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { AlmediaSyncRunStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  enqueueMock,
  fetchAllCampaignsMock,
  prismaMock,
  prepareYoutubeEnrichmentsMock,
} = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  fetchAllCampaignsMock: vi.fn(),
  prismaMock: {
    almediaSyncRun: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    almediaCampaignSnapshot: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  prepareYoutubeEnrichmentsMock: vi.fn(),
}));

vi.mock("@scouting-platform/db", () => ({
  prisma: prismaMock,
  withDbTransaction: vi.fn(),
}));
vi.mock("@scouting-platform/integrations", () => ({
  fetchAllCampaigns: fetchAllCampaignsMock,
}));
vi.mock("./youtube-enrichment", () => ({
  prepareAlmediaYoutubeEnrichments: prepareYoutubeEnrichmentsMock,
}));
vi.mock("./access", () => ({
  requireAlmediaAdminUser: vi.fn(),
}));
vi.mock("./queue", () => ({
  enqueueAlmediaCampaignsSyncJob: enqueueMock,
}));
vi.mock("../audit", () => ({
  recordAuditEvent: vi.fn(),
}));

import {
  createScheduledAlmediaSyncRun,
  getAlmediaSyncStatus,
  requestAlmediaCampaignsSync,
  syncAlmediaCampaigns,
} from "./campaigns";

const SYNC_RUN_ID = "11111111-1111-4111-8111-111111111111";
const STARTED_AT = new Date("2026-08-11T08:00:00.000Z");

describe("syncAlmediaCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALMEDIA_API_KEY = "alm_test_key";
    prismaMock.almediaSyncRun.findUnique.mockResolvedValue({
      id: SYNC_RUN_ID,
      status: AlmediaSyncRunStatus.QUEUED,
      requestedByUserId: null,
    });
    prismaMock.almediaSyncRun.update.mockResolvedValue({});
    fetchAllCampaignsMock.mockResolvedValue({
      agency: "test-agency",
      campaigns: [],
      pages: 1,
    });
  });

  it("persists a failed run when catalog relinking aborts", async () => {
    prepareYoutubeEnrichmentsMock.mockRejectedValue(
      new Error("catalog relink failed"),
    );

    await expect(
      syncAlmediaCampaigns({ syncRunId: SYNC_RUN_ID, now: STARTED_AT }),
    ).rejects.toThrow("catalog relink failed");

    expect(prismaMock.almediaSyncRun.update).toHaveBeenNthCalledWith(1, {
      where: { id: SYNC_RUN_ID },
      data: {
        status: AlmediaSyncRunStatus.RUNNING,
        startedAt: STARTED_AT,
        lastError: null,
      },
    });
    expect(prismaMock.almediaSyncRun.update).toHaveBeenNthCalledWith(2, {
      where: { id: SYNC_RUN_ID },
      data: {
        status: AlmediaSyncRunStatus.FAILED,
        completedAt: expect.any(Date),
        lastError: "catalog relink failed",
      },
    });
    expect(fetchAllCampaignsMock).toHaveBeenCalledTimes(1);
    expect(prepareYoutubeEnrichmentsMock).toHaveBeenCalledWith({
      preferredRequesterUserId: null,
      campaigns: [],
    });
  });
});

describe("getAlmediaSyncStatus", () => {
  it("does not expose a legacy stack trace through the web read model", async () => {
    prismaMock.almediaSyncRun.findFirst.mockResolvedValue({
      id: SYNC_RUN_ID,
      status: AlmediaSyncRunStatus.FAILED,
      agency: null,
      campaignCount: 0,
      pageCount: 0,
      duplicateCount: 0,
      startedAt: STARTED_AT,
      completedAt: STARTED_AT,
      lastError:
        "AlmediaApiError: Almedia server error (HTTP 502).\n    at performPageRequest (/workspace/backend/packages/integrations/src/almedia/agency-data.ts:295:11)",
    });
    prismaMock.almediaCampaignSnapshot.findFirst.mockResolvedValue(null);
    prismaMock.almediaCampaignSnapshot.count.mockResolvedValue(12);

    await expect(getAlmediaSyncStatus()).resolves.toMatchObject({
      status: "failed",
      campaignCount: 12,
      lastError: "Almedia server error (HTTP 502).",
    });
  });
});

describe("Almedia sync enqueue durability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.almediaSyncRun.create.mockResolvedValue({ id: SYNC_RUN_ID });
    prismaMock.almediaSyncRun.update.mockResolvedValue({});
    enqueueMock.mockRejectedValue(new Error("queue unavailable"));
  });

  it("fails an admin run when enqueueing fails", async () => {
    await expect(
      requestAlmediaCampaignsSync({
        requestedByUserId: "22222222-2222-4222-8222-222222222222",
      }),
    ).rejects.toThrow("queue unavailable");

    expect(prismaMock.almediaSyncRun.update).toHaveBeenCalledWith({
      where: { id: SYNC_RUN_ID },
      data: {
        status: AlmediaSyncRunStatus.FAILED,
        completedAt: expect.any(Date),
        lastError: "queue unavailable",
      },
    });
  });

  it("fails a scheduled run when enqueueing fails", async () => {
    await expect(createScheduledAlmediaSyncRun()).rejects.toThrow(
      "queue unavailable",
    );

    expect(prismaMock.almediaSyncRun.update).toHaveBeenCalledWith({
      where: { id: SYNC_RUN_ID },
      data: {
        status: AlmediaSyncRunStatus.FAILED,
        completedAt: expect.any(Date),
        lastError: "queue unavailable",
      },
    });
  });
});

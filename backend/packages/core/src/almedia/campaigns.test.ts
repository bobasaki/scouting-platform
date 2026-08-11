import { AlmediaSyncRunStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAllCampaignsMock, prismaMock, relinkMock } = vi.hoisted(() => ({
  fetchAllCampaignsMock: vi.fn(),
  prismaMock: {
    almediaSyncRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  relinkMock: vi.fn(),
}));

vi.mock("@scouting-platform/db", () => ({
  prisma: prismaMock,
  withDbTransaction: vi.fn(),
}));
vi.mock("@scouting-platform/integrations", () => ({
  fetchAllCampaigns: fetchAllCampaignsMock,
}));
vi.mock("./enrichments", () => ({
  relinkAlmediaEnrichmentCatalogChannels: relinkMock,
}));

import { syncAlmediaCampaigns } from "./campaigns";

const SYNC_RUN_ID = "11111111-1111-4111-8111-111111111111";
const STARTED_AT = new Date("2026-08-11T08:00:00.000Z");

describe("syncAlmediaCampaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.almediaSyncRun.findUnique.mockResolvedValue({
      id: SYNC_RUN_ID,
      status: AlmediaSyncRunStatus.QUEUED,
    });
    prismaMock.almediaSyncRun.update.mockResolvedValue({});
  });

  it("persists a failed run when catalog relinking aborts", async () => {
    relinkMock.mockRejectedValue(new Error("catalog relink failed"));

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
        lastError: expect.stringContaining("catalog relink failed"),
      },
    });
    expect(fetchAllCampaignsMock).not.toHaveBeenCalled();
  });
});

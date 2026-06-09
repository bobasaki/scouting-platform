import {
  RunChannelAssessmentStatus,
  RunRequestStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const tx = {
    runResult: {
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    runRequest: {
      update: vi.fn(),
    },
  };

  return {
    prismaMock: {
      runRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      __tx: tx,
    },
  };
});

vi.mock("@scouting-platform/db", () => ({
  prisma: prismaMock,
}));

import { finalizeRunAssessmentRankingIfReady } from "./repository";

describe("run repository assessment ranking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes a running run by fit score and trims to the target", async () => {
    prismaMock.runRequest.findUnique.mockResolvedValueOnce({
      id: "run-1",
      status: RunRequestStatus.RUNNING,
      target: 1,
      results: [
        {
          id: "result-1",
          channelId: "channel-1",
          rank: 1,
        },
        {
          id: "result-2",
          channelId: "channel-2",
          rank: 2,
        },
      ],
      channelAssessments: [
        {
          channelId: "channel-1",
          status: RunChannelAssessmentStatus.COMPLETED,
          fitScore: 0.4,
        },
        {
          channelId: "channel-2",
          status: RunChannelAssessmentStatus.COMPLETED,
          fitScore: 0.95,
        },
      ],
    });

    await finalizeRunAssessmentRankingIfReady({
      runRequestId: "run-1",
    });

    expect(prismaMock.__tx.runResult.deleteMany).toHaveBeenCalledWith({
      where: {
        runRequestId: "run-1",
        id: {
          notIn: ["result-2"],
        },
      },
    });
    expect(prismaMock.__tx.runResult.update).toHaveBeenCalledWith({
      where: {
        id: "result-2",
      },
      data: {
        rank: 1,
      },
    });
    expect(prismaMock.__tx.runRequest.update).toHaveBeenCalledWith({
      where: {
        id: "run-1",
      },
      data: expect.objectContaining({
        status: RunRequestStatus.COMPLETED,
        lastError: null,
      }),
    });
  });
});

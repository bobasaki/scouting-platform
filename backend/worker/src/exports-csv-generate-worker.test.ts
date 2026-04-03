import { executeCsvExportBatch } from "@scouting-platform/core";
import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import {
  exportsCsvGenerateWorkerOptions,
  registerExportsCsvGenerateWorker,
} from "./exports-csv-generate-worker";

vi.mock("@scouting-platform/core", () => ({
  executeCsvExportBatch: vi.fn(),
}));

describe("exports.csv.generate worker registration", () => {
  it("registers exports.csv.generate with explicit bounded concurrency options", async () => {
    const work = vi.fn(async () => "exports-csv-generate-worker");

    await registerExportsCsvGenerateWorker({ work } as unknown as Pick<PgBoss, "work">);

    expect(work).toHaveBeenCalledTimes(1);
    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected exports.csv.generate worker to be registered");
    }

    const [name, options] = call as unknown as [
      string,
      typeof exportsCsvGenerateWorkerOptions,
      unknown,
    ];
    expect(name).toBe("exports.csv.generate");
    expect(options).toEqual(exportsCsvGenerateWorkerOptions);
  });

  it("parses and executes each job payload", async () => {
    const work = vi.fn(async () => "exports-csv-generate-worker");

    await registerExportsCsvGenerateWorker({ work } as unknown as Pick<PgBoss, "work">);

    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected exports.csv.generate worker to be registered");
    }

    const [, , handler] = call as unknown as [
      string,
      typeof exportsCsvGenerateWorkerOptions,
      (job: unknown) => Promise<void>,
    ];
    const batchA = {
      exportBatchId: "11111111-1111-4111-8111-111111111111",
      requestedByUserId: "22222222-2222-4222-8222-222222222222",
    };
    const batchB = {
      exportBatchId: "33333333-3333-4333-8333-333333333333",
      requestedByUserId: "44444444-4444-4444-8444-444444444444",
    };

    await handler([
      { data: batchA },
      { data: batchB },
    ]);

    expect(vi.mocked(executeCsvExportBatch)).toHaveBeenNthCalledWith(1, batchA);
    expect(vi.mocked(executeCsvExportBatch)).toHaveBeenNthCalledWith(2, batchB);
  });
});

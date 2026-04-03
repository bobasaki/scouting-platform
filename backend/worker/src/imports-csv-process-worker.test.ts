import { executeCsvImportBatch } from "@scouting-platform/core";
import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import {
  importsCsvProcessWorkerOptions,
  registerImportsCsvProcessWorker,
} from "./imports-csv-process-worker";

vi.mock("@scouting-platform/core", () => ({
  executeCsvImportBatch: vi.fn(),
}));

describe("imports.csv.process worker registration", () => {
  it("registers imports.csv.process with explicit bounded concurrency options", async () => {
    const work = vi.fn(async () => "imports-csv-process-worker");

    await registerImportsCsvProcessWorker({ work } as unknown as Pick<PgBoss, "work">);

    expect(work).toHaveBeenCalledTimes(1);
    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected imports.csv.process worker to be registered");
    }

    const [name, options] = call as unknown as [
      string,
      typeof importsCsvProcessWorkerOptions,
      unknown,
    ];
    expect(name).toBe("imports.csv.process");
    expect(options).toEqual(importsCsvProcessWorkerOptions);
  });

  it("parses and executes each job payload", async () => {
    const work = vi.fn(async () => "imports-csv-process-worker");

    await registerImportsCsvProcessWorker({ work } as unknown as Pick<PgBoss, "work">);

    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected imports.csv.process worker to be registered");
    }

    const [, , handler] = call as unknown as [
      string,
      typeof importsCsvProcessWorkerOptions,
      (job: unknown) => Promise<void>,
    ];
    const batchA = {
      importBatchId: "11111111-1111-4111-8111-111111111111",
      requestedByUserId: "22222222-2222-4222-8222-222222222222",
    };
    const batchB = {
      importBatchId: "33333333-3333-4333-8333-333333333333",
      requestedByUserId: "44444444-4444-4444-8444-444444444444",
    };

    await handler([
      { data: batchA },
      { data: batchB },
    ]);

    expect(vi.mocked(executeCsvImportBatch)).toHaveBeenNthCalledWith(1, batchA);
    expect(vi.mocked(executeCsvImportBatch)).toHaveBeenNthCalledWith(2, batchB);
  });
});

import { executeHubspotObjectSyncRun } from "@scouting-platform/core";
import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import {
  hubspotObjectSyncWorkerOptions,
  registerHubspotObjectSyncWorker,
} from "./hubspot-object-sync-worker";

vi.mock("@scouting-platform/core", () => ({
  executeHubspotObjectSyncRun: vi.fn(),
}));

describe("hubspot.object-sync worker registration", () => {
  it("registers hubspot.object-sync with explicit bounded concurrency options", async () => {
    const work = vi.fn(async () => "hubspot-object-sync-worker");

    await registerHubspotObjectSyncWorker({ work } as unknown as Pick<PgBoss, "work">);

    expect(work).toHaveBeenCalledTimes(1);
    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected hubspot.object-sync worker to be registered");
    }

    const [name, options] = call as unknown as [
      string,
      typeof hubspotObjectSyncWorkerOptions,
      unknown,
    ];
    expect(name).toBe("hubspot.object-sync");
    expect(options).toEqual(hubspotObjectSyncWorkerOptions);
  });

  it("parses and executes each job payload", async () => {
    const work = vi.fn(async () => "hubspot-object-sync-worker");

    await registerHubspotObjectSyncWorker({ work } as unknown as Pick<PgBoss, "work">);

    const call = work.mock.calls[0];

    if (!call) {
      throw new Error("Expected hubspot.object-sync worker to be registered");
    }

    const [, , handler] = call as unknown as [
      string,
      typeof hubspotObjectSyncWorkerOptions,
      (job: unknown) => Promise<void>,
    ];
    const requestA = {
      syncRunId: "11111111-1111-4111-8111-111111111111",
      requestedByUserId: "22222222-2222-4222-8222-222222222222",
    };
    const requestB = {
      syncRunId: "33333333-3333-4333-8333-333333333333",
      requestedByUserId: "44444444-4444-4444-8444-444444444444",
    };

    await handler([{ data: requestA }, { data: requestB }]);

    expect(vi.mocked(executeHubspotObjectSyncRun)).toHaveBeenNthCalledWith(1, requestA);
    expect(vi.mocked(executeHubspotObjectSyncRun)).toHaveBeenNthCalledWith(2, requestB);
  });
});

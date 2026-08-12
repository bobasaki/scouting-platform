import {
  createScheduledAlmediaSyncRun,
  syncAlmediaCampaigns,
} from "@scouting-platform/core";
import type { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";

import {
  ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE,
  almediaCampaignsSyncWorkerOptions,
  ensureAlmediaCampaignsSyncSchedule,
  registerAlmediaCampaignsSyncScheduleWorker,
  registerAlmediaCampaignsSyncWorker,
} from "./almedia-campaigns-sync-worker";

const SYNC_RUN_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@scouting-platform/core", () => ({
  createScheduledAlmediaSyncRun: vi.fn(async () => ({ runId: SYNC_RUN_ID })),
  syncAlmediaCampaigns: vi.fn(async () => ({
    runId: SYNC_RUN_ID,
    agency: "ARCH.",
    campaignCount: 3,
    pageCount: 1,
    duplicateCount: 0,
    linkedEnrichmentCount: 0,
    ingestedChannelCount: 0,
    discoveredChannelCount: 0,
    queuedEnrichmentCount: 0,
    pendingEnrichmentCount: 0,
    enrichmentRequesterMissing: false,
  })),
}));

function takeWorkRegistration(
  work: ReturnType<typeof vi.fn>,
): [string, unknown, (job: unknown) => Promise<void>] {
  const call = work.mock.calls[0];

  if (!call) {
    throw new Error("Expected a worker to be registered");
  }

  return call as unknown as [string, unknown, (job: unknown) => Promise<void>];
}

describe("almedia.campaigns.sync.schedule worker", () => {
  it("registers the hourly GMT+2 schedule", async () => {
    const schedule = vi.fn(async () => undefined);

    await ensureAlmediaCampaignsSyncSchedule({
      schedule,
    } as unknown as Pick<PgBoss, "schedule">);

    expect(schedule).toHaveBeenCalledWith(
      ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.name,
      "0 * * * *",
      { initiatedBy: "system" },
      expect.objectContaining({
        key: "hourly-gmt-plus-2",
        tz: "Etc/GMT-2",
      }),
    );
  });

  it("queues a durable sync run when the schedule fires", async () => {
    vi.mocked(createScheduledAlmediaSyncRun).mockClear();

    const work = vi.fn(async () => "almedia-campaigns-sync-schedule-worker");

    await registerAlmediaCampaignsSyncScheduleWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [name, options, handler] = takeWorkRegistration(work);

    expect(name).toBe(ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.name);
    expect(options).toEqual(almediaCampaignsSyncWorkerOptions);

    await handler({ data: { initiatedBy: "system" } });

    expect(vi.mocked(createScheduledAlmediaSyncRun)).toHaveBeenCalledTimes(1);
  });

  it("rejects a schedule payload that is not system-initiated", async () => {
    const work = vi.fn(async () => "almedia-campaigns-sync-schedule-worker");

    await registerAlmediaCampaignsSyncScheduleWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [, , handler] = takeWorkRegistration(work);

    await expect(handler({ data: { initiatedBy: "admin" } })).rejects.toThrow();
  });
});

describe("almedia.campaigns.sync worker", () => {
  it("runs the sync for the payload's run id", async () => {
    vi.mocked(syncAlmediaCampaigns).mockClear();

    const work = vi.fn(async () => "almedia-campaigns-sync-worker");

    await registerAlmediaCampaignsSyncWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [name, options, handler] = takeWorkRegistration(work);

    expect(name).toBe("almedia.campaigns.sync");
    expect(options).toEqual(almediaCampaignsSyncWorkerOptions);

    await handler({ data: { initiatedBy: "system", syncRunId: SYNC_RUN_ID } });

    expect(vi.mocked(syncAlmediaCampaigns)).toHaveBeenCalledWith({
      syncRunId: SYNC_RUN_ID,
    });
  });

  it("logs only a non-zero catalog re-link count", async () => {
    vi.mocked(syncAlmediaCampaigns).mockResolvedValueOnce({
      runId: SYNC_RUN_ID,
      agency: "ARCH.",
      campaignCount: 3,
      pageCount: 1,
      duplicateCount: 0,
      linkedEnrichmentCount: 2,
      ingestedChannelCount: 0,
      discoveredChannelCount: 0,
      queuedEnrichmentCount: 0,
      pendingEnrichmentCount: 0,
      enrichmentRequesterMissing: false,
    });
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const work = vi.fn(async () => "almedia-campaigns-sync-worker");

    await registerAlmediaCampaignsSyncWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [, , handler] = takeWorkRegistration(work);

    await handler({ data: { initiatedBy: "system", syncRunId: SYNC_RUN_ID } });

    expect(stdout).toHaveBeenCalledWith(
      "[worker] linked 2 Almedia enrichment(s) to catalog channels\n",
    );
    stdout.mockRestore();
  });

  it("rethrows so pg-boss retries when the sync fails", async () => {
    vi.mocked(syncAlmediaCampaigns).mockRejectedValueOnce(new Error("feed down"));

    const work = vi.fn(async () => "almedia-campaigns-sync-worker");

    await registerAlmediaCampaignsSyncWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [, , handler] = takeWorkRegistration(work);

    await expect(
      handler({ data: { initiatedBy: "system", syncRunId: SYNC_RUN_ID } }),
    ).rejects.toThrow("feed down");
  });

  it("rejects a payload without a sync run id", async () => {
    const work = vi.fn(async () => "almedia-campaigns-sync-worker");

    await registerAlmediaCampaignsSyncWorker({
      work,
    } as unknown as Pick<PgBoss, "work">);

    const [, , handler] = takeWorkRegistration(work);

    await expect(handler({ data: { initiatedBy: "system" } })).rejects.toThrow();
  });
});

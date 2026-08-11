import process from "node:process";

import { parseJobPayload } from "@scouting-platform/contracts";
import {
  createScheduledAlmediaSyncRun,
  syncAlmediaCampaigns,
} from "@scouting-platform/core";
import type { PgBoss } from "pg-boss";

import type { WorkerJobOptions } from "./runtime-config";

/**
 * Hourly refresh of the Almedia campaign feed into `almedia_campaign_snapshots`.
 *
 * The feed is paged with backoff, so it is far too slow for a request handler,
 * and the web tier may run several instances — one durable snapshot in Postgres
 * gives every instance the same consistent dataset.
 */

type AlmediaCampaignsSyncJob = {
  data: unknown;
};

export const ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE = {
  name: "almedia.campaigns.sync.schedule",
  cron: "0 * * * *",
  timezone: "Etc/GMT-2",
  key: "hourly-gmt-plus-2",
} as const;

export const almediaCampaignsSyncWorkerOptions: WorkerJobOptions = {
  localConcurrency: 1,
  batchSize: 1,
};

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

/**
 * The cron fires a schedule job rather than the sync job itself, so the sync
 * run row exists (and is visible in the UI) before any provider call is made.
 */
export async function ensureAlmediaCampaignsSyncSchedule(
  boss: Pick<PgBoss, "schedule">,
): Promise<void> {
  await boss.schedule(
    ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.name,
    ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.cron,
    { initiatedBy: "system" },
    {
      key: ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.key,
      tz: ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.timezone,
      retryLimit: 2,
      retryDelay: 300,
      retryBackoff: true,
      singletonKey: ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.key,
      singletonSeconds: 60 * 30,
    },
  );
}

export async function registerAlmediaCampaignsSyncScheduleWorker(
  boss: Pick<PgBoss, "work">,
  options: WorkerJobOptions = almediaCampaignsSyncWorkerOptions,
): Promise<void> {
  await boss.work(
    ALMEDIA_CAMPAIGNS_SYNC_SCHEDULE.name,
    options,
    async (job: AlmediaCampaignsSyncJob | AlmediaCampaignsSyncJob[]) => {
      const jobs = Array.isArray(job) ? job : [job];

      for (const current of jobs) {
        parseJobPayload("almedia.campaigns.sync.schedule", current.data);

        try {
          const run = await createScheduledAlmediaSyncRun();
          process.stdout.write(
            `[worker] scheduled Almedia campaigns sync queued as ${run.runId}\n`,
          );
        } catch (error) {
          process.stderr.write(
            `[worker] almedia.campaigns.sync.schedule failed: ${formatErrorMessage(error)}\n`,
          );
          throw error;
        }
      }
    },
  );
}

export async function registerAlmediaCampaignsSyncWorker(
  boss: Pick<PgBoss, "work">,
  options: WorkerJobOptions = almediaCampaignsSyncWorkerOptions,
): Promise<void> {
  await boss.work(
    "almedia.campaigns.sync",
    options,
    async (job: AlmediaCampaignsSyncJob | AlmediaCampaignsSyncJob[]) => {
      const jobs = Array.isArray(job) ? job : [job];

      for (const current of jobs) {
        const payload = parseJobPayload("almedia.campaigns.sync", current.data);

        try {
          const result = await syncAlmediaCampaigns({ syncRunId: payload.syncRunId });

          if (result.linkedEnrichmentCount > 0) {
            process.stdout.write(
              `[worker] linked ${result.linkedEnrichmentCount} Almedia enrichment(s) to catalog channels\n`,
            );
          }

          process.stdout.write(
            `[worker] almedia.campaigns.sync ${payload.syncRunId} stored ${result.campaignCount} campaign(s) across ${result.pageCount} page(s)\n`,
          );
        } catch (error) {
          process.stderr.write(
            `[worker] almedia.campaigns.sync failed for ${payload.syncRunId}: ${formatErrorMessage(error)}\n`,
          );
          throw error;
        }
      }
    },
  );
}

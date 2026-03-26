import process from "node:process";

import type { PgBoss } from "pg-boss";

import { parseJobPayload } from "@scouting-platform/contracts";
import { executeCsvImportBatch } from "@scouting-platform/core";

type ImportsCsvProcessJob = {
  data: unknown;
};

export const importsCsvProcessWorkerOptions = {
  teamSize: 1,
  teamConcurrency: 1,
  batchSize: 1,
} as const;

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}

export async function registerImportsCsvProcessWorker(
  boss: Pick<PgBoss, "work">,
): Promise<void> {
  await boss.work(
    "imports.csv.process",
    importsCsvProcessWorkerOptions,
    async (job: ImportsCsvProcessJob | ImportsCsvProcessJob[]) => {
      const jobs = Array.isArray(job) ? job : [job];

      for (const current of jobs) {
        const payload = parseJobPayload("imports.csv.process", current.data);

        try {
          await executeCsvImportBatch(payload);
        } catch (error) {
          process.stderr.write(
            `[worker] imports.csv.process failed for ${payload.importBatchId}: ${formatErrorMessage(error)}\n`,
          );
          throw error;
        }
      }
    },
  );
}

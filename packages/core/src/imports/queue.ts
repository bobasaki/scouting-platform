import { enqueueJob, stopQueueRuntime } from "../queue";

export async function enqueueCsvImportJob(payload: {
  importBatchId: string;
  requestedByUserId: string;
}): Promise<void> {
  await enqueueJob("imports.csv.process", payload);
}

export async function stopCsvImportsQueue(): Promise<void> {
  await stopQueueRuntime();
}

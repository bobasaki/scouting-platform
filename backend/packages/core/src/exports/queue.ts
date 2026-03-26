import { enqueueJob, stopQueueRuntime } from "../queue";

export async function enqueueCsvExportJob(payload: {
  exportBatchId: string;
  requestedByUserId: string;
}): Promise<void> {
  await enqueueJob("exports.csv.generate", payload);
}

export async function stopCsvExportsQueue(): Promise<void> {
  await stopQueueRuntime();
}

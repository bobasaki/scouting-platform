import { z } from "zod";

const isoDatetimeSchema = z.string().datetime();

export const csvImportBatchStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const csvImportRowStatusSchema = z.enum(["processed", "failed"]);

export const csvImportRowSchema = z.object({
  id: z.uuid(),
  rowNumber: z.number().int().min(2),
  status: csvImportRowStatusSchema,
  youtubeChannelId: z.string().nullable(),
  channelId: z.uuid().nullable(),
  errorMessage: z.string().nullable(),
  rawData: z.record(z.string(), z.string()),
});

export const csvImportBatchSummarySchema = z.object({
  id: z.uuid(),
  filename: z.string().min(1),
  status: csvImportBatchStatusSchema,
  totalRows: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
});

export const csvImportBatchDetailSchema = csvImportBatchSummarySchema.extend({
  rows: z.array(csvImportRowSchema),
});

export type CsvImportBatchStatus = z.infer<typeof csvImportBatchStatusSchema>;
export type CsvImportRowStatus = z.infer<typeof csvImportRowStatusSchema>;
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;
export type CsvImportBatchSummary = z.infer<typeof csvImportBatchSummarySchema>;
export type CsvImportBatchDetail = z.infer<typeof csvImportBatchDetailSchema>;

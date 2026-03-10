import { z } from "zod";

const isoDatetimeSchema = z.string().datetime();

export const csvImportBatchStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const csvImportRowStatusSchema = z.enum([
  "pending",
  "imported",
  "failed",
]);

export const csvImportBatchActorSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
});

export const csvImportBatchSummarySchema = z.object({
  id: z.uuid(),
  fileName: z.string().trim().min(1),
  templateVersion: z.string().trim().min(1),
  status: csvImportBatchStatusSchema,
  totalRowCount: z.number().int().nonnegative(),
  importedRowCount: z.number().int().nonnegative(),
  failedRowCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  requestedBy: csvImportBatchActorSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
});

export const listCsvImportBatchesResponseSchema = z.object({
  items: z.array(csvImportBatchSummarySchema),
});

export const csvImportRowSchema = z.object({
  id: z.uuid(),
  rowNumber: z.number().int().positive(),
  status: csvImportRowStatusSchema,
  youtubeChannelId: z.string().trim().min(1),
  channelTitle: z.string().trim().min(1),
  contactEmail: z.string().email().nullable(),
  subscriberCount: z.string().regex(/^\d+$/).nullable(),
  viewCount: z.string().regex(/^\d+$/).nullable(),
  videoCount: z.string().regex(/^\d+$/).nullable(),
  notes: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  channelId: z.uuid().nullable(),
  errorMessage: z.string().nullable(),
});

export const getCsvImportBatchDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

export const csvImportBatchDetailSchema = csvImportBatchSummarySchema.extend({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  rows: z.array(csvImportRowSchema),
});

export type CsvImportBatchStatus = z.infer<typeof csvImportBatchStatusSchema>;
export type CsvImportRowStatus = z.infer<typeof csvImportRowStatusSchema>;
export type CsvImportBatchActor = z.infer<typeof csvImportBatchActorSchema>;
export type CsvImportBatchSummary = z.infer<typeof csvImportBatchSummarySchema>;
export type ListCsvImportBatchesResponse = z.infer<typeof listCsvImportBatchesResponseSchema>;
export type CsvImportRow = z.infer<typeof csvImportRowSchema>;
export type GetCsvImportBatchDetailQuery = z.infer<typeof getCsvImportBatchDetailQuerySchema>;
export type CsvImportBatchDetail = z.infer<typeof csvImportBatchDetailSchema>;

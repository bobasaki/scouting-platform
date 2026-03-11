import { z } from "zod";

import { catalogChannelFiltersSchema } from "./channels";

const isoDatetimeSchema = z.string().datetime();

export const csvExportBatchStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const csvExportScopeTypeSchema = z.enum([
  "selected",
  "filtered",
]);

export const csvExportBatchActorSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
});

export const csvExportSelectedScopeSchema = z.object({
  type: z.literal("selected"),
  channelIds: z.array(z.uuid()).min(1),
});

export const csvExportFilteredScopeSchema = z.object({
  type: z.literal("filtered"),
  filters: catalogChannelFiltersSchema,
});

export const csvExportBatchScopeSchema = z.discriminatedUnion("type", [
  csvExportSelectedScopeSchema,
  csvExportFilteredScopeSchema,
]);

export const createCsvExportBatchRequestSchema = csvExportBatchScopeSchema;

export const csvExportBatchSummarySchema = z.object({
  id: z.uuid(),
  scopeType: csvExportScopeTypeSchema,
  fileName: z.string().trim().min(1),
  schemaVersion: z.string().trim().min(1),
  status: csvExportBatchStatusSchema,
  rowCount: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  requestedBy: csvExportBatchActorSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
});

export const csvExportBatchDetailSchema = csvExportBatchSummarySchema.extend({
  scope: csvExportBatchScopeSchema,
});

export const listCsvExportBatchesResponseSchema = z.object({
  items: z.array(csvExportBatchSummarySchema),
});

export type CsvExportBatchStatus = z.infer<typeof csvExportBatchStatusSchema>;
export type CsvExportScopeType = z.infer<typeof csvExportScopeTypeSchema>;
export type CsvExportBatchActor = z.infer<typeof csvExportBatchActorSchema>;
export type CsvExportSelectedScope = z.infer<typeof csvExportSelectedScopeSchema>;
export type CsvExportFilteredScope = z.infer<typeof csvExportFilteredScopeSchema>;
export type CsvExportBatchScope = z.infer<typeof csvExportBatchScopeSchema>;
export type CreateCsvExportBatchRequest = z.infer<typeof createCsvExportBatchRequestSchema>;
export type CsvExportBatchSummary = z.infer<typeof csvExportBatchSummarySchema>;
export type CsvExportBatchDetail = z.infer<typeof csvExportBatchDetailSchema>;
export type ListCsvExportBatchesResponse = z.infer<typeof listCsvExportBatchesResponseSchema>;

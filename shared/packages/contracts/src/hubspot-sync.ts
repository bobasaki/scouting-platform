import { z } from "zod";

const isoDatetimeSchema = z.string().datetime();

export const hubspotObjectSyncObjectTypeSchema = z.enum(["clients", "campaigns"]);

export const hubspotObjectSyncRunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const hubspotObjectSyncRunSchema = z.object({
  id: z.uuid(),
  status: hubspotObjectSyncRunStatusSchema,
  objectTypes: z.array(hubspotObjectSyncObjectTypeSchema).min(1),
  clientUpsertCount: z.number().int().nonnegative(),
  campaignUpsertCount: z.number().int().nonnegative(),
  deactivatedCount: z.number().int().nonnegative(),
  startedAt: isoDatetimeSchema.nullable(),
  completedAt: isoDatetimeSchema.nullable(),
  lastError: z.string().nullable(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export const listHubspotObjectSyncRunsResponseSchema = z.object({
  items: z.array(hubspotObjectSyncRunSchema),
  latest: hubspotObjectSyncRunSchema.nullable(),
});

export const createHubspotObjectSyncRunResponseSchema = z.object({
  run: hubspotObjectSyncRunSchema,
});

export type HubspotObjectSyncObjectType = z.infer<typeof hubspotObjectSyncObjectTypeSchema>;
export type HubspotObjectSyncRunStatus = z.infer<typeof hubspotObjectSyncRunStatusSchema>;
export type HubspotObjectSyncRun = z.infer<typeof hubspotObjectSyncRunSchema>;
export type ListHubspotObjectSyncRunsResponse = z.infer<
  typeof listHubspotObjectSyncRunsResponseSchema
>;
export type CreateHubspotObjectSyncRunResponse = z.infer<
  typeof createHubspotObjectSyncRunResponseSchema
>;

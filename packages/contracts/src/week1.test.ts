import { describe, expect, it } from "vitest";

import {
  createRunRequestSchema,
  createAdminUserRequestSchema,
  listChannelsQuerySchema,
  runStatusResponseSchema,
  segmentFiltersSchema,
} from "./index";

describe("week 1 and week 2 contracts", () => {
  it("parses valid admin user payload", () => {
    const payload = createAdminUserRequestSchema.parse({
      email: "user@example.com",
      role: "user",
      password: "StrongPassword123",
    });

    expect(payload.email).toBe("user@example.com");
  });

  it("normalizes channel query defaults", () => {
    const payload = listChannelsQuerySchema.parse({});

    expect(payload.page).toBe(1);
    expect(payload.pageSize).toBe(20);
  });

  it("accepts channel filters with repeated status arrays", () => {
    const payload = listChannelsQuerySchema.parse({
      query: "space",
      enrichmentStatus: ["completed", "failed"],
      advancedReportStatus: ["pending_approval", "stale"],
    });

    expect(payload.query).toBe("space");
    expect(payload.enrichmentStatus).toEqual(["completed", "failed"]);
    expect(payload.advancedReportStatus).toEqual(["pending_approval", "stale"]);
  });

  it("rejects invalid channel filter statuses", () => {
    const parsed = listChannelsQuerySchema.safeParse({
      enrichmentStatus: ["not-a-status"],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts object-based segment filters", () => {
    const payload = segmentFiltersSchema.parse({
      minSubscribers: 10000,
      locale: "en",
    });

    expect(payload.minSubscribers).toBe(10000);
  });

  it("rejects segment channel id membership lists in this phase", () => {
    const parsed = segmentFiltersSchema.safeParse({
      channelIds: ["abc123"],
    });

    expect(parsed.success).toBe(false);
  });
  it("parses valid run creation payload", () => {
    const payload = createRunRequestSchema.parse({
      name: "Campaign run",
      query: "gaming creators",
    });

    expect(payload.name).toBe("Campaign run");
  });

  it("parses run status response shape", () => {
    const payload = runStatusResponseSchema.parse({
      id: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
      requestedByUserId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
      name: "Campaign run",
      query: "gaming creators",
      status: "queued",
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      results: [],
    });

    expect(payload.status).toBe("queued");
  });
});

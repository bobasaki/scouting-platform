import { describe, expect, it } from "vitest";

import {
  createAdminUserRequestSchema,
  listChannelsQuerySchema,
  patchChannelManualOverridesRequestSchema,
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

  it("parses manual override patch operations", () => {
    const payload = patchChannelManualOverridesRequestSchema.parse({
      operations: [
        {
          field: "title",
          op: "set",
          value: "Updated Title",
        },
        {
          field: "description",
          op: "clear",
        },
      ],
    });

    expect(payload.operations).toHaveLength(2);
  });

  it("rejects duplicate manual override fields in one request", () => {
    const parsed = patchChannelManualOverridesRequestSchema.safeParse({
      operations: [
        {
          field: "title",
          op: "set",
          value: "First",
        },
        {
          field: "title",
          op: "set",
          value: "Second",
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

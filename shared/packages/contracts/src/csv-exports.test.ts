import { describe, expect, it } from "vitest";

import {
  createCsvExportBatchRequestSchema,
  csvExportBatchDetailSchema,
  csvExportBatchSummarySchema,
} from "./csv-exports";

describe("csv export contracts", () => {
  it("parses selected export requests and batch summaries", () => {
    const request = createCsvExportBatchRequestSchema.parse({
      type: "selected",
      channelIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });

    expect(request.type).toBe("selected");

    const summary = csvExportBatchSummarySchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      scopeType: "selected",
      fileName: "creators-selected.csv",
      schemaVersion: "v1",
      status: "queued",
      rowCount: 0,
      lastError: null,
      requestedBy: {
        id: "44444444-4444-4444-8444-444444444444",
        email: "manager@example.com",
        name: "Manager",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    });

    expect(summary.scopeType).toBe("selected");
  });

  it("parses filtered export details", () => {
    const detail = csvExportBatchDetailSchema.parse({
      id: "55555555-5555-4555-8555-555555555555",
      scopeType: "filtered",
      fileName: "creators-filtered.csv",
      schemaVersion: "v1",
      status: "completed",
      rowCount: 3,
      lastError: null,
      requestedBy: {
        id: "66666666-6666-4666-8666-666666666666",
        email: "manager@example.com",
        name: "Manager",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      scope: {
        type: "filtered",
        filters: {
          query: "gaming",
          enrichmentStatus: ["completed"],
          advancedReportStatus: ["pending_approval", "completed"],
        },
      },
    });

    expect(detail.scope.type).toBe("filtered");

    if (detail.scope.type !== "filtered") {
      throw new Error("Expected filtered scope");
    }

    expect(detail.scope.filters.enrichmentStatus).toEqual(["completed"]);
  });
});

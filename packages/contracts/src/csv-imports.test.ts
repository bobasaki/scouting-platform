import { describe, expect, it } from "vitest";

import {
  csvImportBatchDetailSchema,
  csvImportBatchSummarySchema,
  getCsvImportBatchDetailQuerySchema,
} from "./index";

const TEST_UUID = "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b";

describe("csv import contracts", () => {
  it("parses a batch summary payload", () => {
    const payload = csvImportBatchSummarySchema.parse({
      id: TEST_UUID,
      fileName: "contacts.csv",
      templateVersion: "v1",
      status: "queued",
      totalRowCount: 2,
      importedRowCount: 0,
      failedRowCount: 1,
      lastError: null,
      requestedBy: {
        id: TEST_UUID,
        email: "admin@example.com",
        name: "Admin",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    });

    expect(payload.status).toBe("queued");
    expect(payload.requestedBy.email).toBe("admin@example.com");
  });

  it("parses detail query defaults", () => {
    const payload = getCsvImportBatchDetailQuerySchema.parse({});

    expect(payload).toEqual({
      page: 1,
      pageSize: 100,
    });
  });

  it("parses a batch detail payload with rows", () => {
    const payload = csvImportBatchDetailSchema.parse({
      id: TEST_UUID,
      fileName: "contacts.csv",
      templateVersion: "v1",
      status: "completed",
      totalRowCount: 2,
      importedRowCount: 1,
      failedRowCount: 1,
      lastError: null,
      requestedBy: {
        id: TEST_UUID,
        email: "admin@example.com",
        name: "Admin",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      page: 1,
      pageSize: 100,
      rows: [
        {
          id: TEST_UUID,
          rowNumber: 1,
          status: "imported",
          youtubeChannelId: "UC-CSV-1",
          channelTitle: "Imported Channel",
          contactEmail: "creator@example.com",
          subscriberCount: "1000",
          viewCount: "20000",
          videoCount: "50",
          notes: "Imported from ops sheet",
          sourceLabel: "ops-list",
          channelId: TEST_UUID,
          errorMessage: null,
        },
      ],
    });

    expect(payload.rows[0]?.status).toBe("imported");
    expect(payload.rows[0]?.subscriberCount).toBe("1000");
  });
});

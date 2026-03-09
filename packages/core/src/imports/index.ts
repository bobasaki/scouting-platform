import {
  ChannelContactSource,
  ChannelMetricSource,
  CsvImportBatchStatus as PrismaCsvImportBatchStatus,
  CsvImportRowStatus as PrismaCsvImportRowStatus,
  Prisma,
} from "@prisma/client";
import type { CsvImportBatchDetail, CsvImportBatchSummary, CsvImportRow } from "@scouting-platform/contracts";
import { prisma, withDbTransaction } from "@scouting-platform/db";

import { ServiceError } from "../errors";
import { enqueueCsvImportJob } from "./queue";

const REQUIRED_HEADER_PREFIX = [
  "youtubeChannelId",
  "title",
  "handle",
  "contactEmail",
  "subscriberCount",
  "averageViews",
  "averageLikes",
  "notes",
  "sourceLabel",
] as const;

const csvImportRowSelect = {
  id: true,
  rowNumber: true,
  status: true,
  youtubeChannelId: true,
  channelId: true,
  errorMessage: true,
  rawData: true,
} as const;

const csvImportBatchSummarySelect = {
  id: true,
  filename: true,
  status: true,
  totalRows: true,
  processedRows: true,
  failedRows: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
} as const;

const csvImportBatchDetailSelect = {
  ...csvImportBatchSummarySelect,
  rows: {
    orderBy: {
      rowNumber: "asc",
    },
    select: csvImportRowSelect,
  },
} as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ParsedCsvRow = {
  rowNumber: number;
  rawData: Record<string, string>;
};

class CsvImportFatalError extends Error {}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toJsonValue(value: Record<string, string>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeOptionalCell(value: string | undefined): string | null {
  const normalized = normalizeCell(value);
  return normalized ? normalized : null;
}

function normalizeEmail(value: string | undefined): { value: string | null; error: string | null } {
  const normalized = normalizeOptionalCell(value)?.toLowerCase() ?? null;

  if (!normalized) {
    return { value: null, error: null };
  }

  if (!emailPattern.test(normalized)) {
    return { value: null, error: "Invalid contactEmail" };
  }

  return { value: normalized, error: null };
}

function normalizeBigInt(value: string | undefined, fieldName: string): {
  value: bigint | null;
  error: string | null;
} {
  const normalized = normalizeOptionalCell(value);

  if (!normalized) {
    return { value: null, error: null };
  }

  const digits = normalized.replaceAll(",", "");

  if (!/^\d+$/.test(digits)) {
    return {
      value: null,
      error: `Invalid ${fieldName}`,
    };
  }

  return {
    value: BigInt(digits),
    error: null,
  };
}

function toBatchStatus(
  status: PrismaCsvImportBatchStatus,
): CsvImportBatchSummary["status"] {
  if (status === PrismaCsvImportBatchStatus.RUNNING) {
    return "running";
  }

  if (status === PrismaCsvImportBatchStatus.COMPLETED) {
    return "completed";
  }

  if (status === PrismaCsvImportBatchStatus.FAILED) {
    return "failed";
  }

  return "queued";
}

function toRowStatus(status: PrismaCsvImportRowStatus): CsvImportRow["status"] {
  if (status === PrismaCsvImportRowStatus.PROCESSED) {
    return "processed";
  }

  return "failed";
}

function toCsvImportBatchSummary(
  batch: Prisma.CsvImportBatchGetPayload<{
    select: typeof csvImportBatchSummarySelect;
  }>,
): CsvImportBatchSummary {
  return {
    id: batch.id,
    filename: batch.filename,
    status: toBatchStatus(batch.status),
    totalRows: batch.totalRows,
    processedRows: batch.processedRows,
    failedRows: batch.failedRows,
    lastError: batch.lastError,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    startedAt: batch.startedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
  };
}

function toCsvImportRow(
  row: Prisma.CsvImportRowGetPayload<{
    select: typeof csvImportRowSelect;
  }>,
): CsvImportRow {
  const rawData =
    row.rawData && typeof row.rawData === "object" && !Array.isArray(row.rawData)
      ? Object.fromEntries(
          Object.entries(row.rawData as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === "string" ? value : String(value ?? ""),
          ]),
        )
      : {};

  return {
    id: row.id,
    rowNumber: row.rowNumber,
    status: toRowStatus(row.status),
    youtubeChannelId: row.youtubeChannelId,
    channelId: row.channelId,
    errorMessage: row.errorMessage,
    rawData,
  };
}

function toCsvImportBatchDetail(
  batch: Prisma.CsvImportBatchGetPayload<{
    select: typeof csvImportBatchDetailSelect;
  }>,
): CsvImportBatchDetail {
  return {
    ...toCsvImportBatchSummary(batch),
    rows: batch.rows.map(toCsvImportRow),
  };
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (inQuotes) {
      if (character === '"') {
        if (csvText[index + 1] === '"') {
          currentField += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (character === "\r") {
      if (csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += character;
  }

  if (inQuotes) {
    throw new CsvImportFatalError("Malformed CSV: unterminated quoted field");
  }

  currentRow.push(currentField);
  rows.push(currentRow);

  if (rows.length > 0) {
    const trailingRow = rows.at(-1);

    if (trailingRow && trailingRow.length === 1 && trailingRow[0] === "") {
      rows.pop();
    }
  }

  return rows;
}

function parseCsvText(csvText: string): {
  header: string[];
  rows: ParsedCsvRow[];
} {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    throw new CsvImportFatalError("CSV file is empty");
  }

  const rawHeader = rows[0] ?? [];
  const header = rawHeader.map((value, index) => {
    const normalized = normalizeCell(value);
    return index === 0 ? normalized.replace(/^\uFEFF/, "") : normalized;
  });

  if (header.length < REQUIRED_HEADER_PREFIX.length) {
    throw new CsvImportFatalError("Invalid CSV header");
  }

  REQUIRED_HEADER_PREFIX.forEach((expectedHeader, index) => {
    if (header[index] !== expectedHeader) {
      throw new CsvImportFatalError("Invalid CSV header");
    }
  });

  const seenHeaderNames = new Set<string>();

  for (const headerName of header) {
    if (!headerName) {
      throw new CsvImportFatalError("Invalid CSV header");
    }

    if (seenHeaderNames.has(headerName)) {
      throw new CsvImportFatalError("Invalid CSV header");
    }

    seenHeaderNames.add(headerName);
  }

  const parsedRows: ParsedCsvRow[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;

    if (row.length > header.length) {
      throw new CsvImportFatalError(`Malformed CSV row ${rowNumber}: too many columns`);
    }

    const rawData = Object.fromEntries(
      header.map((headerName, headerIndex) => [headerName, normalizeCell(row[headerIndex])]),
    );

    const isBlankRow = Object.values(rawData).every((value) => value === "");

    if (isBlankRow) {
      return;
    }

    parsedRows.push({
      rowNumber,
      rawData,
    });
  });

  return {
    header,
    rows: parsedRows,
  };
}

async function createFailedCsvImportRow(input: {
  importBatchId: string;
  rowNumber: number;
  youtubeChannelId: string | null;
  errorMessage: string;
  rawData: Record<string, string>;
}): Promise<void> {
  await prisma.csvImportRow.create({
    data: {
      importBatchId: input.importBatchId,
      rowNumber: input.rowNumber,
      status: PrismaCsvImportRowStatus.FAILED,
      youtubeChannelId: input.youtubeChannelId,
      errorMessage: input.errorMessage,
      rawData: toJsonValue(input.rawData),
    },
  });
}

async function processCsvImportRow(input: {
  importBatchId: string;
  rowNumber: number;
  rawData: Record<string, string>;
}): Promise<"processed" | "failed"> {
  const youtubeChannelId = normalizeOptionalCell(input.rawData.youtubeChannelId);

  if (!youtubeChannelId) {
    await createFailedCsvImportRow({
      importBatchId: input.importBatchId,
      rowNumber: input.rowNumber,
      youtubeChannelId: null,
      errorMessage: "youtubeChannelId is required",
      rawData: input.rawData,
    });
    return "failed";
  }

  const title = normalizeOptionalCell(input.rawData.title);
  const handle = normalizeOptionalCell(input.rawData.handle);
  const contactEmail = normalizeEmail(input.rawData.contactEmail);
  const subscriberCount = normalizeBigInt(input.rawData.subscriberCount, "subscriberCount");
  const averageViews = normalizeBigInt(input.rawData.averageViews, "averageViews");
  const averageLikes = normalizeBigInt(input.rawData.averageLikes, "averageLikes");
  const notes = normalizeOptionalCell(input.rawData.notes);
  const sourceLabel = normalizeOptionalCell(input.rawData.sourceLabel);

  const rowValidationError =
    contactEmail.error ??
    subscriberCount.error ??
    averageViews.error ??
    averageLikes.error;

  if (rowValidationError) {
    await createFailedCsvImportRow({
      importBatchId: input.importBatchId,
      rowNumber: input.rowNumber,
      youtubeChannelId,
      errorMessage: rowValidationError,
      rawData: input.rawData,
    });
    return "failed";
  }

  const hasMetrics =
    subscriberCount.value !== null ||
    averageViews.value !== null ||
    averageLikes.value !== null;

  const hasContact = contactEmail.value !== null;

  await withDbTransaction(async (tx) => {
    const existingChannel = await tx.channel.findUnique({
      where: {
        youtubeChannelId,
      },
      select: {
        id: true,
      },
    });

    let channelId = existingChannel?.id ?? null;

    if (!channelId) {
      if (!title) {
        throw new ServiceError(
          "CSV_IMPORT_TITLE_REQUIRED",
          400,
          "title is required when creating a new channel",
        );
      }

      const createdChannel = await tx.channel.create({
        data: {
          youtubeChannelId,
          title,
          ...(handle ? { handle } : {}),
        },
        select: {
          id: true,
        },
      });

      channelId = createdChannel.id;
    } else if (!hasContact && !hasMetrics) {
      throw new ServiceError(
        "CSV_IMPORT_NO_CANONICAL_DATA",
        400,
        "Row has no importable canonical data",
      );
    }

    if (!channelId) {
      throw new ServiceError("CSV_IMPORT_CHANNEL_MISSING", 500, "Channel import failed");
    }

    if (contactEmail.value) {
      await tx.channelContact.upsert({
        where: {
          channelId_email: {
            channelId,
            email: contactEmail.value,
          },
        },
        create: {
          channelId,
          email: contactEmail.value,
          notes,
          sourceLabel,
          source: ChannelContactSource.CSV_IMPORT,
        },
        update: {
          notes,
          sourceLabel,
          source: ChannelContactSource.CSV_IMPORT,
        },
      });
    }

    if (hasMetrics) {
      const metricSourceUpdatedAt = new Date();
      const metricCreate: Prisma.ChannelMetricCreateInput = {
        channel: {
          connect: {
            id: channelId,
          },
        },
        ...(subscriberCount.value !== null
          ? {
              subscriberCount: subscriberCount.value,
              subscriberCountSource: ChannelMetricSource.CSV_IMPORT,
              subscriberCountSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
        ...(averageViews.value !== null
          ? {
              averageViews: averageViews.value,
              averageViewsSource: ChannelMetricSource.CSV_IMPORT,
              averageViewsSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
        ...(averageLikes.value !== null
          ? {
              averageLikes: averageLikes.value,
              averageLikesSource: ChannelMetricSource.CSV_IMPORT,
              averageLikesSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
      };

      const metricUpdate: Prisma.ChannelMetricUpdateInput = {
        ...(subscriberCount.value !== null
          ? {
              subscriberCount: subscriberCount.value,
              subscriberCountSource: ChannelMetricSource.CSV_IMPORT,
              subscriberCountSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
        ...(averageViews.value !== null
          ? {
              averageViews: averageViews.value,
              averageViewsSource: ChannelMetricSource.CSV_IMPORT,
              averageViewsSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
        ...(averageLikes.value !== null
          ? {
              averageLikes: averageLikes.value,
              averageLikesSource: ChannelMetricSource.CSV_IMPORT,
              averageLikesSourceUpdatedAt: metricSourceUpdatedAt,
            }
          : {}),
      };

      await tx.channelMetric.upsert({
        where: {
          channelId,
        },
        create: metricCreate,
        update: metricUpdate,
      });
    }

    await tx.csvImportRow.create({
      data: {
        importBatchId: input.importBatchId,
        rowNumber: input.rowNumber,
        status: PrismaCsvImportRowStatus.PROCESSED,
        youtubeChannelId,
        channelId,
        rawData: toJsonValue(input.rawData),
      },
    });
  }).catch(async (error) => {
    if (error instanceof ServiceError && error.status < 500) {
      await createFailedCsvImportRow({
        importBatchId: input.importBatchId,
        rowNumber: input.rowNumber,
        youtubeChannelId,
        errorMessage: error.message,
        rawData: input.rawData,
      });
      return;
    }

    throw error;
  });

  const createdRow = await prisma.csvImportRow.findUnique({
    where: {
      importBatchId_rowNumber: {
        importBatchId: input.importBatchId,
        rowNumber: input.rowNumber,
      },
    },
    select: {
      status: true,
    },
  });

  return createdRow?.status === PrismaCsvImportRowStatus.PROCESSED ? "processed" : "failed";
}

async function markCsvImportBatchFailed(input: {
  importBatchId: string;
  requestedByUserId: string;
  lastError: string;
}): Promise<void> {
  await prisma.csvImportBatch.update({
    where: {
      id: input.importBatchId,
    },
    data: {
      status: PrismaCsvImportBatchStatus.FAILED,
      lastError: input.lastError,
      completedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: input.requestedByUserId,
      action: "csv_import.failed",
      entityType: "csv_import_batch",
      entityId: input.importBatchId,
      metadata: {
        lastError: input.lastError,
      },
    },
  });
}

export async function createCsvImportBatch(input: {
  requestedByUserId: string;
  filename: string;
  csvText: string;
}): Promise<CsvImportBatchSummary> {
  const batch = await withDbTransaction(async (tx) => {
    const createdBatch = await tx.csvImportBatch.create({
      data: {
        requestedByUserId: input.requestedByUserId,
        filename: input.filename,
        csvText: input.csvText,
        status: PrismaCsvImportBatchStatus.QUEUED,
      },
      select: csvImportBatchSummarySelect,
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.requestedByUserId,
        action: "csv_import.requested",
        entityType: "csv_import_batch",
        entityId: createdBatch.id,
        metadata: {
          filename: input.filename,
          byteSize: Buffer.byteLength(input.csvText, "utf8"),
        },
      },
    });

    return createdBatch;
  });

  try {
    await enqueueCsvImportJob({
      importBatchId: batch.id,
      requestedByUserId: input.requestedByUserId,
    });
  } catch (error) {
    const lastError = formatErrorMessage(error);

    await markCsvImportBatchFailed({
      importBatchId: batch.id,
      requestedByUserId: input.requestedByUserId,
      lastError,
    });

    throw new ServiceError(
      "CSV_IMPORT_ENQUEUE_FAILED",
      500,
      "Failed to enqueue CSV import job",
    );
  }

  return toCsvImportBatchSummary(batch);
}

export async function getCsvImportBatchById(
  importBatchId: string,
): Promise<CsvImportBatchDetail | null> {
  const batch = await prisma.csvImportBatch.findUnique({
    where: {
      id: importBatchId,
    },
    select: csvImportBatchDetailSelect,
  });

  return batch ? toCsvImportBatchDetail(batch) : null;
}

export async function executeCsvImportBatch(input: {
  importBatchId: string;
  requestedByUserId: string;
}): Promise<void> {
  const batch = await prisma.csvImportBatch.findUnique({
    where: {
      id: input.importBatchId,
    },
    select: {
      id: true,
      requestedByUserId: true,
      status: true,
      csvText: true,
    },
  });

  if (!batch) {
    return;
  }

  if (batch.requestedByUserId !== input.requestedByUserId) {
    await markCsvImportBatchFailed({
      importBatchId: input.importBatchId,
      requestedByUserId: input.requestedByUserId,
      lastError: "CSV import payload user mismatch",
    });
    return;
  }

  if (batch.status === PrismaCsvImportBatchStatus.COMPLETED) {
    return;
  }

  await withDbTransaction(async (tx) => {
    await tx.csvImportRow.deleteMany({
      where: {
        importBatchId: input.importBatchId,
      },
    });

    await tx.csvImportBatch.update({
      where: {
        id: input.importBatchId,
      },
      data: {
        status: PrismaCsvImportBatchStatus.RUNNING,
        startedAt: new Date(),
        completedAt: null,
        lastError: null,
        totalRows: 0,
        processedRows: 0,
        failedRows: 0,
      },
    });
  });

  try {
    const parsedCsv = parseCsvText(batch.csvText);
    let processedRows = 0;
    let failedRows = 0;

    for (const row of parsedCsv.rows) {
      const status = await processCsvImportRow({
        importBatchId: input.importBatchId,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
      });

      if (status === "processed") {
        processedRows += 1;
      } else {
        failedRows += 1;
      }
    }

    await prisma.csvImportBatch.update({
      where: {
        id: input.importBatchId,
      },
      data: {
        status: PrismaCsvImportBatchStatus.COMPLETED,
        totalRows: processedRows + failedRows,
        processedRows,
        failedRows,
        completedAt: new Date(),
        lastError: null,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actorUserId: input.requestedByUserId,
        action: "csv_import.completed",
        entityType: "csv_import_batch",
        entityId: input.importBatchId,
        metadata: {
          totalRows: processedRows + failedRows,
          processedRows,
          failedRows,
        },
      },
    });
  } catch (error) {
    const lastError = formatErrorMessage(error);

    await markCsvImportBatchFailed({
      importBatchId: input.importBatchId,
      requestedByUserId: input.requestedByUserId,
      lastError,
    });

    if (error instanceof CsvImportFatalError) {
      return;
    }

    throw error;
  }
}

export * from "./queue";

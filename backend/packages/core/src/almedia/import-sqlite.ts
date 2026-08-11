import { DatabaseSync } from "node:sqlite";

import type { Prisma } from "@prisma/client";
import { BookingStatus as PrismaBookingStatus } from "@prisma/client";
import type { BookingStatus } from "@scouting-platform/contracts";
import { withDbTransaction, type DbTransactionClient } from "@scouting-platform/db";

import { normalizeChannelKey } from "./channel-key";

/**
 * One-time (re-runnable) import of the standalone Almedia tracker's SQLite
 * store into Postgres.
 *
 * The source is read read-only. SQLite read-only connections still read the
 * write-ahead log, so the `-wal` sidecar must accompany the `.db` file —
 * without it, recent edits are missing (and with a copied `.db` alone SQLite
 * simply reads the older checkpointed state).
 *
 * Every write is an upsert on a stable natural key, so the import is
 * idempotent and safe to re-run after the source picks up more edits.
 */

/** Minimal read surface of `node:sqlite`, so tests can pass an in-memory db. */
export type SqliteReader = Pick<DatabaseSync, "prepare" | "close">;

type SqliteRow = Record<string, string | number | bigint | null | undefined>;

export interface AlmediaImportCounts {
  bookings: number;
  targets: number;
  revenueTargets: number;
  invoices: number;
  enrichments: number;
  enrichmentLinks: number;
}

const BOOKING_STATUS_BY_VALUE = {
  pipeline: PrismaBookingStatus.PIPELINE,
  booked: PrismaBookingStatus.BOOKED,
  published: PrismaBookingStatus.PUBLISHED,
  longterm: PrismaBookingStatus.LONGTERM,
  dropped: PrismaBookingStatus.DROPPED,
} as const satisfies Record<BookingStatus, PrismaBookingStatus>;

function text(row: SqliteRow, key: string): string | null {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  const asString = String(value);

  return asString === "" ? null : asString;
}

function requiredText(row: SqliteRow, key: string): string {
  const value = text(row, key);

  if (value === null) {
    throw new Error(`SQLite row is missing required column "${key}"`);
  }

  return value;
}

function num(row: SqliteRow, key: string): number | null {
  const value = row[key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNum(row: SqliteRow, key: string): number {
  const value = num(row, key);

  if (value === null) {
    throw new Error(`SQLite row is missing required numeric column "${key}"`);
  }

  return value;
}

function integer(row: SqliteRow, key: string): number | null {
  const value = num(row, key);

  return value === null ? null : Math.trunc(value);
}

function bool(row: SqliteRow, key: string): boolean {
  return num(row, key) === 1;
}

function timestamp(row: SqliteRow, key: string): Date | undefined {
  const value = text(row, key);

  if (value === null) {
    return undefined;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function bookingStatus(row: SqliteRow): PrismaBookingStatus {
  const raw = text(row, "status");

  if (raw !== null && raw in BOOKING_STATUS_BY_VALUE) {
    return BOOKING_STATUS_BY_VALUE[raw as BookingStatus];
  }

  return PrismaBookingStatus.PIPELINE;
}

function selectAll(db: SqliteReader, table: string): SqliteRow[] {
  return db.prepare(`SELECT * FROM ${table}`).all() as SqliteRow[];
}

/** Tables the source may not have, depending on how old the tracker copy is. */
function selectAllIfPresent(db: SqliteReader, table: string): SqliteRow[] {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);

  return exists ? selectAll(db, table) : [];
}

async function importBookings(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  for (const row of rows) {
    const channelName = requiredText(row, "channel_name");
    const data = {
      channelName,
      // Recompute rather than trusting the stored key: the join depends on it.
      channelKey: normalizeChannelKey(channelName),
      channelUrl: text(row, "channel_url"),
      country: text(row, "country"),
      cm: text(row, "cm"),
      platform: text(row, "platform"),
      vertical: text(row, "vertical"),
      category: text(row, "category"),
      status: bookingStatus(row),
      activation: text(row, "activation"),
      numActivations: integer(row, "num_activations"),
      contractSigned: bool(row, "contract_signed"),
      contractUrl: text(row, "contract_url"),
      publishedAt: text(row, "published_at"),
      intBudget: num(row, "int_budget"),
      extBudget: num(row, "ext_budget"),
      currency: text(row, "currency") ?? "EUR",
      month: text(row, "month"),
      note: text(row, "note"),
      videoUrl: text(row, "video_url"),
    };
    const createdAt = timestamp(row, "created_at");
    const legacySourceId = integer(row, "id");

    await tx.booking.upsert({
      where: { legacySourceId: legacySourceId ?? -1 },
      create: {
        ...data,
        legacySourceId,
        ...(createdAt === undefined ? {} : { createdAt }),
      },
      update: data,
    });
  }

  return rows.length;
}

async function importTargets(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  for (const row of rows) {
    const cm = requiredText(row, "cm");
    const market = requiredText(row, "market");
    const month = requiredText(row, "month");
    const data = {
      budgetEur: requiredNum(row, "budget_eur"),
      tierUnder10k: integer(row, "tier_under_10k") ?? 0,
      tier10kTo20k: integer(row, "tier_10k_20k") ?? 0,
      tier20kTo50k: integer(row, "tier_20k_50k") ?? 0,
      tierOver50k: integer(row, "tier_over_50k") ?? 0,
    };

    await tx.bookingTarget.upsert({
      where: { cm_market_month: { cm, market, month } },
      create: { cm, market, month, ...data },
      update: data,
    });
  }

  return rows.length;
}

async function importRevenueTargets(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  for (const row of rows) {
    const month = requiredText(row, "month");
    const totalEur = requiredNum(row, "total_eur");

    await tx.revenueTarget.upsert({
      where: { month },
      create: { month, totalEur },
      update: { totalEur },
    });
  }

  return rows.length;
}

async function importInvoices(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  for (const row of rows) {
    const campaignName = requiredText(row, "campaign_name");
    const data = {
      channelName: requiredText(row, "channel_name"),
      invoicedAt: requiredText(row, "invoiced_at"),
      maturedAtInvoice: bool(row, "matured_at_invoice"),
      cost: requiredNum(row, "cost"),
      returnPct: num(row, "return_pct"),
      tier: requiredText(row, "tier"),
      amount: requiredNum(row, "amount"),
    };

    await tx.bookingInvoice.upsert({
      where: { campaignName },
      create: { campaignName, ...data },
      update: data,
    });
  }

  return rows.length;
}

/**
 * Channel enrichments arrive as a JSON blob per creator. It is stored as read,
 * not reshaped: the platform parses a projection of it on the way out, so an
 * import that pruned the document would throw away context the producer may
 * add fields to later. A blob that is not a JSON object is skipped, since there
 * is nothing meaningful to store for it.
 */
function parseEnrichmentDocument(raw: string): Prisma.InputJsonValue | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as Prisma.InputJsonValue;
}

async function importChannelEnrichments(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  let imported = 0;

  for (const row of rows) {
    const channelId = requiredText(row, "channel_id");
    const result = parseEnrichmentDocument(requiredText(row, "result_json"));

    if (result === null) {
      continue;
    }

    const generatedAt = timestamp(row, "updated_at") ?? new Date();

    await tx.almediaChannelEnrichment.upsert({
      where: { channelId },
      create: { channelId, result, generatedAt },
      update: { result, generatedAt },
    });
    imported += 1;
  }

  return imported;
}

/**
 * Links resolve a campaign or creator key to an enrichment. A link whose
 * enrichment did not import is dropped rather than failing the run — the link
 * would point at nothing.
 */
async function importChannelEnrichmentLinks(
  tx: DbTransactionClient,
  rows: readonly SqliteRow[],
): Promise<number> {
  const known = new Set(
    (
      await tx.almediaChannelEnrichment.findMany({ select: { channelId: true } })
    ).map((row) => row.channelId),
  );
  let imported = 0;

  for (const row of rows) {
    const sourceType = requiredText(row, "source_type");
    const sourceKey = requiredText(row, "source_key");
    const channelId = requiredText(row, "channel_id");

    if (!known.has(channelId)) {
      continue;
    }

    await tx.almediaChannelEnrichmentLink.upsert({
      where: { sourceType_sourceKey: { sourceType, sourceKey } },
      create: { sourceType, sourceKey, channelId },
      update: { channelId },
    });
    imported += 1;
  }

  return imported;
}

/** Import from an already-open SQLite reader (used directly by tests). */
export async function importAlmediaBookingsFromReader(
  db: SqliteReader,
): Promise<AlmediaImportCounts> {
  const bookings = selectAllIfPresent(db, "bookings");
  const targets = selectAllIfPresent(db, "targets");
  const revenueTargets = selectAllIfPresent(db, "revenue_targets");
  const invoices = selectAllIfPresent(db, "invoices");
  const enrichments = selectAllIfPresent(db, "channel_enrichments");
  const enrichmentLinks = selectAllIfPresent(db, "channel_enrichment_links");

  return withDbTransaction(
    async (tx) => ({
      bookings: await importBookings(tx, bookings),
      targets: await importTargets(tx, targets),
      revenueTargets: await importRevenueTargets(tx, revenueTargets),
      invoices: await importInvoices(tx, invoices),
      // Links reference enrichments, so they follow them.
      enrichments: await importChannelEnrichments(tx, enrichments),
      enrichmentLinks: await importChannelEnrichmentLinks(tx, enrichmentLinks),
    }),
    { timeout: 120_000 },
  );
}

export async function importAlmediaBookingsFromSqlite(input: {
  sqlitePath: string;
}): Promise<AlmediaImportCounts> {
  const db = new DatabaseSync(input.sqlitePath, { readOnly: true });

  try {
    return await importAlmediaBookingsFromReader(db);
  } finally {
    db.close();
  }
}

import { DatabaseSync } from "node:sqlite";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type ImportModule = typeof import("./import-sqlite");

/** The subset of the tracker schema the importer reads. */
const SOURCE_SCHEMA = `
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_name TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  channel_url TEXT,
  country TEXT,
  cm TEXT,
  platform TEXT,
  vertical TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pipeline',
  activation TEXT,
  num_activations INTEGER,
  contract_signed INTEGER NOT NULL DEFAULT 0,
  contract_url TEXT,
  published_at TEXT,
  int_budget REAL,
  ext_budget REAL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  month TEXT,
  note TEXT,
  video_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cm TEXT NOT NULL,
  market TEXT NOT NULL,
  month TEXT NOT NULL,
  budget_eur REAL NOT NULL,
  tier_under_10k INTEGER NOT NULL DEFAULT 0,
  tier_10k_20k INTEGER NOT NULL DEFAULT 0,
  tier_20k_50k INTEGER NOT NULL DEFAULT 0,
  tier_over_50k INTEGER NOT NULL DEFAULT 0,
  UNIQUE (cm, market, month)
);

CREATE TABLE revenue_targets (
  month TEXT PRIMARY KEY,
  total_eur REAL NOT NULL
);

CREATE TABLE invoices (
  campaign_name TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL,
  invoiced_at TEXT NOT NULL,
  matured_at_invoice INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL,
  return_pct REAL,
  tier TEXT NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE channel_enrichments (
  channel_id TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE channel_enrichment_links (
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  PRIMARY KEY (source_type, source_key)
);
`;

const ENRICHMENT_JSON = JSON.stringify({
  schemaVersion: "1.0",
  channel: { id: "UCasmrfixy", title: "ASMR Fixy", topics: ["Entertainment"] },
  classification: { niche: "asmr" },
});

function createSourceDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(SOURCE_SCHEMA);
  db.prepare(
    `INSERT INTO bookings
       (channel_name, channel_key, country, cm, platform, vertical, category,
        status, contract_signed, published_at, int_budget, ext_budget, currency,
        month, video_url, created_at, updated_at)
     VALUES
       ('ASMR Fixy', 'STALE_KEY', 'PL', 'Lucija P', 'youtube', 'gaming', 'integration',
        'published', 1, '2026-07-13', 12000, 15000, 'EUR',
        '2026-07', NULL, '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO bookings
       (channel_name, channel_key, cm, status, contract_signed, currency, created_at, updated_at)
     VALUES
       ('Diabeuu', 'DIABEUU', 'Miro', 'not-a-status', 0, 'EUR',
        '2026-07-01T00:00:00.000Z', '2026-07-02T00:00:00.000Z')`,
  ).run();
  db.prepare(
    `INSERT INTO targets (cm, market, month, budget_eur, tier_10k_20k, tier_20k_50k)
     VALUES ('Lucija P', 'PL', '2026-07', 60000, 2, 1)`,
  ).run();
  db.prepare(
    `INSERT INTO revenue_targets (month, total_eur) VALUES ('2026-07', 500000)`,
  ).run();
  db.prepare(
    `INSERT INTO invoices
       (campaign_name, channel_name, invoiced_at, matured_at_invoice, cost, return_pct, tier, amount)
     VALUES ('ASMRFIXY_YT_R1', 'ASMR Fixy', '2026-07-30T00:00:00.000Z', 1, 1000, 90, 'rebooking', 950)`,
  ).run();
  db.prepare(
    `INSERT INTO channel_enrichments (channel_id, result_json, updated_at)
     VALUES ('UCasmrfixy', ?, '2026-07-23T09:45:55.624Z')`,
  ).run(ENRICHMENT_JSON);
  db.prepare(
    `INSERT INTO channel_enrichments (channel_id, result_json, updated_at)
     VALUES ('UCbroken', 'not json', '2026-07-23T09:45:55.624Z')`,
  ).run();
  db.prepare(
    `INSERT INTO channel_enrichment_links (source_type, source_key, channel_id) VALUES
       ('channel_key', 'ASMRFIXY', 'UCasmrfixy'),
       ('campaign', 'ASMRFIXY_YT_R1', 'UCasmrfixy'),
       ('channel_key', 'GHOST', 'UCneverimported')`,
  ).run();

  return db;
}

integration("almedia SQLite import", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;

    const db = await import("@scouting-platform/db");
    prisma = db.createPrismaClient({ databaseUrl });

    await prisma.$connect();
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    vi.resetModules();

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        bookings,
        booking_targets,
        revenue_targets,
        booking_invoices,
        almedia_channel_enrichments,
        almedia_channel_enrichment_links
      RESTART IDENTITY CASCADE
    `);

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
  });

  afterAll(async () => {
    vi.resetModules();

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    await prisma.$disconnect();
  });

  async function loadImporter(): Promise<ImportModule> {
    return import("./import-sqlite");
  }

  it("imports every table and reports per-table counts", async () => {
    const source = createSourceDatabase();
    const { importAlmediaBookingsFromReader } = await loadImporter();

    try {
      expect(await importAlmediaBookingsFromReader(source)).toEqual({
        bookings: 2,
        targets: 1,
        revenueTargets: 1,
        invoices: 1,
        // The unparseable blob is skipped, as is the link pointing at it.
        enrichments: 1,
        enrichmentLinks: 2,
      });
    } finally {
      source.close();
    }

    const [booking] = await prisma.booking.findMany({
      where: { channelName: "ASMR Fixy" },
    });

    expect(booking).toMatchObject({
      legacySourceId: 1,
      // Recomputed from the channel name, not copied from the stale source key.
      channelKey: "ASMRFIXY",
      status: "PUBLISHED",
      cm: "Lucija P",
      intBudget: 12_000,
      month: "2026-07",
      contractSigned: true,
    });

    const target = await prisma.bookingTarget.findFirst();

    expect(target).toMatchObject({
      cm: "Lucija P",
      market: "PL",
      month: "2026-07",
      budgetEur: 60_000,
      tier10kTo20k: 2,
      tier20kTo50k: 1,
      tierUnder10k: 0,
    });

    expect(await prisma.revenueTarget.findFirst()).toMatchObject({
      month: "2026-07",
      totalEur: 500_000,
    });
    expect(await prisma.bookingInvoice.findFirst()).toMatchObject({
      campaignName: "ASMRFIXY_YT_R1",
      maturedAtInvoice: true,
      amount: 950,
    });

    const enrichment = await prisma.almediaChannelEnrichment.findUnique({
      where: { channelId: "UCasmrfixy" },
      include: { links: { orderBy: { sourceKey: "asc" } } },
    });

    // Stored as produced, so a later projection can read fields we skip today.
    expect(enrichment?.result).toMatchObject({
      schemaVersion: "1.0",
      classification: { niche: "asmr" },
    });
    expect(enrichment?.generatedAt.toISOString()).toBe("2026-07-23T09:45:55.624Z");
    expect(enrichment?.links.map((link) => link.sourceKey)).toEqual([
      "ASMRFIXY",
      "ASMRFIXY_YT_R1",
    ]);
  });

  it("falls back to pipeline for an unrecognized source status", async () => {
    const source = createSourceDatabase();
    const { importAlmediaBookingsFromReader } = await loadImporter();

    try {
      await importAlmediaBookingsFromReader(source);
    } finally {
      source.close();
    }

    expect(
      await prisma.booking.findFirst({ where: { channelName: "Diabeuu" } }),
    ).toMatchObject({ status: "PIPELINE" });
  });

  it("is idempotent and picks up source edits on a re-run", async () => {
    const source = createSourceDatabase();
    const { importAlmediaBookingsFromReader } = await loadImporter();

    try {
      await importAlmediaBookingsFromReader(source);

      source
        .prepare("UPDATE bookings SET int_budget = 25000, status = 'longterm' WHERE id = 1")
        .run();
      source
        .prepare("UPDATE targets SET budget_eur = 65000 WHERE cm = 'Lucija P'")
        .run();

      await importAlmediaBookingsFromReader(source);
    } finally {
      source.close();
    }

    expect(await prisma.booking.count()).toBe(2);
    expect(await prisma.bookingTarget.count()).toBe(1);
    expect(await prisma.almediaChannelEnrichment.count()).toBe(1);
    expect(await prisma.almediaChannelEnrichmentLink.count()).toBe(2);
    expect(
      await prisma.booking.findFirst({ where: { legacySourceId: 1 } }),
    ).toMatchObject({ intBudget: 25_000, status: "LONGTERM" });
    expect(await prisma.bookingTarget.findFirst()).toMatchObject({
      budgetEur: 65_000,
    });
  });

  it("tolerates a source database that predates a table", async () => {
    const source = new DatabaseSync(":memory:");

    source.exec(
      `CREATE TABLE revenue_targets (month TEXT PRIMARY KEY, total_eur REAL NOT NULL);
       INSERT INTO revenue_targets (month, total_eur) VALUES ('2026-08', 560000);`,
    );

    const { importAlmediaBookingsFromReader } = await loadImporter();

    try {
      expect(await importAlmediaBookingsFromReader(source)).toEqual({
        bookings: 0,
        targets: 0,
        revenueTargets: 1,
        invoices: 0,
        enrichments: 0,
        enrichmentLinks: 0,
      });
    } finally {
      source.close();
    }
  });
});

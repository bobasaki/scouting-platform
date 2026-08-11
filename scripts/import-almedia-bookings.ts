import process from "node:process";

import {
  importAlmediaBookingsFromSqlite,
  type AlmediaImportCounts,
} from "../backend/packages/core/src";
import { disconnectPrisma } from "../backend/packages/db/src";

/**
 * One-time (re-runnable) import of the standalone Almedia tracker's SQLite
 * store into Postgres.
 *
 * Point `--sqlite` at the LIVE `.db` file — its `-wal` sidecar must sit next to
 * it, or recent edits are silently lost. Copy the `.db`, `-wal`, and `-shm`
 * files together if you import from a copy.
 *
 *   sh scripts/with-local-env.sh pnpm exec tsx scripts/import-almedia-bookings.ts \
 *     --sqlite /Users/you/Projects/almedia_api/data/bookings.db
 *
 * Upserts are keyed so the script is idempotent: bookings on their SQLite id,
 * plan targets on (cm, market, month), revenue targets on month, invoices on
 * campaign name, channel enrichments on YouTube channel id, and their links on
 * (source type, source key).
 */

function getFlagValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argv = process.argv.slice(2);
  const inline = argv.find((value) => value.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = argv.indexOf(`--${name}`);

  return index === -1 ? undefined : argv[index + 1];
}

function formatCounts(counts: AlmediaImportCounts): string {
  return [
    `bookings:        ${counts.bookings}`,
    `plan targets:    ${counts.targets}`,
    `revenue targets: ${counts.revenueTargets}`,
    `invoices:        ${counts.invoices}`,
    `enrichments:     ${counts.enrichments}`,
    `enrichment links:${counts.enrichmentLinks}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const sqlitePath = getFlagValue("sqlite")?.trim();

  if (!sqlitePath) {
    throw new Error(
      "--sqlite <path-to-bookings.db> is required (its -wal sidecar must be alongside it)",
    );
  }

  const counts = await importAlmediaBookingsFromSqlite({ sqlitePath });

  process.stdout.write(`Imported from ${sqlitePath}\n${formatCounts(counts)}\n`);

  if (counts.bookings === 0) {
    process.stdout.write(
      "\nNo bookings were found in the source database. If that is unexpected, " +
        "check that the -wal sidecar was copied alongside the .db file.\n",
    );
  }
}

void main()
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });

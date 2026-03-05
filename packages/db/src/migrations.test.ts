import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const pgbossMigrationPath = path.resolve(
  currentDir,
  "../prisma/migrations/20260305174500_pgboss_setup/migration.sql",
);

describe("pg-boss migration", () => {
  it("installs the pgboss schema and version table", () => {
    const migrationSql = readFileSync(pgbossMigrationPath, "utf-8");

    expect(migrationSql).toContain("CREATE SCHEMA IF NOT EXISTS pgboss");
    expect(migrationSql).toContain("CREATE TABLE pgboss.version");
    expect(migrationSql).toContain("INSERT INTO pgboss.version(version)");
  });
});

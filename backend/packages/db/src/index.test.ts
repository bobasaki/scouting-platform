import process from "node:process";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe("createPrismaClient", () => {
  it("fails fast when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    await expect(import("./index")).rejects.toThrow(
      "DATABASE_URL is required to create a Prisma client",
    );
  });

  it("creates a Prisma client when DATABASE_URL is provided", async () => {
    process.env.DATABASE_URL =
      "postgresql://scouting:scouting@localhost:5432/scouting_platform?schema=public";

    const { createPrismaClient } = await import("./index");
    const prisma = createPrismaClient();

    await expect(prisma.$disconnect()).resolves.toBeUndefined();
  });
});

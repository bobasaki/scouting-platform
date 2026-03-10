import process from "node:process";

import { disconnectPrisma } from "../packages/db/src";
import { seedInitialAdmin } from "../packages/core/src/auth/seed-admin";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

async function main(): Promise<void> {
  const email = normalizeEmail(requiredEnv("INITIAL_ADMIN_EMAIL"));
  const password = requiredEnv("INITIAL_ADMIN_PASSWORD");
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Initial Admin";

  if (password.length < 8) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be at least 8 characters");
  }

  try {
    const user = await seedInitialAdmin({
      email,
      password,
      name,
    });

    process.stdout.write(`Seeded admin user: ${user.email}\n`);
  } finally {
    await disconnectPrisma();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Failed to seed admin user: ${message}\n`);
  process.exit(1);
});

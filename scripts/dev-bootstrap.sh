#!/bin/sh

set -eu

cd /workspace

echo "[bootstrap] validating environment"
node scripts/validate-local-env.mjs --bootstrap

echo "[bootstrap] installing workspace dependencies"
HUSKY=0 pnpm install --frozen-lockfile

echo "[bootstrap] rebuilding deferred native dependencies"
pnpm rebuild --pending

echo "[bootstrap] generating prisma client"
pnpm db:generate

echo "[bootstrap] waiting for postgres"
node scripts/wait-for-postgres-url.mjs

echo "[bootstrap] ensuring test database exists"
pnpm exec tsx scripts/ensure-test-db.ts

echo "[bootstrap] applying prisma migrations"
pnpm db:migrate:deploy

echo "[bootstrap] seeding initial admin"
pnpm db:seed:admin

echo "[bootstrap] complete"

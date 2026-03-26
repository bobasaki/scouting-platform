# Architecture

## 1. System Shape

The system has three runtime components:
- `web`: Next.js application for UI, auth, and server-side route handlers
- `worker`: Node.js process for background jobs and provider orchestration
- `db`: Postgres as the only persistent database

Recommended hosting: Railway with separate staging and production environments.

## 2. Architectural Decisions That Must Not Change Without an ADR

1. Catalog is canonical.
2. Runs are snapshots, not a second data model.
3. Worker is separate from web.
4. Postgres is mandatory.
5. Prisma migrations are the only schema change mechanism.
6. `pg-boss` is the job system.
7. Browser never talks directly to YouTube, OpenAI, HypeAuditor, or HubSpot.
8. Manual admin overrides outrank all automated data.
9. Every async workflow stores status and last error.
10. Every privileged action emits an audit event.

Any change to these requires:
- a short ADR in `/docs`
- approval from both Ivan and Marin

## 3. Repository Layout

The repository is organized by responsibility first, then by package:

```text
frontend/
  web/
    app/
    components/
    lib/
    e2e/
backend/
  worker/
    src/
  packages/
    core/
      src/
    db/
      prisma/
      src/
    integrations/
      src/
shared/
  packages/
    contracts/
      src/
    config/
      src/
docs/
  ADR-001-architecture.md
  ADR-002-data-ownership-and-precedence.md
  ADR-003-repository-layout-simplification.md
  README.md
  setup/
scripts/
docker/
```

## 4. Directory Responsibilities

### `frontend/web`
- authenticated UI
- app shell and navigation
- server-rendered pages
- route handlers / BFF layer
- auth/session boundary checks
- Playwright coverage and UI-focused tests

### `backend/worker`
- pg-boss worker bootstrapping
- job registration and execution
- scheduled maintenance tasks
- provider retry logic
- long-running imports, exports, and enrichment work

### `backend/packages/core`
- domain services
- business rules
- merge and precedence logic
- run orchestration
- approval rules
- import/export orchestration

### `backend/packages/db`
- Prisma schema
- migrations
- Prisma client setup
- transaction helpers
- DB-owned access helpers where useful

### `backend/packages/integrations`
- YouTube API adapter
- OpenAI adapter
- HypeAuditor adapter
- HubSpot adapter

### `shared/packages/contracts`
- zod schemas
- DTOs
- route contracts
- queue payload contracts

### `shared/packages/config`
- env validation
- runtime configuration
- feature flags
- shared constants

### Root-level support directories
- `docs/`: ADRs, setup guides, plans, contributor guidance
- `scripts/`: operational and developer automation
- `docker/`: local container definitions and bootstrap assets
- repo root: shared workspace/tooling config such as `turbo`, TypeScript, ESLint, and package-manager files

## 5. Why The Layout Changed

The old `apps/` and `packages/` split was technically valid but made the repository harder to scan because frontend, backend, and shared concerns were mixed at the same level. The new layout keeps the same runtime boundaries and package names, but groups them into clearer top-level domains:

- `frontend/` for browser-facing and Next.js code
- `backend/` for worker code, domain logic, database code, and provider adapters
- `shared/` for cross-runtime contracts and configuration

This is a navigation and maintenance refactor, not a product or runtime rewrite.

## 6. Core Flows

### 6.1 Catalog Browse
1. User requests catalog page.
2. Web server validates session.
3. Web queries Postgres using resolved channel profile and filters.
4. UI renders paginated results.

### 6.2 Run Creation
1. User submits run form.
2. Web validates session, role, and assigned YouTube key.
3. Web creates `run_requests` record.
4. Worker processes discovery job.
5. Worker searches catalog and YouTube.
6. Worker upserts new channel and source rows.
7. Worker produces `run_results` snapshot.
8. UI polls job status.

### 6.3 LLM Enrichment
1. User or system requests enrichment.
2. Worker loads cached text context if present.
3. Worker fetches missing YouTube context only when needed.
4. Worker calls OpenAI.
5. Result is stored as source snapshot and resolved enrichment projection.
6. Errors are saved to job state and enrichment row.

### 6.4 HypeAuditor Approval Flow
1. User requests advanced report.
2. Request row is created in `pending_approval` unless an active request already exists.
3. Admin approves or rejects.
4. Admin can see the age of the last completed report and whether it is still inside the 120-day review window.
5. Approved request becomes a queued job.
6. Worker calls HypeAuditor.
7. Result is stored and merged into resolved channel data.
8. Audit events are recorded for request and approval.

### 6.5 CSV Import
1. Admin uploads strict-template CSV.
2. Web stores batch metadata.
3. Worker validates and processes rows.
4. Valid rows become imported source snapshots or overrides.
5. Row-level failures are persisted.

### 6.6 HubSpot Push
1. User selects creators.
2. Web creates push batch.
3. Worker pushes creators to HubSpot.
4. Per-record success or failure is saved.
5. UI shows batch results and retryable failures.

## 7. Data Model Direction

### Canonical Tables
- `users`
- `sessions`
- `user_provider_credentials`
- `channels`
- `channel_contacts`
- `channel_metrics`
- `channel_enrichments`
- `channel_manual_overrides`
- `saved_segments`
- `run_requests`
- `run_results`
- `advanced_report_requests`
- `csv_import_batches`
- `csv_import_rows`
- `hubspot_push_batches`
- `audit_events`

### Raw/Source Tables
- `channel_source_snapshots`
- `channel_provider_payloads`

### Queue / Operational Tables
- `pgboss.job` and related internal queue tables

## 8. Merge Strategy

Store both:
- raw provider/import payloads
- resolved channel profile used by the UI

Resolved profile is computed by precedence:
1. admin manual override
2. admin CSV import
3. HypeAuditor
4. LLM
5. heuristics
6. YouTube raw

This avoids losing provenance and makes manual correction safe.

## 9. Auth and Permissions

- Auth.js credentials provider
- Passwords hashed with argon2
- Role column on `users`
- Admin-only actions enforced in route handlers and service layer

### Roles
- `admin`
- `user`

## 10. Background Jobs

Use `pg-boss`.

Initial job families:
- `runs.discover`
- `runs.recompute`
- `channels.enrich.llm`
- `channels.enrich.hypeauditor`
- `imports.csv.process`
- `exports.csv.generate`
- `hubspot.push.batch`
- `maintenance.refresh-stale`

### Job Requirements
- stable payload schema
- retries with bounded backoff
- status + timestamps + last error
- idempotent where possible
- explicit concurrency caps per provider

## 11. Security Rules

- Encrypt user YouTube keys at rest with `APP_ENCRYPTION_KEY`
- Never expose company secrets to the browser
- Use server-side permission checks for every mutation
- Keep audit events immutable
- Prefer optimistic UI only for non-critical UX, never for approvals/import outcomes

## 12. Testing Strategy

### Unit
- domain rules
- merge precedence
- provider adapters
- queue payload validation

### Integration
- DB repositories and transactions
- route handlers
- auth rules
- worker job behavior
- Prisma migration safety

### End-to-end
- login
- catalog browse/detail
- run creation and status
- enrichment visibility
- admin approvals
- CSV import/export
- HubSpot push flows

## 13. Migration Notes For Contributors

- Package names did not change. Existing `@scouting-platform/*` imports remain valid.
- The refactor is mostly path-level. If a script imports files by relative filesystem path, prefer the new `frontend/`, `backend/`, and `shared/` roots.
- Workspace discovery now comes from `pnpm-workspace.yaml` entries for `frontend/*`, `backend/*`, `backend/packages/*`, and `shared/packages/*`.
- Root tooling files remain at the repository root so editor, CI, and local commands continue to work from `/`.

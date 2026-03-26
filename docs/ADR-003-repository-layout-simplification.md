# ADR-003: Repository Layout Simplification

## Status

Proposed

## Context

The repository kept frontend, backend, and shared packages under the same top-level `apps/` and `packages/` directories. That layout preserved runtime boundaries, but it made the codebase harder to navigate because:

- web and worker entrypoints were separated from the backend packages they depend on
- shared packages were visually mixed with backend-only packages
- new contributors had to learn package intent before they could infer where code lived

The refactor goal is organizational clarity, not a runtime redesign.

## Decision

Reorganize the repository into responsibility-oriented top-level directories:

```text
frontend/
  web/
backend/
  worker/
  packages/
    core/
    db/
    integrations/
shared/
  packages/
    contracts/
    config/
```

Keep all runtime boundaries, package names, and architectural rules unchanged:

- `frontend/web` remains the Next.js app
- `backend/worker` remains the separate worker process
- `backend/packages/core` remains the domain layer
- `backend/packages/db` remains the Prisma and database layer
- `backend/packages/integrations` remains the provider adapter layer
- `shared/packages/contracts` and `shared/packages/config` remain cross-runtime packages

## Consequences

### Positive

- frontend, backend, and shared code are immediately discoverable from the repo root
- package responsibilities are easier to infer without reading multiple docs first
- runtime architecture remains unchanged, so the refactor risk stays low

### Neutral / Required follow-up

- path-sensitive scripts, test helpers, workspace globs, and docs must be updated
- historical ADRs remain valid for system boundaries, but newer docs should reference the new paths

## Approval

Per repository policy, this ADR requires Ivan and Marin approval before merge.

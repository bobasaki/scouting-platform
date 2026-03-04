# Tasks

## Work split

This split is by ownership surface, not skill hierarchy.

### You own:

- DB schema and migrations
- auth backend and session model
- queue/worker architecture
- external integrations
- run orchestration
- enrichment pipeline
- Hype approval backend
- CSV import backend
- HubSpot backend
- CI/CD and deployment

### Marin owns:

- app shell and UI system
- auth screens
- catalog list/detail UX
- saved segments UX
- run create/results UX
- admin dashboard UX
- CSV import UI
- manual edit UI
- Hype approval UI
- HubSpot push UI
- Playwright e2e coverage

### Both of you:

- pair on schema and ADR decisions
- review every PR
- pair on final integration of each milestone
- never merge a Prisma migration without both reviewing it

## Milestone plan

Assuming 30h/week each, this is a realistic 6 to 7 week build.

### Week 0: Foundation

#### You:

- [done] create monorepo
- [ongoing] set up Prisma + Postgres
- [ongoing] set up pg-boss
- [done] set up base env/config package
- [ongoing] set up GitHub Actions
- [done] write ADR-001 architecture
- [done] write ADR-002 data ownership and precedence

#### Marin:

- [ongoing] bootstrap Next app
- [ongoing] set up design tokens/layout/navigation
- [ongoing] set up Auth.js UI flow
- [ongoing] create base route protection and role-aware layout
- [ongoing] create empty screens for catalog, runs, admin

Done when:

- [ongoing] repo builds
- [ongoing] CI runs
- [ongoing] staging deploy exists
- [ongoing] auth shell exists
- [done] no feature code yet

### Week 1: Auth, users, and catalog skeleton

#### You:

- [ongoing] implement user/admin schema
- [ongoing] credentials auth
- [ongoing] session handling
- [ongoing] encrypted YouTube key storage
- [ongoing] admin user management backend
- [ongoing] channel schema and repositories

#### Marin:

- [ongoing] login screen
- [ongoing] admin user management UI
- [ongoing] account detail UI for user YouTube credential state
- [ongoing] catalog table shell
- [ongoing] channel detail shell

Done when:

- [ongoing] admin can create a user
- [ongoing] admin can assign/update YouTube key
- [ongoing] user can log in
- [ongoing] empty catalog pages load safely

### Week 2: Catalog browsing, segments, manual edit

#### You:

- [ongoing] channel list/detail queries
- [ongoing] segment persistence
- [ongoing] manual override model and merge logic
- [ongoing] audit events for edits

#### Marin:

- [ongoing] catalog filters
- [ongoing] channel detail page
- [ongoing] saved segments UX
- [ongoing] admin manual edit UI
- [ongoing] row selection UX

Done when:

- [ongoing] catalog list/detail works
- [ongoing] segments save/load
- [ongoing] admin manual edits persist and override automated values

### Week 3: Runs and discovery

#### You:

- [ongoing] run request model
- [ongoing] run execution service
- [ongoing] YouTube discovery adapter using per-user key
- [ongoing] dedupe/union with catalog
- [ongoing] run result snapshot model
- [ongoing] background job for discovery

#### Marin:

- [ongoing] create run UI
- [ongoing] recent runs UI
- [ongoing] run detail UI
- [ongoing] progress/status polling
- [ongoing] clear error states for missing YouTube key or quota failure

Done when:

- [ongoing] manager can create a run
- [ongoing] run uses both catalog and new discovery
- [ongoing] results are saved and viewable

### Week 4: LLM enrichment

#### You:

- [ongoing] cached YouTube context model
- [ongoing] LLM enrichment service
- [ongoing] enrichment jobs
- [ongoing] stale/missing enrichment policy
- [ongoing] error persistence and retry policy
- [ongoing] quota-conscious YouTube fetch logic

#### Marin:

- [ongoing] enrichment status UI
- [ongoing] row-level enrichment visibility
- [ongoing] batch enrich actions
- [ongoing] better job feedback in runs and channel detail

Done when:

- [ongoing] manager can enrich from UI
- [ongoing] errors are visible
- [ongoing] repeated enrich does not re-fetch wastefully

### Week 5: HypeAuditor and admin workflows

#### You:

- [ongoing] HypeAuditor adapter
- [ongoing] advanced report request model
- [ongoing] approval workflow backend
- [ongoing] worker execution for approved requests
- [ongoing] admin CSV import backend
- [ongoing] import validation and row error reporting

#### Marin:

- [ongoing] request HypeAuditor UI
- [ongoing] approval queue UI
- [ongoing] admin import screen
- [ongoing] import result/error UI
- [ongoing] admin dashboard first useful version

Done when:

- [ongoing] managers can request advanced reports
- [ongoing] admins can approve/reject
- [ongoing] admins can import CSV and see row-level failures

### Week 6: Export and HubSpot

#### You:

- [ongoing] CSV export service
- [ongoing] HubSpot push service
- [ongoing] push batch model
- [ongoing] push retry/error handling
- [ongoing] audit events for exports/pushes

#### Marin:

- [ongoing] select creators for export/push
- [ongoing] export UI
- [ongoing] HubSpot push UI
- [ongoing] batch result screens
- [ongoing] polish admin dashboard

Done when:

- [ongoing] managers can export selected creators
- [ongoing] managers can push selected creators to HubSpot
- [ongoing] failures are visible and auditable

### Week 7: Stabilization

#### You:

- [ongoing] DB/index tuning
- [ongoing] job concurrency tuning
- [ongoing] staging load smoke
- [ongoing] deploy/rollback docs
- [ongoing] backup/restore drill

#### Marin:

- [ongoing] Playwright coverage for critical flows
- [ongoing] accessibility cleanup
- [ongoing] edge-case UI fixes
- [ongoing] empty/loading/error state pass

#### Both:

- [ongoing] fix bugs only
- [ongoing] no scope expansion
- [ongoing] production checklist
- [ongoing] launch

## Full CI from day one

Require on every PR:

- [ongoing] typecheck
- [ongoing] lint
- [ongoing] Prisma validate
- [ongoing] unit tests
- [ongoing] integration tests with ephemeral Postgres
- [ongoing] web build
- [ongoing] worker build
- [ongoing] Playwright smoke tests

## Protected `main` rules:

- [ongoing] passing CI required
- [ongoing] one approval required
- [ongoing] no direct pushes
- [ongoing] migrations require review from the other person

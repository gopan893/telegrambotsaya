# Integration Contract

## Dashboard Tab Contract

Each known dashboard tab MUST have:
1. Menu item in `public/dashboard/index.html` — `<a href="#tabid" data-tab="tabid">`
2. Registry entry in `public/dashboard/state.js` — `DASHBOARD_TABS` object
3. Renderer function in `public/dashboard/ui.js` — `renderTabName()`
4. Optional backend API route in `src/dashboard/dashboard-routes.js`
5. Test validation for tab existence

Known tabs must NOT fallback to System Overview.
Unknown tabs MAY fallback to Overview.

## Backend Route Contract

Each API route in `src/dashboard/dashboard-routes.js` SHOULD:
1. Be protected by auth middleware (unless public health endpoint)
2. Validate and sanitize inputs
3. Return safe responses (no secrets)
4. Be used by frontend or documented

## Executor Contract

Write/external/danger actions MUST follow:
1. dry-run
2. Evaluation v2
3. executor proposal
4. approval
5. run

No direct write. No auto-approve. No auto-run.

## Deploy Contract

Deploy/rollback actions MUST follow:
1. Render deploy gate check
2. Env check (names only — never values)
3. Deploy plan creation
4. Deploy proposal creation (status: pending_approval or blocked)
5. Evaluation v2
6. Executor proposal + approval
7. Run deploy/Run rollback

No direct deploy. No auto-rollback. No secret exposure.

## Observability / Incident Contract

Production incident repair/rollback actions MUST follow:

1. production health check or incident detection
2. severity classification
3. timeline/root-cause analysis
4. response plan creation
5. Evaluation v2 gate
6. executor proposal
7. approval
8. run

No direct repair, rollback, deploy, shell, or external write action may run from observability detection or dashboard analysis.

## Knowledge / Memory Contract (Phase 42)

Knowledge ingestion MUST follow:

1. memory safety gate (secret detection + redaction)
2. deduplication (fingerprint or explicit allow)
3. knowledge graph store create (or merge)
4. audit log entry

Memory must never:

- Store raw secret values.
- Hard delete (archive only).
- Mutate protected decisions.
- Bypass the safety gate.

Knowledge retrieval must:

- Filter by query / context (no global dump).
- Redact any secret-shaped content from output.
- Avoid unrelated technical detail in personal/emotional chat.

The knowledge graph is the source of truth for decision memory. Modules that
need to know *why* a project rule exists should query the knowledge graph,
not the prompt.

## Portfolio Contract (Phase 42)

Portfolio Manager actions MUST follow:

1. portfolio scan/ranking/report as read-only
2. dependency/staleness/risk/cost review as read-only
3. strategy plan creation as read-only
4. if write/external/danger action is needed, create action plan only
5. Evaluation v2 gate
6. executor proposal
7. approval
8. run

No direct GitHub push, workflow dispatch, Render deploy, rollback, shell, repo mutation, or hard delete may run from Portfolio routes, Telegram commands, or natural chat.

Dashboard tab `portfolio` must have menu item, registry entry, `public/dashboard/portfolio.js` renderer, protected API route, and route tests.

## Module Creation Contract

Before creating a new file/module:
1. Search existing modules in `src/` for similar functionality
2. If similar exists, reuse/extend — do NOT duplicate
3. Only create new if no suitable existing module
4. Connect to entry point, dashboard, tests, and docs
5. Update ARCHITECTURE_MAP.md

## Dev Governance Contract

1. AGENTS.md must exist with all required sections
2. AGENT_HANDOFF.md must exist and be updated per task
3. ARCHITECTURE_MAP.md must be generated after significant changes
4. Integration contract must be validated periodically
5. Collision detector must be run before merging new modules
6. Dashboard route consistency must be checked after tab changes
7. Test matrix must be generated for changed areas
8. Next-agent prompt must be generated at handoff
9. CI/CD governance gate must pass on push

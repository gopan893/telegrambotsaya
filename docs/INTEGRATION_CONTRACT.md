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

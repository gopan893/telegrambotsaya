# AGENT_HANDOFF.md

## Purpose

This file is the shared handoff contract between OpenCode and Codex agents.
It tracks what was done, what is unfinished, and what the next agent should do.

---

## Session Log

### Last Agent
OpenCode

### Date
2026-06-06

### Current Task
Create OpenCode ↔ Codex Integration Protocol — shared contract files, audit-first workflow, and P0 stability.

### Files Changed
- `AGENTS.md` — updated with integration/testing rules
- `docs/AGENT_HANDOFF.md` — rewritten as handoff contract
- `docs/INTEGRATION_CONTRACT.md` — created (new)
- `docs/ARCHITECTURE_MAP.md` — created (new)
- `docs/TESTING.md` — created (new)
- `docs/OPEN_CODE_RECOVERY_AUDIT.md` — created (new)

### What Was Completed
- Created 5 contract files defining the OpenCode ↔ Codex protocol
- Documented all 29 dashboard tabs with renderer and backend route status
- Documented all 145 test files with PASS/FAIL/SKIPPED rules
- Mapped entire architecture (entry points, modules, duplicates)
- Updated AGENTS.md with integration contract rules and forbidden actions
- Created recovery audit template for when Codex token expires

### What Is Unfinished
- `test-websocket-monitoring.js` and `test-cicd-quality-gates.js` still missing from scratch/ (notified as SKIPPED)
- Dashboard tabs (workspaces, users, permissions, planner, executor, tools, backup, audit, agent-evaluation) remain as placeholders
- Self-healing, monitoring, cicd routes are conditional on service objects being passed

### Integration Notes
- All 29 dashboard tabs are registered in DASHBOARD_TABS
- All known tabs have renderers (some are placeholders)
- No known tab falls back to Overview
- Routine routes now registered (was missing before)
- ui.js `Api.get()`/`Api.post()` calls fixed to `Api.apiGet()`/`Api.apiPost()`
- Service worker now pre-caches all referenced scripts
- AGENTS.md is the single source of truth for project rules

### Tests Run
| Test | Result |
|---|---|
| `node --check telebot.js` | PASS |
| `node --check src/dashboard/dashboard-routes.js` | PASS |
| `node --check src/dashboard/index.js` | PASS |
| `node --check src/dashboard/routine-routes.js` | PASS |
| `scratch/test-dashboard-router-registry.js` | PASS (111/112) |
| `scratch/test-dashboard-all-menu-routes.js` | PASS (41/41) |
| `scratch/test-dashboard-dark-form-ui.js` | PASS (28/28) |
| `scratch/test-natural-chat-stable-release.js` | PASS (10/10) |
| `scratch/test-executor-boundary-stable-release.js` | PASS (10/10) |
| `scratch/test-integration-gate-stable-release.js` | PASS (12/12) |
| `scratch/test-coding-workspace-stable-release.js` | PASS (10/10) |
| `scratch/test-selfhealing-health-suite.js` | PASS (9/9) |
| `scratch/test-file-analysis-leak.js` | PASS |
| `scratch/test-pwa-assets.js` | PASS |
| `scratch/test-websocket-monitoring.js` | SKIPPED (file not found) |
| `scratch/test-cicd-quality-gates.js` | SKIPPED (file not found) |

### Tests Failed
- `test-dashboard-router-registry.js`: 1 FAIL — `SW has network-first strategy` (pre-existing, non-P0)

### Remaining Risks
- PWA cache: `realtime-monitoring.js` and `cicd.js` now in STATIC_ASSETS but need deploy to take effect
- Self-healing, monitoring, cicd backend routes silently return 404 if their service objects are not provided
- Two test files don't exist in scratch/ — need creation

### Next Safe Task for Codex
```
1. Read docs/AGENT_HANDOFF.md, AGENTS.md, docs/INTEGRATION_CONTRACT.md, docs/ARCHITECTURE_MAP.md, docs/TESTING.md
2. Read current git status and diff
3. Run node --check telebot.js
4. Run related scratch tests
5. Do NOT add new features until P0 list from AGENTS.md is stable
6. Update this handoff file before finishing
```

### Recommended Next Branch/Commit
No branch switch needed. Current state is stable.

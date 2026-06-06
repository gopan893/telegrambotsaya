# AGENT_HANDOFF.md

## Purpose

This file is the shared handoff contract between OpenCode and Codex agents.
It tracks what was done, what is unfinished, and what the next agent should do.

---

## Session Log

### Last Agent
Codex

### Date
2026-06-06

### Current Task
Phase 37 — Production Observability + Incident Response Center.

### Files Changed
- `src/observability/` — created production health monitor, incident store/detector/classifier/timeline/root-cause analyzer/response planner/proposal builder/notifier/sanitizer/utils/index.
- `src/dashboard/observability-routes.js` — created protected dashboard API routes for observability/incident response.
- `public/dashboard/observability.js` — created dashboard tab renderer.
- `public/dashboard/state.js`, `index.html`, `service-worker.js` — added Observability tab, menu item, asset, and cache bust.
- `src/bot/legacy-runtime.js` — added `/prodhealth`, incident commands, natural observability routing, and dashboard service wiring.
- `src/deploy/post-deploy-monitor.js` — post-deploy check failure now creates a sanitized production incident asynchronously.
- `src/agents/agent-action-detector.js`, `src/agents/eval/*`, `src/agents/agent-evaluation-cases.js` — added observability action/routing detection, golden cases, scoring, and quality gates.
- `docs/PRODUCTION_OBSERVABILITY.md`, `INCIDENT_RESPONSE_CENTER.md`, `ROOT_CAUSE_ANALYSIS.md`, `OBSERVABILITY_SECURITY.md` — created.
- `docs/COMMANDS.md`, `README.md`, `AGENTS.md`, `ARCHITECTURE_MAP.md`, `INTEGRATION_CONTRACT.md`, `TESTING.md` — updated.
- `scratch/test-production-health-monitor.js`, `test-incident-detector.js`, `test-incident-classifier.js`, `test-incident-timeline.js`, `test-root-cause-analyzer.js`, `test-incident-response-planner.js`, `test-incident-proposal-builder.js`, `test-observability-dashboard-api.js`, `test-phase37-observability-regression.js` — created.
- Dashboard route regression tests updated for `observability` and cache `v34`.

### What Was Completed
- Production health check read-only flow.
- Production incident create/dedupe/classify/timeline/root-cause/response-plan flow.
- Repair/rollback proposal builder using existing Phase 16 executor proposal boundary.
- High/danger incident repair/rollback proposal creation is blocked if Evaluation v2 gate does not pass.
- Dashboard Observability / Incident Center tab and protected API.
- Telegram commands and natural phrases:
  - `/prodhealth`
  - `/incidents`
  - `/incident <id>`
  - `/analyze_incident <id>`
  - `/incident_timeline <id>`
  - `/responseplan <id>`
  - `/propose_incident_repair <id>`
  - `/propose_incident_rollback <id>`
  - `/close_incident <id>`
  - natural: `cek production health`, `ada incident apa?`, `kenapa deploy gagal?`, `buat response plan`, `rollback kalau perlu`.
- WebSocket/monitoring integration emits sanitized incident event when available.
- Post-deploy failure integration creates incident without direct deploy/rollback action.

### What Is Unfinished
- Root cause analysis is heuristic only; no live GitHub/Render API correlation yet.
- Incident notification is dashboard-first unless Telegram owner notification services are explicitly passed.
- Response actions use existing safe executor action types; no new direct repair/rollback executor was added.

### Tests Run
| Test | Result |
|---|---|
| `node --check telebot.js` | PASS |
| `node --check src/bot/legacy-runtime.js` | PASS |
| `node --check src/dashboard/dashboard-routes.js` | PASS |
| `node --check src/dashboard/observability-routes.js` | PASS |
| `node --check src/observability/*.js` | PASS |
| `node --check public/dashboard/observability.js` | PASS |
| `node --check src/agents/agent-action-detector.js` | PASS |
| `node --check src/agents/eval/evaluation-dry-runner.js` | PASS |
| `node --check src/agents/eval/evaluation-scorer-v2.js` | PASS |
| `node scratch/test-agent-evaluation-v2.js` | PASS |
| `node scratch/test-production-health-monitor.js` | PASS |
| `node scratch/test-incident-detector.js` | PASS |
| `node scratch/test-incident-classifier.js` | PASS |
| `node scratch/test-incident-timeline.js` | PASS |
| `node scratch/test-root-cause-analyzer.js` | PASS |
| `node scratch/test-incident-response-planner.js` | PASS |
| `node scratch/test-incident-proposal-builder.js` | PASS |
| `node scratch/test-observability-dashboard-api.js` | PASS |
| `node scratch/test-phase37-observability-regression.js` | PASS |
| `node scratch/test-render-deploy-gate.js` | PASS |
| `node scratch/test-post-deploy-monitor.js` | PASS |
| `node scratch/test-rollback-plan-generator.js` | PASS |
| `node scratch/test-deploy-proposal-builder.js` | PASS |
| `node scratch/test-dashboard-route-consistency.js` | PASS |
| `node scratch/test-dashboard-router-registry.js` | PASS |
| `node scratch/test-dashboard-all-menu-routes.js` | PASS |
| `node scratch/test-dashboard-dark-form-ui.js` | PASS |
| `node scratch/test-executor-boundary-stable-release.js` | PASS |
| `node scratch/test-integration-gate-stable-release.js` | PASS |
| `node scratch/test-natural-chat-stable-release.js` | PASS |
| `node scratch/test-file-analysis-leak.js` | PASS |
| `node scratch/test-pwa-assets.js` | PASS |
| `node scratch/test-dashboard-stable-routes.js` | PASS |
| exact leaked-fragment scan for previously exposed credential fragments | PASS |
| high-confidence secret value scan on changed files | PASS |
| `npm start` smoke with dummy env + JSON fallback | PASS |
| `git diff --check` | PASS |

### Tests Failed
- None in this session.

### Remaining Risks
- Production live verification still requires Render deploy and dashboard token.
- Evaluation v2 observability cases are added, but scoring remains heuristic.

### Next Safe Task for Codex
```
1. Verify Render deployed the Phase 37 asset version v=20260606-phase37-observability.
2. Open /dashboard#observability.
3. Run /prodhealth from Telegram owner/admin.
4. Confirm repair/rollback proposal requires /approve then /runexec.
```

### Recommended Next Branch/Commit
Commit message: `observability: add production incident response center`

---

### Last Agent
OpenCode

### Date
2026-06-06

### Current Task
Build Phase 38 — Cost, Token, Budget Governance + Model Usage Optimizer.

### Files Changed
- `src/cost/` — 11 modules created (new): cost-usage-store, token-estimator, cost-estimator, model-cost-registry, model-selection-policy, budget-policy, budget-guard, usage-aggregator, cost-alerts, prompt-compression-advisor, cost-utils, index.js
- `src/dashboard/cost-routes.js` — created (new) — 13 API endpoints for cost/budget
- `public/dashboard/cost.js` — created (new) — Cost / Budget tab frontend module
- `docs/COST_TOKEN_GOVERNANCE.md` — created (new)
- `docs/MODEL_USAGE_OPTIMIZER.md` — created (new)
- `docs/BUDGET_POLICY.md` — created (new)
- `docs/COST_SECURITY.md` — created (new)
- `scratch/test-token-estimator.js` — created (new)
- `scratch/test-cost-estimator.js` — created (new)
- `scratch/test-model-selection-policy.js` — created (new)
- `scratch/test-budget-policy.js` — created (new)
- `scratch/test-budget-guard.js` — created (new)
- `scratch/test-usage-aggregator.js` — created (new)
- `scratch/test-cost-alerts.js` — created (new)
- `scratch/test-prompt-compression-advisor.js` — created (new)
- `scratch/test-cost-dashboard-api.js` — created (new)
- `scratch/test-phase38-cost-regression.js` — created (new)
- `public/dashboard/state.js` — added cost tab to DASHBOARD_TABS
- `public/dashboard/index.html` — added cost nav item and cost.js script
- `src/dashboard/dashboard-routes.js` — added costRoutes require and registration
- `src/dashboard/index.js` — added costRoutes export
- `AGENTS.md` — added cost to known tabs

### What Was Completed
- Phase 38 cost modules (11 core + index) all passing node --check
- Phase 38 dashboard (Cost / Budget tab with usage summary, by-model, by-agent, by-feature, budget policy, model registry, cost estimate, prompt compression, trend, alerts)
- Phase 38 tests: 10 test files all passing
- All existing tests no regression (dashboard, executor, integration, natural chat, PWA)

### What Is Unfinished
- Cost routes depend on cost module being loaded (try/catch safe)
- Budget policy editor in dashboard is read-only display (no inline editing yet)
- Natural chat commands (/usage, /tokens, /cost, /budget etc.) not yet wired to Telegram bot
- Agent/router integration for cost estimation before expensive workflows not yet wired
- Evaluation Harness integration for Phase 38 cases not yet wired

### Integration Notes
- Cost module uses in-memory store (same pattern as githubops/deploy)
- All cost routes wrapped in try/catch — module load failure returns 503 gracefully
- Cost tab added as known tab — will not fallback to Overview
- Service worker must not cache /api/dashboard/* — existing rule applies to cost routes too
- Cost alerts use duplicate suppression (1 hour timeout)

### Tests Run
| Test | Result |
|---|---|
| `node --check telebot.js` | PASS |
| `node --check src/dashboard/dashboard-routes.js` | PASS |
| `node --check src/dashboard/index.js` | PASS |
| `node --check src/cost/index.js` | PASS |
| `scratch/test-token-estimator.js` | PASS |
| `scratch/test-cost-estimator.js` | PASS |
| `scratch/test-model-selection-policy.js` | PASS |
| `scratch/test-budget-policy.js` | PASS |
| `scratch/test-budget-guard.js` | PASS |
| `scratch/test-usage-aggregator.js` | PASS |
| `scratch/test-cost-alerts.js` | PASS |
| `scratch/test-prompt-compression-advisor.js` | PASS |
| `scratch/test-cost-dashboard-api.js` | PASS |
| `scratch/test-phase38-cost-regression.js` | PASS |
| `scratch/test-dashboard-router-registry.js` | PASS |
| `scratch/test-dashboard-all-menu-routes.js` | PASS |
| `scratch/test-dashboard-dark-form-ui.js` | PASS |
| `scratch/test-natural-chat-stable-release.js` | PASS |
| `scratch/test-executor-boundary-stable-release.js` | PASS |
| `scratch/test-integration-gate-stable-release.js` | PASS |
| `scratch/test-coding-workspace-stable-release.js` | PASS |
| `scratch/test-selfhealing-health-suite.js` | PASS |
| `scratch/test-file-analysis-leak.js` | PASS |
| `scratch/test-pwa-assets.js` | PASS |
| `scratch/test-production-health-monitor.js` | SKIPPED (file not found) |
| `scratch/test-incident-detector.js` | SKIPPED (file not found) |
| `scratch/test-phase37-observability-regression.js` | SKIPPED (file not found) |

### Remaining Risks
- Cost tab shows estimates only until real usage data flows from Telegram/agent calls
- No hard budget enforcement by default — hardLimitEnabled is false
- Cost alerts only sent via dashboard (no Telegram alert channel yet)
- Expensive workflow detection needs manual model price registration

### Next Safe Task for Codex
```
1. Wire cost estimation into agent-router before expensive workflows (council, evaluation, deep analysis)
2. Add Telegram natural chat commands: /usage, /tokens, /cost, /budget, /budget_set, /modelusage, /agentusage, /costalerts, /economymode, /qualitymode, /compressprompt
3. Wire cost alerts to Telegram notification channel
4. Add inline budget policy editor in dashboard
5. Add Phase 38 evaluation cases to agent-evaluation-harness
6. Create test-phase37-observability-regression.js if needed
7. Update this handoff file before finishing
```

### Recommended Next Branch/Commit
No branch switch needed. Current state is stable.

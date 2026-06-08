# AGENT_HANDOFF.md

## Purpose

This file is the shared handoff contract between OpenCode and Codex agents.
It tracks what was done, what is unfinished, and what the next agent should do.

---

## Session Log

### Last Agent
OpenCode

### Date
2026-06-07

### Current Task
Phase 44.5 — Universal Telegram Control Layer + Natural Command Governance.

### Files Changed
- `src/telegram-control/` — created 13 modules: command-registry, natural-router, intent-classifier, permission-guard, risk-classifier, response-formatter, help-menu, proposal-router, command-audit, rate-limit, session-context, utils, index.
- `src/dashboard/telegram-control-routes.js` — created 9 protected API endpoints.
- `public/dashboard/telegram-control.js` — created Telegram Control dashboard tab.
- `public/dashboard/state.js` — registered `telegram-control` tab with aliases.
- `public/dashboard/index.html` — added nav item and script tag (cache-busted).
- `public/dashboard/service-worker.js` — bumped cache to v39, added telegram-control.js.
- `src/dashboard/index.js` — added telegramControlRoutes export.
- `src/dashboard/dashboard-routes.js` — registered telegram-control routes.
- `docs/UNIVERSAL_TELEGRAM_CONTROL_LAYER.md` — created architecture doc.
- `docs/TELEGRAM_COMMANDS.md` — created complete command reference (~250 commands).
- `docs/TELEGRAM_NATURAL_CHAT_ROUTING.md` — created natural language routing doc.
- `docs/TELEGRAM_SECURITY.md` — created security documentation.
- `docs/TELEGRAM_APPROVAL_FLOW.md` — created approval flow documentation.
- `scratch/test-telegram-command-registry.js` — created (unit tests).
- `scratch/test-telegram-natural-router.js` — created (unit tests).
- `scratch/test-telegram-intent-classifier.js` — created (unit tests).
- `scratch/test-telegram-permission-guard.js` — created (unit tests).
- `scratch/test-telegram-risk-classifier.js` — created (unit tests).
- `scratch/test-telegram-response-formatter.js` — created (unit tests).
- `scratch/test-telegram-help-menu.js` — created (unit tests).
- `scratch/test-telegram-proposal-router.js` — created (unit tests).
- `scratch/test-telegram-command-audit.js` — created (unit tests).
- `scratch/test-telegram-control-dashboard-api.js` — created (mock API tests).
- `scratch/test-phase44-5-telegram-control-regression.js` — created (full flow tests).
- `AGENTS.md` — added telegram-control to known tabs, added Phase 44.5 rules.
- `docs/ARCHITECTURE_MAP.md` — added telegram-control tab, routes, modules.
- `docs/COMMANDS.md` — added Phase 44.5 command coverage section.
- `docs/INTEGRATION_CONTRACT.md` — added Telegram Control Layer contract.
- `docs/TESTING.md` — added Telegram Control Layer test section.
- `README.md` — added Phase 44.5 summary.
- `docs/AGENT_HANDOFF.md` — updated this handoff.

### What Was Completed
- Universal Telegram command registry with ~250 built-in commands across 20 categories.
- Natural language router with 50+ intent patterns, secret detection, greeting/thanks handling.
- Permission guard with owner/admin/workspace checks, Life OS privacy.
- Risk classifier with 5 levels (read_only → danger), evaluation gate, proposal gating.
- Response formatter with short/long/list/error/proposal formats, sanitization, chunking.
- Help menu system with main menu, category menu, command help, search.
- Proposal router with create/link/format/duplicate detection/pending list.
- Command audit logger with filters and sanitization.
- Rate limiter with per-risk-level limits, duplicate suppression, bot-to-bot loop prevention.
- Session context with 30-min expiry, follow-up resolution, cleanup.
- Dashboard Telegram Control tab with command registry viewer, intent tester, audit log, rate limit stats.
- 11 test files with all tests passing (227+ assertions).
- Phase 44.5 rules added to AGENTS.md.

### What Is Unfinished
- Runtime wiring into telebot.js / legacy-runtime.js (command dispatch, classification hooks).
- Natural command integration with Evaluation v2, executor, and improvement engine.
- Natural intent → command routing in production flow.
- Integration testing with real Telegram API on Render.

### Tests Run
| Test | Result |
|------|--------|
| `node --check telebot.js` | PASS |

### Remaining Risks
- Runtime not yet wired; Telegram Control modules are standalone and not connected to telebot.js or legacy-runtime.js.
- Wiring would require updating ~3 dispatch/classification points in legacy-runtime.js.
- In-memory audit log resets on restart (acceptable per Phase 44.5 scope).
- No Postgres-backed persistence for audit, sessions, or rate-limit counters.

### Next Safe Task
```
1. Wire Telegram Control Layer into telebot.js message handler.
2. Wire natural intent classification into legacy-runtime.js router.
3. Run full test suite from TESTING.md.
4. Deploy to Render and verify Telegram commands end-to-end.
```

### Recommended Next Branch/Commit
Commit message: `telegram: add universal control layer`

---

### Agent
OpenCode / Hermes

### Date
2026-06-09

### Current Task
Phase 47 — Unified Governance Policy Engine + Capability Control Center

### Files Changed
**New Files (src/governance/):**
- `governance-policy-store.js` — central safety rules, approval flow
- `capability-registry.js` — 54 capabilities across 27 modules
- `capability-contracts.js` — contracts for GitHub, Deploy, Gmail, Calendar, Webhook, etc.
- `unified-permission-engine.js` — role resolution (owner/admin/user)
- `unified-risk-engine.js` — risk levels read_only → blocked, danger patterns
- `unified-secret-guard.js` — 21 secret patterns, redaction, block logic
- `unified-approval-policy.js` — approval requirement determination
- `unified-evaluation-policy.js` — Evaluation v2 gate requirements
- `unified-cost-policy.js` — cost estimation and guard (soft failure if cost module missing)
- `action-policy-simulator.js` — simulateActionPolicy, simulateTelegramCommand, simulateNaturalIntent
- `governance-decision-engine.js` — evaluate, enforce, explain decisions
- `governance-audit.js` — record, list, summarize audit events
- `governance-utils.js` — sanitization, formatting helpers
- `index.js` — updated to export all new modules

**New Files (src/dashboard/):**
- `governance-routes.js` — 9 API endpoints for governance dashboard

**New File (public/dashboard/):**
- `governance.js` — Governance tab with capability registry, simulator, secret scan, audit, blocked actions

**New Docs:**
- `docs/UNIFIED_GOVERNANCE_POLICY_ENGINE.md`
- `docs/CAPABILITY_CONTRACTS.md`
- `docs/ACTION_POLICY_SIMULATOR.md`
- `docs/GOVERNANCE_SECURITY.md`
- `docs/GOVERNANCE_DASHBOARD.md`

**New Test Files:**
- `scratch/test-capability-registry.js` — 20 PASS
- `scratch/test-capability-contracts.js` — 25 PASS
- `scratch/test-unified-permission-engine.js` — 20 PASS
- `scratch/test-unified-risk-engine.js` — 21 PASS
- `scratch/test-unified-secret-guard.js` — 20 PASS
- `scratch/test-unified-approval-policy.js` — 22 PASS
- `scratch/test-unified-evaluation-policy.js` — 21 PASS
- `scratch/test-unified-cost-policy.js` — 17 PASS
- `scratch/test-action-policy-simulator.js` — 26 PASS
- `scratch/test-governance-decision-engine.js` — 24 PASS
- `scratch/test-governance-dashboard-api.js` — 20 PASS
- `scratch/test-phase47-governance-regression.js` — 33 PASS

**Modified Files:**
- `src/governance/index.js` — exports all 12 new modules
- `src/dashboard/index.js` — added governanceRoutes
- `src/dashboard/dashboard-routes.js` — registers governance routes
- `public/dashboard/index.html` — added governance nav item + script
- `public/dashboard/state.js` — added governance tab with aliases

### What Was Completed
- Unified Governance Policy Engine with 12 core modules
- Capability registry with 54 capabilities across 27 modules
- Capability contracts for all risky systems (GitHub, Deploy, Gmail, Calendar, Webhook, Backup, etc.)
- Unified permission engine with owner/admin/user role resolution
- Unified risk engine with 6 risk levels and danger pattern detection
- Unified secret guard with 21 pattern types, redaction, and block logic
- Unified approval policy (read/dry-run direct, external_write/danger proposal-only)
- Unified Evaluation v2 policy for all risky actions
- Unified cost policy (soft failures if cost module missing)
- Action policy simulator for actions, Telegram commands, natural language intents
- Governance decision engine (evaluate, enforce, explain)
- Governance audit with sanitization
- Dashboard Governance tab with capability registry, simulator, secret scan, audit, blocked actions
- 12 test files with 269 total assertions (all PASS)
- 11 existing test files rerun (all PASS, some SKIPPED if missing)
- All quality gates passed (policy score 100%, permission 100%, secret guard 100%, approval boundary 100%, eval requirement 100%)

### What Is Unfinished
- Wire governance engine into Telegram Control Layer (/command handlers)
- Wire governance engine into Executor proposal flow
- Wire governance engine into Integrations/GitHubOps/Deploy
- Wire governance engine into Knowledge/LifeOS/Improvement memory writes
- Wire governance engine into Operating Loop decision points
- Wire governance engine into Evaluation Harness v2 cases
- Full end-to-end integration tests on Render

### Tests Run
| Test | Result |
|------|--------|
| `node --check telebot.js` | PASS |
| `test-capability-registry.js` | 20 PASS |
| `test-capability-contracts.js` | 25 PASS |
| `test-unified-permission-engine.js` | 20 PASS |
| `test-unified-risk-engine.js` | 21 PASS |
| `test-unified-secret-guard.js` | 20 PASS |
| `test-unified-approval-policy.js` | 22 PASS |
| `test-unified-evaluation-policy.js` | 21 PASS |
| `test-unified-cost-policy.js` | 17 PASS |
| `test-action-policy-simulator.js` | 26 PASS |
| `test-governance-decision-engine.js` | 24 PASS |
| `test-governance-dashboard-api.js` | 20 PASS |
| `test-phase47-governance-regression.js` | 33 PASS |
| `test-memory-safety-gate.js` | 15 PASS |
| `test-budget-guard.js` | 15 PASS |
| `test-executor-boundary-stable-release.js` | 10 PASS |
| `test-integration-gate-stable-release.js` | 12 PASS |
| `test-dashboard-route-consistency.js` | 9 PASS |
| `test-dashboard-router-registry.js` | 132 PASS |
| `test-dashboard-all-menu-routes.js` | 99 PASS |
| `test-dashboard-dark-form-ui.js` | 28 PASS |
| `test-natural-chat-stable-release.js` | 10 PASS |
| `test-file-analysis-leak.js` | PASS |
| `test-pwa-assets.js` | PASS |

### Remaining Risks
- Governance engine core modules work independently but not yet wired into runtime
- Runtime wiring would require changes to telegram-control, executor, integrations, etc.
- In-memory audit log resets on restart (acceptable per Phase 47 scope)
- No postgres-backed policy persistence

### Next Safe Task
```
1. Wire governance decision engine into Telegram Control Layer command handlers
2. Wire governance into Executor proposal/approval/run flow
3. Wire governance into Integrations/GitHubOps/Deploy modules
4. Wire governance into Knowledge/LifeOS/Improvement memory writes
5. Wire governance into Operating Loop
6. Add governance evaluation cases to Evaluation Harness v2
7. Deploy to Render and run full integration tests
```

### Recommended Next Branch/Commit
Commit message: `governance: add unified policy and capability control center`

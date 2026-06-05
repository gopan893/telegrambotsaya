# OPEN CODE INTEGRATION AUDIT

> Generated: 2026-06-06
> Repo: telegram-ai-level-tertinggi v2.0.0

---

## 1. PROJECT STRUCTURE

```
telegrambotsaya/
├── telebot.js                          # Entry point → src/bot
├── start-local.js                      # Dev entry with .env loader
├── package.json                        # CommonJS, Node >=20
├── config/
│   └── env.js                          # Env reader + validator
├── core/
│   ├── logger.js, circuit-breaker.js, keyed-queue.js, ttl-map.js
├── utils/
│   └── retry.js
├── handlers/                           # Minimal (learning.js)
├── services/
│   └── ai-router.js                    # Minimal
├── storage/
│   ├── storage-manager.js              # Primary storage orchestrator
│   ├── database.js, migrations.js, schema.js
│   ├── postgres-store.js, postgres-repositories/
│   ├── json-repositories.js, redis-store.js
├── src/
│   ├── bot/                            # Bot server, webhook, message/command routing
│   ├── agents/                         # Agent router, council, evaluation, memory, etc.
│   │   ├── eval/                       # Evaluation v2 suite
│   ├── executor/                       # Execution planner, approval, runner
│   ├── integrations/                   # Integration evaluation gate, connectors
│   │   └── connectors/                 # External connectors
│   ├── coding/                         # Coding workspace, codex, github proposals
│   ├── dashboard/                      # All dashboard API route files
│   ├── workspace/                      # Workspace store/guards/permissions
│   ├── planner/                        # Planning engine
│   ├── tools/                          # Tool registry & governance
│   ├── routines/                       # Routine registry, scheduler, runner
│   ├── selfhealing/                    # Health guards, repair plans
│   ├── autohealing/                    # L1/L2/L3 automatic healing
│   ├── monitoring/                     # WebSocket, event bus, metrics
│   ├── cicd/                           # CI/CD quality gates, proposals
│   ├── ops/                            # Ops system (25 modules)
│   ├── ai-os/                          # AI OS core (30 modules)
│   ├── multibot/                       # Multi-bot config & identity
│   ├── action/                         # Action executor
│   ├── adaptive/                       # Adaptive routing
│   ├── backup/                         # Backup engine
│   ├── collaboration/                  # Collaboration MVP
│   ├── conversation/                   # Conversation bus
│   ├── governance/                     # Governance
│   ├── intent/                         # Intent detection
│   ├── interactions/                   # Interaction manager
│   ├── learning/                       # Learning engine
│   ├── memory/                         # Memory module
│   ├── multimodal/                     # Multi-modal processing
│   ├── natural-language/               # NLU
│   ├── planner/                        # Planner engine
│   ├── planning/                       # Planning engine
│   ├── ux/                             # UX utilities
│   └── utils/                          # Misc utils
├── public/
│   └── dashboard/                      # Vanilla frontend (PWA)
│       ├── index.html                  # Single-page app shell
│       ├── app.js                      # Core router
│       ├── state.js                    # Tab registry (DASHBOARD_TABS)
│       ├── ui.js                       # All tab renderers
│       ├── api.js                      # API client
│       ├── auth.js                     # Auth handler
│       ├── service-worker.js           # PWA service worker
│       ├── styles.css                  # Dark theme
│       ├── mobile.css                  # Responsive
│       ├── utils.js, charts.js, graph.js
│       ├── cicd.js, realtime-monitoring.js
│       └── pwa.js, export.js, downloads.js, import-ui.js
├── scratch/                            # 145 test files
├── docs/                               # 71 documentation files
└── .github/workflows/                  # CI/CD workflows
```

---

## 2. ENTRY POINTS

| File | Role |
|---|---|
| `telebot.js` | Production entry (require + call `startBotServer`) |
| `start-local.js` | Dev entry (load .env, then call `startBotServer`) |
| `src/bot/index.js` | Re-exports `createBotApp`, `startBotServer` |
| `src/bot/app.js` | Creates Express app, bot context, registers webhook |

Environment required: `TELEGRAM_TOKEN` (or `TELEGRAM_TOKEN_ORCHESTRATOR`), plus `MISTRAL_API_KEY` or `GROQ_API_KEY`.

---

## 3. ALL MODULES (by src/)

| Directory | Module Count | Role |
|---|---|---|
| agents/ | 78 | Agent router, council, eval, memory, tasks, decisions, etc. |
| ai-os/ | 30 | Cognitive core, knowledge graph, goals, workflows |
| dashboard/ | 32 | All API route handlers |
| ops/ | 25 | Ops system, diagnostics, benchmarks |
| coding/ | 13 | Coding workspace, codex, github |
| selfhealing/ | 13 | Health guards, repair plans |
| routines/ | 11 | Routine engine |
| tools/ | 9 | Tool registry |
| executor/ | 8 | Execution engine |
| multibot/ | 7 | Multi-bot |
| monitoring/ | 7 | WebSocket, events |
| cicd/ | 7 | CI/CD |
| workspace/ | 5 | Workspace |
| autohealing/ | 9 | Auto-healing (L1/L2/L3) |
| storage/ | 9 | Storage abstraction |
| bot/ | 11 | Bot server |

---

## 4. DASHBOARD TABS (state.js registry)

| Tab ID | Label | Renderer | API Route Backend | Status |
|---|---|---|---|---|
| overview | System Overview | `renderOverview` | `/api/dashboard/health` + `/summary` | ✅ Fully working |
| ops | Ops Viewer | `renderOps` | `/api/dashboard/ops` | ✅ Working |
| workspaces | Workspaces | `renderWorkspaces` (placeholder) | `/api/dashboard/workspaces` | ⚠️ Placeholder only |
| users | Users | `renderUsers` (placeholder) | `/api/dashboard/users` | ⚠️ Placeholder only |
| permissions | Permissions | `renderPermissions` (placeholder) | `/api/dashboard/permissions/me` | ⚠️ Placeholder only |
| memory | Memory Records | `renderMemory` | `/api/dashboard/user/:id/memories` | ✅ Working |
| goals | Goals | `renderGoals` | `/api/dashboard/user/:id/goals` | ✅ Working |
| workflows | Workflows | `renderWorkflows` | `/api/dashboard/user/:id/workflows` | ✅ Working |
| planner | Planner | `renderPlanner` (placeholder) | `/api/dashboard/planner` | ⚠️ Placeholder (API exists) |
| executor | Executor | `renderExecutor` (placeholder) | `/api/dashboard/executor` | ⚠️ Placeholder (API exists) |
| agents | Agents | `renderAgents` | `/api/dashboard/agents`, `/bots`, etc. | ✅ Working (static) |
| tools | Tools | `renderTools` (placeholder) | `/api/dashboard/tools` | ⚠️ Placeholder (API exists) |
| integrations | Integrations | `renderIntegrations` | `/api/dashboard/integrations/...` | ✅ Working (static) |
| backup | Backup & Recovery | `renderBackup` (placeholder) | `/api/dashboard/backup` | ⚠️ Placeholder (API exists) |
| insights | Cognitive Insights | `renderInsights` | `/api/dashboard/user/:id/insights` | ✅ Working |
| graph | Knowledge Graph | `renderGraph` | `/api/dashboard/user/:id/graph` | ✅ Working |
| benchmarks | Benchmarks Audit | `renderBenchmarks` | `/api/dashboard/benchmarks` | ✅ Working |
| incidents | Incidents Log | `renderIncidents` | `/api/dashboard/incidents` | ✅ Working |
| audit | Audit Log | `renderAuditLog` (placeholder) | `/api/dashboard/audit` | ⚠️ Placeholder (API exists) |
| commands | Command Catalog | `renderCommands` | `/api/dashboard/commands` | ✅ Working |
| env | Env Check | `renderEnv` | `/api/dashboard/env-check` | ✅ Working |
| settings | Settings Control | `renderSettings` | none (client-only) | ✅ Working |
| agent-evaluation | Agent Evaluation | `renderAgentEvaluation` | `/api/dashboard/agent-evaluation` | ⚠️ Placeholder (API exists) |
| coding | Coding Workspace | `renderCodingWorkspace` | `/api/dashboard/coding-workspace` | ✅ Working (static) |
| release | Release / Health | `renderRelease` | `/api/dashboard/health` + `/summary` | ✅ Working |
| routines | Routine Center | `renderRoutines` | `/api/dashboard/routines` (NOT REGISTERED) | 🔴 BROKEN |
| selfhealing | Self-Healing | `renderSelfHealing` | `/api/dashboard/selfhealing` | 🔴 BROKEN (uses `Api.get()`) |
| monitoring | Real-Time Monitoring | `renderMonitoring` | `/api/dashboard/monitoring/snapshot` | 🔴 BROKEN (uses `Api.get()`) |
| cicd | CI/CD Pipeline | `renderCicd` | `/api/dashboard/cicd/status` | 🔴 BROKEN (uses `Api.get()`) |

---

## 5. API ROUTES (Backend)

All mounted under `/api/dashboard`. See `dashboard-routes.js` for full registration.

### Registered routes:
- `GET /health` (no auth)
- `GET /summary`, `/storage`, `/ops`, `/reliability`, `/benchmarks`, `/incidents`
- `GET /commands`, `/env-check`, `/audit`
- `GET /user/:userId/overview`, `/memories`, `/goals`, `/workflows`, `/insights`, `/graph`, `/graph/search`
- `GET/POST /workspaces/*`, `/planner/*`, `/executor/*`, `/tools/*`
- `GET/POST /backup/*`, `/pwa/*`, `/agent-memory/*`, `/council/*`, `/agents/*`
- `GET/POST /agent-tasks/*`, `/decisions/*`, `/agent-executor/*`, `/agent-evaluation/*`
- `GET/POST /integrations/*`
- `GET/POST /selfhealing/*` (conditional on `services.selfHealingSystem`)
- `GET/POST /monitoring/*` (conditional on `services.monitoringSystem`)
- `GET/POST /cicd/*` (conditional on `services.cicdSystem`)
- `POST /actions/*` (various safe actions)

### NOT REGISTERED:
- `/routines` — routine-routes.js exists in src/dashboard/ but is NOT imported in dashboard-routes.js or dashboard/index.js

---

## 6. TELEGRAM COMMANDS

Command routing in `command-router.js` is minimal:
- `/start`, `/help` — hardcoded responses
- All other commands → delegated to `legacyAdapter.handleCommand`

The legacy runtime handles the full command set. This is a transitional design.

---

## 7. TEST FILES (scratch/)

145 test files found. Naming convention: `test-<module>.js`.

---

## 8. DUPLICATE MODULES

| Module | Duplicate | Notes |
|---|---|---|
| `src/selfhealing/` | `src/autohealing/` | Overlapping healing concerns. Canonical: `selfhealing/` (guards + plans). `autohealing/` = L1/L2/L3 automatic actions. |
| `src/planner/` | `src/planning/` | Two directories for planning. Likely `planner/` is canonical. |
| `src/agents/eval/` | `src/agents/agent-evaluation-harness.js` | Eval v2 is in `eval/`, original evaluation harness in `agent-evaluation-harness.js`. |
| `docs/` + `scratch/` | Overlapping test docs | Many test files in `scratch/` duplicate docs test descriptions. |

---

## 9. UNUSED / ORPHANED MODULES

| File | Notes |
|---|---|
| `src/dashboard/routine-routes.js` | Exists but NOT imported anywhere — routines API is dead code |
| `src/agents/agent-opinion-collector.js` | Not exported in `agents/index.js` |
| `handlers/learning.js` | Minimal, not referenced from bot flow |
| `services/ai-router.js` | Minimal, not referenced from bot flow |
| `src/action/action-executor.js` | Not imported in any route or module |

---

## 10. BROKEN IMPORT/REQUIRE

All imports verified during scan. No broken `require()` paths found in the audit scope. Potential risks:
- `dashboard-routes.js` requires `../workspace` — confirmed exists
- `dashboard-routes.js` requires `./coding-workspace-routes` via getter — exists
- All sub-route files require `../routines`, `../coding`, etc. — confirmed

---

## 11. FRONTEND ROUTE WITHOUT BACKEND (BROKEN)

| Frontend Call | Expected Backend | Actual | Severity |
|---|---|---|---|
| `renderRoutines()`: `Api.apiGet('/routines')` | `/api/dashboard/routines` | NOT REGISTERED | 🔴 CRITICAL |
| `renderSelfHealing()`: `Api.get('/api/dashboard/selfhealing')` | `/api/dashboard/api/dashboard/selfhealing` | `Api.get()` is not a function | 🔴 CRITICAL |
| `renderMonitoring()`: `Api.get('/api/dashboard/monitoring/snapshot')` | same | same | 🔴 CRITICAL |
| `renderCicd()`: `Api.get('/api/dashboard/cicd/status')` | same | same | 🔴 CRITICAL |
| `renderSelfHealing()`: `Api.post('/api/dashboard/selfhealing/run')` | same | same | 🔴 CRITICAL |
| `renderCicd()`: `Api.post('/api/dashboard/cicd/quality-check')` | same | same | 🔴 CRITICAL |

---

## 12. BACKEND ROUTE WITHOUT FRONTEND

All backend routes have at least a placeholder in ui.js. No route is completely orphaned.

---

## 13. DASHBOARD TABS FALLING BACK TO OVERVIEW

The `app.js` router correctly uses `DashboardState.getTabConfig(tabId)` to check if a tab exists. If `getTabConfig` returns `null`, it falls back to `UI.renderOverview`. The `renderTabContent` function (app.js line 81-122) correctly:
- Looks up config via `DashboardState.getTabConfig(tabId)`
- Falls back to `UI.renderOverview` only if config is null
- For known tabs with missing renderers, shows placeholder instead of overview

**No tabs should incorrectly fall back to Overview** as long as the DASHBOARD_TABS registry is complete and the `getTabConfig` lookup works.

However, the broken tabs (selfhealing, monitoring, cicd) will crash during render and show an error state, not an overview fallback. The routines tab will get a 404 from the API and show an error state.

---

## 14. FEATURES WITHOUT TESTS

Almost all features have test files in `scratch/`. However, some features lack integration tests:
- `src/autohealing/` — no direct test file (covered by selfhealing tests)
- `src/action/action-executor.js` — no direct test

---

## CRITICAL ERRORS (Phase 2)

### 🔴 P0-1: `Api.get()` / `Api.post()` don't exist

**File**: `public/dashboard/ui.js` lines 1826, 1869, 1891, 1913, 1968, 2018

**Problem**: The `Api` object in `api.js` only defines `apiGet()` and `apiPost()` methods. But `renderSelfHealing`, `renderMonitoring`, and `renderCicd` in `ui.js` use `Api.get()` and `Api.post()`, which are undefined functions. Additionally, they prefix paths with `/api/dashboard/`, but `api.js` already prepends `/api/dashboard` to all requests, resulting in double-prefixed paths like `/api/dashboard/api/dashboard/selfhealing`.

**Impact**: Three tabs crash on load (Self-Healing, Monitoring, CI/CD). Two additional button handlers crash (run-all-checks, run-p0-checks, quality-check).

**Fix**: Change `Api.get(...)` → `Api.apiGet(...)`, `Api.post(...)` → `Api.apiPost(...)`, remove `/api/dashboard` prefix from paths.

### 🔴 P0-2: Routine routes not registered

**File**: `src/dashboard/dashboard-routes.js`, `src/dashboard/index.js`

**Problem**: `routine-routes.js` exists but is never imported or registered. The `renderRoutines()` frontend calls `Api.apiGet('/routines')` which will 404.

**Impact**: Routines tab always shows error state.

**Fix**: Import `routine-routes.js` and register route in `dashboard-routes.js`.

### 🔴 P0-3: Service worker missing scripts

**File**: `public/dashboard/service-worker.js`

**Problem**: `realtime-monitoring.js` and `cicd.js` are referenced in `index.html` but not in `STATIC_ASSETS`. Offline PWA won't have these scripts.

**Impact**: Offline mode may break monitoring and CI/CD tab renderers.

**Fix**: Add missing scripts to `STATIC_ASSETS`.

---

## RECOMMENDED PATCH ORDER

1. **P0-1**: Fix `ui.js` — `Api.get()`/`Api.post()` → `Api.apiGet()`/`Api.apiPost()`, fix paths
2. **P0-2**: Register `routine-routes.js` in dashboard
3. **P0-3**: Add missing scripts to service worker STATIC_ASSETS
4. **Medium**: Document `selfhealing/` vs `autohealing/` canonical

---

## DASHBOARD ROUTER FIX STATUS

| Requirement | Status |
|---|---|
| Known tabs defined in DASHBOARD_TABS | ✅ Complete (29 tabs) |
| Known tab render page themselves | ✅ Partial (some are placeholders) |
| Known tabs do not fall back to Overview | ✅ Correctly implemented |
| Refresh on #tab stays on that tab | ✅ `setActiveTab` saves to localStorage |
| localStorage lastTab preserved | ✅ `restoreLastTab()` validates against registry |
| Mobile menu uses same tab IDs | ✅ Same nav items |

---

## SECURITY STATUS

| Requirement | Status |
|---|---|
| No secret leakage in API responses | ✅ Serializers use `preventSecretLeak` |
| Dashboard auth requires token | ✅ Bearer token check |
| Env check redacts values | ✅ Returns only "set" / "missing" |
| Service worker does not cache API | ✅ `isSensitiveRequest` blocks `/api/dashboard` |
| Executor approval/run separated | ✅ Architecture confirmed |
| Integration evaluation v2 gate | ✅ Implemented |
| No shell executor | ✅ Confirmed absent |

---

*End of audit — proceed to Phase 3 for P0 patches.*

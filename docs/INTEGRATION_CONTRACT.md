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
## Phase 43 Research / Docs Contract

Research Agent:

- May create research tasks, collect read-only sources, score credibility/freshness, extract evidence, and summarize findings.
- Must not store raw secret-like input.
- Must mark missing source data as unknown/gap.
- Must not fabricate citations.

Documentation Agent:

- May generate draft docs, update plans, and Codex/OpenCode/Hermes prompts.
- Must not write repository files directly from Telegram/runtime.
- Must send write/external actions through Evaluation v2 + executor approval.

Dashboard contract:

- `#research` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/research/*` routes are protected and sanitized.
- Service worker may cache `research.js` as static shell only; it must not cache `/api/dashboard/*`.

## Phase 44 Life OS Contract

Life OS may:

- create daily/weekly plans, personal tasks, habits, reminders, focus sessions, mood/energy notes, personal goals, and safe life memory.
- recommend project-life balance and small next actions.
- create Calendar/Gmail/routine proposals.

Life OS must not:

- send Gmail directly.
- create/update Calendar events directly.
- run external/write/danger actions without Evaluation v2 and executor approval.
- store raw secret-like personal data.
- expose private mood/energy context in shared dashboard/API/Telegram output.

Dashboard contract:

- `#lifeos` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/lifeos/*` routes are protected and sanitized.
- Service worker may cache `lifeos.js` as static shell only; it must not cache `/api/dashboard/*`.

## Phase 44.5 Universal Telegram Control Layer Contract

Telegram Control Layer:

1. All Telegram commands MUST be registered in `src/telegram-control/telegram-command-registry.js` before use.
2. Natural language messages are classified via `telegram-intent-classifier.js` with 50+ patterns.
3. Permission guard checks owner/admin/workspace before allowing command execution.
4. Risk classifier (read_only/danger) determines if proposal flow or evaluation gate is required.
5. High-risk and danger commands MUST go through: classification → command lookup → risk classification → proposal → Evaluation v2 → approval → execution.
6. Read-only commands may run directly if permission permits.
7. Secret patterns in messages are detected and blocked before processing.
8. Bot-to-bot loops are prevented by ignoring bot messages unless explicitly allowed.
9. Rate limiting prevents spam (10/min default, 1/2min for danger).
10. Audit log records all Telegram command activity.
11. Session context supports short follow-ups within 30-minute windows.

Dashboard contract:

- `#telegram-control` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/telegram-control/*` routes are protected and sanitized.
- Service worker may cache `telegram-control.js` as static shell only; it must not cache `/api/dashboard/*`.
- No secret values are exposed in the dashboard, audit, or API responses.

## Improvement / Feedback Contract (Phase 46)

Feedback/improvement flow MUST follow:
1. collect feedback / outcome
2. classify quality signal
3. detect weakness
4. analyze patterns
5. create lesson or improvement plan
6. improvement evaluation gate (no auto-run, no auto-approve, no direct external write)
7. if code change needed → executor proposal → approval → run
8. no self-modification from runtime
9. no secret storage in feedback/outcome/lessons
10. no auto-create test files from runtime

Improvement actions are read-only by default.
Code changes require the full dry-run → Evaluation v2 → executor proposal → approval → run pipeline.

## Security / Hardening Contract (Phase 48)

Security audit flow MUST follow:
1. Audit triggered (manual, scheduled, or on-demand).
2. Secret scanner checks surfaces (audit logs, memory, proposals, docs, etc.).
3. Findings classified and redacted — no raw secrets in any output.
4. Env drift detector checks expected env names vs current status (names only, never values).
5. Permission auditor checks owner/admin/workspace roles.
6. Capability risk auditor checks dangerous capabilities against governance registry.
7. Approval bypass auditor validates all external/write/danger paths are blocked.
8. Red-team simulator runs attack cases (prompt injection, secret exfiltration, etc.).
9. Security scorecard calculated from all audit results.
10. Rotation plans are manual checklists only — no automatic credential rotation.
11. Repair proposals require Evaluation v2 + executor approval before execution.

Dashboard contract:
- `#security` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/security/*` routes are protected and sanitized.
- No secret values are exposed in security dashboard, findings, reports, or scorecard.
- Credential rotation plans display system names and manual steps only — no secret values.

## Release Candidate Contract (Phase 50)

Release Candidate management follows:

1. Create RC → v1.0.0-rc.1 default version.
2. Start release freeze — blocks new major features.
3. Run module readiness check — 30 modules checked.
4. Run production readiness gate — 9 gates (boot, dashboard, telegram, storage, governance, security, privacy, deploy, blockers).
5. Run compatibility verification — 6 areas (dashboard, telegram, executor, integration, storage, PWA).
6. Review release risks — 6 categories (security, privacy, deploy, cost, operational, integration).
7. Generate release notes, changelog, env checklist, operator guide.
8. Create release proposals (action plan, GitHub tag/release, deploy).
9. All proposals are proposal-only — no direct GitHub/render/deploy writes.
10. All write/external/danger actions require Evaluation v2 + executor approval.
11. No auto-approve, no auto-run, no secret leakage.
12. Release gates: readiness >= 90%, security >= 95%, privacy >= 95%, approval boundary = 100%, dashboard route = 100%.

Dashboard contract:
- `#release-candidate` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/release-candidate/*` routes are protected and sanitized.
- No secret values are exposed in RC dashboard, reports, or API responses.
- Service worker may cache `release-candidate.js` as static shell only; must not cache `/api/dashboard/*`.

## Privacy / Data Retention Contract (Phase 49)

Privacy data flow MUST follow:
1. Data inventory scan catalogs all 24 data categories across modules.
2. Classification engine marks sensitivity (public/internal/private/sensitive/secret_blocked).
3. Privacy policy determines role-based access (owner/admin/user).
4. Life OS mood/energy data is owner-only; coding agents blocked by default.
5. Retention policy defines how long each category is kept (session: 30d, audit: 180d, mood: 90d, etc.).
6. Export requests use strict redaction — no raw secrets, tokens, env values ever exported.
7. Archive plans prefer archive over delete; bulk archive requires proposal.
8. Delete requests are soft-delete only by default; hard delete requires owner + explicit approval.
9. All export/archive/delete actions must go through dry-run → Evaluation v2 → executor proposal → approval → run.
10. Privacy audit records all inventory scans, policy changes, export/archive/delete requests, and access denials.

Dashboard contract:
- `#privacy` is a known dashboard tab and must not fallback to Overview.
- `/api/dashboard/privacy/*` routes are protected and sanitized.
- No raw secrets, env values, or sensitive personal data are displayed.
- Export manifests show metadata only — never raw record values.
- Delete requests default to soft delete; no direct hard delete button in UI.
- Known tab must not fallback to Overview.

## Phase 50.5 — RC Stabilization Audit

- `RcStabilizationAuditor.runRcStabilizationAudit(services)` — runs full stabilization audit
- `RcBlockerClassifier.classifyRcFinding(finding)` — classifies P0/P1/P2/P3
- `RcRegressionChecker` has 10 check functions
- `RcFixPolicy.evaluateRcFixAllowed(change)` — enforces stabilization freeze
- `RcStabilizationReportGenerator.generateStabilizationReport()` — produces report
- All stabilization checks are read-only; no external write capability

# AGENTS.md

## Project Rules

Project: Telegram AI OS.

Runtime:
- Node.js 20
- CommonJS only
- Express webhook
- Vanilla HTML/CSS/JS dashboard
- PostgreSQL primary
- Redis optional/fallback

Forbidden:
- No TypeScript
- No React/Next/Vue
- No large refactor
- No shell executor
- No direct GitHub/email/calendar/webhook write
- No direct repo mutation from bot runtime
- No auto-approve
- No auto-run write/external/danger actions
- No secret/token/env exposure

Security:
Never print/log values from:
- TELEGRAM_TOKEN
- DATABASE_URL
- REDIS_URL
- DASHBOARD_ADMIN_TOKEN
- API keys
- GITHUB_TOKEN
- GOOGLE_CLIENT_SECRET
- CLOUDFLARE_API_TOKEN

Redact secrets as:
[REDACTED_SECRET]

Approval rules:
Write/external/danger actions must go through:

dry-run
→ Evaluation v2
→ executor proposal
→ approval
→ run

Proposal creation must not execute action.
/approve only approves.
/runexec only runs approved proposal.

Dashboard rules:
- Known tabs must not fallback to System Overview.
- Unknown tabs may fallback to Overview.
- Service worker must not cache /api/dashboard/*.
- input/select/textarea must use dark UI.

Known dashboard tabs:
overview, ops-viewer, workspaces, users, permissions, memory,
goals, workflows, planner, executor, agents, tools, integrations,
backup, insights, observability, agent-evaluation, coding-workspace, release,
routines, selfhealing, monitoring, cicd, devgovernance, githubops,
deploy, cost, operator, portfolio, knowledge, telegram-control, improvement, governance, security, privacy, release-candidate,
docs-intel, model-router, plugins, rag-kb, recipes.

Agent routing rules:
- Personal/school/emotional chat → orchestrator/reflection.
- Coding/error/deploy chat → coder/ops/critic.
- Restore/delete/secret/external write → security/executor.
- Short follow-up must use replied message or latest relevant context.
- No stale file-analysis note in normal chat.

Handoff rule:
- Before finishing work, update AGENT_HANDOFF.md with completed/unfinished items.
- If token expires mid-task, next agent must run recovery handoff via /handoff.
- Do not claim tests pass if not run. Report SKIPPED honestly.

Integration rule:
Before creating/editing feature, inspect existing modules first.
Do not duplicate systems.
Reuse existing modules when possible.
If new module is necessary, connect it to entry point or route, dashboard/frontend, API client, test file, and handoff.
If two modules overlap, pick one canonical and document the other.

Module creation check:
Before creating any new file/module:
1. Search existing modules in src/ for similar functionality.
2. If similar module exists, reuse/extend it — do NOT duplicate.
3. Only create new module if no suitable existing module found.
4. Connect new module to entry point, dashboard, tests, and docs.

Testing rule:
Always run:
- node --check telebot.js

Run existing related scratch tests.
If test file is missing, report SKIPPED honestly.
Do not invent passing results.

Phase 37 observability rule:
- Production incident repair/rollback must remain proposal-only.
- Incident flow is health check → classify → timeline/root cause → response plan → Evaluation v2 → executor proposal → approval → run.
- No direct repair/rollback/deploy from dashboard, Telegram, or runtime.

Phase 41 portfolio rule:
- Portfolio ranking/report/weekly/monthly plan must remain read-only.
- Portfolio push/deploy/write/external actions must become Evaluation v2 gated executor proposals.
- No direct GitHub push, workflow dispatch, Render deploy, rollback, shell, or repo mutation from runtime.

Phase 43 research/docs rule:
- Research must separate facts, assumptions, unknowns/gaps, and recommendations.
- Prefer local project docs and Knowledge Graph before optional external search.
- Do not store raw secrets in research notes, docs drafts, reports, or Knowledge Graph.
- Documentation Agent may generate drafts/update plans/proposals only.
- No direct docs file write, commit, push, or external write from runtime.
- Docs update flow must remain dry-run → Evaluation v2 → executor proposal → approval → run.

Phase 44.5 Telegram Control rule:
- Universal Telegram Control Layer manages all Telegram command routing, natural language classification, permission checks, risk classification, proposal routing, and response formatting.
- All Telegram commands must be registered in the command registry before use.
- Natural language messages are classified into intents and mapped to safe commands only.
- Secret patterns in messages are detected and blocked before processing.
- Write/external/danger actions must go through proposal flow only.
- No direct execution of high-risk or danger commands without approval and evaluation.
- Bot-to-bot loops are prevented by ignoring bot messages unless explicitly allowed.
- Rate limiting prevents spam and abuse.
- Session context supports short follow-ups within 30-minute windows.
- Dashboard Telegram Control tab provides command registry, audit, and intent testing.

Phase 44 Life OS rule:
- Life OS may create daily/weekly plans, personal tasks, habits, reminders, focus sessions, mood/energy notes, personal goals, and safe personal memory.
- Mood/energy notes are private by default and must not be treated as diagnosis.
- Calendar/Gmail/routine/external actions are proposal-only.
- No direct Gmail send, Calendar mutation, auto-approve, or auto-run.
- Secret-like personal input must be rejected/redacted and must not be stored in docs, audit, dashboard, or Knowledge Graph.

Phase 46 Continuous Improvement rule:
- Continuous improvement only creates lessons, reports, test suggestions, improvement plans, and proposals.
- No self-modify code from runtime.
- Feedback/outcome/weakness/lesson storage must sanitize secrets.
- Regression case generation does NOT auto-create test files.
- Improvement plans requiring code changes must go through Evaluation v2 + executor proposal + approval.

Phase 48 Security Hardening rule:
- Security audit modules scan for secret leakage, env drift, permission issues, capability risks, and approval bypass paths.
- Secret surface scanner must never display raw secret values — only redacted samples.
- Credential rotation planner creates manual checklists only — no automatic rotation.
- Red-team simulator evaluates prompt injection, approval bypass, secret exfiltration, and other attack vectors.
- Prompt injection tester detects 16+ injection patterns and returns defense responses.
- Security scorecard calculates 6 sub-scores (secret, env, permission, capability, approval safety, red-team).
- Security reports and findings must never contain raw env/secret values.
- All security proposals require Evaluation v2 + executor approval before any write/external/danger action.
- Security audit runs are in-memory (acceptable for Phase 48; Postgres persistence deferred).
- Security dashboard tab must not fallback to System Overview.

Phase 49 Privacy & Data Retention rule:
- Data inventory scanner catalogs 24 data categories across all modules.
- Data classification engine marks Life OS mood/energy as private/sensitive and owner-only.
- Privacy policy engine restricts access by role (owner/admin/user) and blocks coding agents from private Life OS notes.
- Retention policy manager defines retention periods (session: 30d, audit: 180d, mood: 90d, etc.) — archive preferred.
- Privacy access guard enforces owner-only for sensitive data, blocks hard delete for audit/security logs.
- Export control manager enforces strict redaction — never export raw tokens, secrets, API keys, or env values.
- Archive/delete requests require proposal + approval — no direct hard delete.
- Privacy audit records all privacy events (inventory, policy changes, export, archive, delete).
- All privacy-sensitive write/export/delete actions must go through dry-run → Evaluation v2 → executor proposal → approval → run.
- Privacy dashboard tab must not fallback to System Overview.

Phase 50.5 RC Stabilization rule:
- Run RC stabilization audit before Phase 51 production release.
- Only P0/P1 fixes allowed during stabilization freeze.
- No new large features, no shell executor, no new external write capability, no direct deploy/push/release.
- RC stabilization auditor checks boot, dashboard, telegram, executor, governance, security, privacy, docs, and artifacts.
- RC blocker classifier assigns P0 (release blocker), P1 (must fix), P2 (known limitation), P3 (backlog).
- RC regression checker verifies dashboard registry, sidebar, renderer, PWA cache, Telegram commands, approval boundary, secret redaction, privacy export.
- RC fix policy enforces stabilization freeze — only P0/P1 fixes and docs/tests updates allowed.
- RC stabilization report generator produces readiness scoring and Phase 51 recommendation.

Phase 53-54 Research & Documentation Intelligence rule:
- Research Agent may create research tasks, collect read-only sources, classify intent (api_research, ai_model_research, cost_comparison, etc.), score source quality, build notes, generate comparison matrices, create implementation notes, review risks, generate next-agent prompts (Codex/OpenCode/Hermes), and create action plans.
- Documentation Intelligence may scan project docs inventory, detect gaps, review freshness, check command documentation coverage, and create update plans.
- All research/docs operations are read-only by default.
- Docs/code updates require Evaluation v2 + executor approval.
- No direct file write from runtime.
- No secrets stored in research notes, source registry, comparison matrices, implementation notes, prompts, or proposals.
- Research sensitivity detection marks Life OS data as high sensitivity.

Phase 53-54 Hybrid Model Router rule:
- Model Router may classify tasks (simple_chat, coding_light/heavy, research, private_lifeos, etc.), evaluate privacy/cost routing policies, select local/cloud providers, manage fallback chains, check provider health, run smoke benchmarks, and audit routing decisions.
- Local model preferred for private/simple/offline-safe tasks.
- Cloud model allowed for heavy coding/reasoning/research after secret redaction.
- Private Life OS data blocked from cloud routing unless explicitly owner-approved.
- High-cost routes require approval.
- No API key values exposed in any output.
- Local adapter fails softly on connection errors.
- Routing audit never logs secrets or private prompts.

Phase 55-57 Plugin/Connector SDK rule:
- Plugin SDK manages install, enable, disable, uninstall lifecycle via plugin-store, plugin-installer, plugin-lifecycle-manager.
- Plugin validator checks manifest fields (id, name, version, main) and type (module/middleware/hook/adapter/theme).
- Plugin sandbox restricts plugin access to allowed resources only; no direct filesystem or network access without permission.
- Connector registry provides 15+ built-in connector templates (HTTP webhook, Slack, Discord, GitHub, GitLab, Jira, Linear, Notion, Google Drive, etc.).
- Connector factory creates named instances with connect/disconnect lifecycle; connector health checker monitors status.
- Plugin permission engine enforces granular access per connector (none/read/write/admin).
- Plugin event bus supports pub/sub for inter-plugin communication.
- Plugin dependency resolver checks for missing deps and circular dependencies.
- Plugin marketplace client provides mock searchable marketplace with 5 sample plugins.
- Plugin config manager stores per-plugin config with schema validation.
- Plugin signing verifier provides checksum and signature verification.
- Plugin update checker compares installed vs marketplace versions.
- Connector rate limiter uses token bucket algorithm per connector.
- Plugin event bus, config, and log stores are in-memory (acceptable for Phase 55; Postgres persistence deferred).

Phase 55-57 RAG/Knowledge Base rule:
- RAG document store manages CRUD for text documents with tags, types, sources, and metadata.
- Document chunker supports paragraph, sentence, and token-based chunking strategies.
- Embedding service generates mock 128-dimension vectors with cosine similarity (pluggable to real embedding API).
- Vector index enables semantic search with configurable top-K results.
- Hybrid searcher combines vector similarity (70%) and keyword BM25-like scoring (30%).
- Context builder constructs LLM-ready context from top results with token budget enforcement.
- Filter engine supports tag, type, source, date range, and custom field filters.
- Source ranker incorporates recency and authority bonuses into ranking.
- Caching layer caches search results with configurable TTL (default 5 min).
- Query analyzer classifies intent (how_to, definition, troubleshooting, comparison, listing, code, general) and extracts key phrases.
- Relevance scorer scores documents by exact match and term density.
- Feedback loop records relevance feedback for future ranking improvement.
- All RAG stores are in-memory (acceptable for Phase 55; vector DB persistence deferred).

Phase 55-57 Automation Recipe Builder rule:
- Recipe store manages CRUD for automation recipes with trigger, conditions, actions, variables, tags, and parallel execution flag.
- Trigger registry provides 10 built-in triggers: manual, schedule (cron), webhook, file_change, memory_added, goal_completed, insight_generated, error_detected, health_degraded, external_event.
- Action registry provides 16 built-in actions: send_message, send_notification, create_memory, create_goal, update_goal, create_insight, log_event, run_health_check, trigger_workflow, run_research, export_data, call_connector, http_request, set_variable, condition_branch, delay.
- Condition engine supports 10 condition types: equals, contains, greater_than, less_than, regex, exists, boolean, and, or, not — with $variable resolution from context.
- Execution engine runs actions sequentially with retry (configurable maxRetries), timeout, and abort on failure.
- Template library provides 6 built-in recipe templates: daily_summary, weekly_review, error_alert, goal_milestone, weekly_health_check, webhook_data_ingest.
- Recipe validator checks name, trigger, actions, conditions, timeout, and maxRetries validity.
- Recipe scheduler manages cron-based scheduling with parse, pause, resume.
- Dry runner simulates recipe execution without side effects.
- Variable interpolator resolves $variable patterns from context and recipe variables.
- Rollback manager provides undo plan for reversible actions (create_memory, create_goal, create_insight have reversals).
- Parallel fork enables forking multiple actions in parallel with merge results.
- Recipe log manager stores execution logs with per-recipe filtering and stats.
- All recipe stores are in-memory (acceptable for Phase 55; Postgres persistence deferred).

Specific test files to run when relevant:
- scratch/test-dashboard-router-registry.js
- scratch/test-dashboard-all-menu-routes.js
- scratch/test-dashboard-dark-form-ui.js
- scratch/test-natural-chat-stable-release.js
- scratch/test-executor-boundary-stable-release.js
- scratch/test-integration-gate-stable-release.js
- scratch/test-coding-workspace-stable-release.js
- scratch/test-selfhealing-health-suite.js
- scratch/test-file-analysis-leak.js
- scratch/test-pwa-assets.js
- scratch/test-phase41-portfolio-regression.js
- scratch/test-research-task-planner.js
- scratch/test-research-dashboard-api.js
- scratch/test-phase43-research-regression.js
- scratch/test-daily-planner.js
- scratch/test-weekly-planner.js
- scratch/test-personal-task-manager.js
- scratch/test-habit-tracker.js
- scratch/test-reminder-planner.js
- scratch/test-focus-session-manager.js
- scratch/test-energy-mood-journal.js
- scratch/test-personal-goal-manager.js
- scratch/test-life-priority-engine.js
- scratch/test-life-memory-governance.js
- scratch/test-life-integration-proposal.js
- scratch/test-lifeos-dashboard-api.js
- scratch/test-phase44-lifeos-regression.js
- scratch/test-feedback-collector.js
- scratch/test-outcome-collector.js
- scratch/test-quality-signal-classifier.js
- scratch/test-weakness-detector.js
- scratch/test-pattern-analyzer.js
- scratch/test-lesson-manager.js
- scratch/test-regression-case-generator.js
- scratch/test-improvement-plan-generator.js
- scratch/test-next-agent-improvement-prompt.js
- scratch/test-improvement-evaluation-gate.js
- scratch/test-improvement-proposal-bridge.js
- scratch/test-improvement-dashboard-api.js
- scratch/test-phase46-improvement-regression.js
- scratch/test-capability-registry.js
- scratch/test-capability-contracts.js
- scratch/test-unified-permission-engine.js
- scratch/test-unified-risk-engine.js
- scratch/test-unified-secret-guard.js
- scratch/test-unified-approval-policy.js
- scratch/test-unified-evaluation-policy.js
- scratch/test-unified-cost-policy.js
- scratch/test-action-policy-simulator.js
- scratch/test-governance-decision-engine.js
- scratch/test-governance-dashboard-api.js
- scratch/test-phase47-governance-regression.js
- scratch/test-secret-surface-scanner.js
- scratch/test-secret-finding-classifier.js
- scratch/test-credential-rotation-planner.js
- scratch/test-env-drift-detector.js
- scratch/test-permission-auditor.js
- scratch/test-capability-risk-auditor.js
- scratch/test-approval-bypass-auditor.js
- scratch/test-redteam-simulator.js
- scratch/test-prompt-injection-tester.js
- scratch/test-security-scorecard.js
- scratch/test-security-proposal-bridge.js
- scratch/test-security-dashboard-api.js
- scratch/test-phase48-security-regression.js
- scratch/test-data-inventory-scanner.js
- scratch/test-data-classification-engine.js
- scratch/test-privacy-policy-engine.js
- scratch/test-retention-policy-manager.js
- scratch/test-privacy-access-guard.js
- scratch/test-export-control-manager.js
- scratch/test-export-package-builder.js
- scratch/test-archive-cleanup-planner.js
- scratch/test-delete-request-manager.js
- scratch/test-privacy-audit.js
- scratch/test-privacy-dashboard-api.js
- scratch/test-phase49-privacy-regression.js

Commit rules:
- Do NOT commit unless explicitly asked.
- Before committing, inspect git status and git diff.
- Write concise commit messages matching repo style.
- Do NOT commit secrets or .env files.


## Missing sections (auto-appended)

- Forbidden: [TODO]
- Security: [TODO]
- Approval rules: [TODO]
- Dashboard rules: [TODO]
- Known dashboard tabs: [TODO]
- Agent routing rules: [TODO]
- Integration rule: [TODO]
- Module creation check: [TODO]
- Testing rule: [TODO]
- Commit rules: [TODO]

## Test Section

Test content

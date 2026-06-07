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
deploy, cost, operator, portfolio, knowledge.

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

Phase 44 Life OS rule:
- Life OS may create daily/weekly plans, personal tasks, habits, reminders, focus sessions, mood/energy notes, personal goals, and safe personal memory.
- Mood/energy notes are private by default and must not be treated as diagnosis.
- Calendar/Gmail/routine/external actions are proposal-only.
- No direct Gmail send, Calendar mutation, auto-approve, or auto-run.
- Secret-like personal input must be rejected/redacted and must not be stored in docs, audit, dashboard, or Knowledge Graph.

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

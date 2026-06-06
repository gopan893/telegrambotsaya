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
deploy, cost, operator, knowledge.

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

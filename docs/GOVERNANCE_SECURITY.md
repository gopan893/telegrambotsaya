# Governance Security

## Core Security Principles

1. **Never expose env values** — No token/secret/env/API key values are printed or logged
2. **Never print raw secrets** — All secrets are redacted as `[REDACTED_SECRET]`
3. **No direct external write** — All external writes must go through proposal workflow
4. **No direct GitHub push** — GitHub pushes are proposal-only with evaluation + approval
5. **No direct workflow dispatch** — Workflow dispatch is proposal-only
6. **No direct deploy/rollback** — Deploy/rollback require owner approval + evaluation
7. **No direct Gmail/calendar/webhook write** — All require proposal + evaluation + approval
8. **No shell executor** — Shell/SSH/Termux execution is blocked
9. **No auto-approve** — Every approval must be explicit
10. **No auto-run** — Write/external/danger actions cannot auto-run
11. **No self-modifying policy** — Policy cannot modify itself from runtime
12. **No hidden policy bypass** — No backdoors or undocumented overrides
13. **No hard delete** — Policy logs cannot be hard deleted
14. **Bot-to-bot loop blocked** — Telegram bot-to-bot message loops are prevented

## Secret Guard Protection

The secret guard (`src/governance/unified-secret-guard.js`) detects and blocks:
- Tokens (sk-*, ghp_*, github_pat_*, gsk_*, tvly_*)
- API keys, passwords, secrets
- Database URLs (postgresql://, redis://)
- Environment variable names (TELEGRAM_TOKEN, GITHUB_TOKEN, etc.)
- Authorization headers
- Credentials in URLs

## Audit Security

- Governance audit (`src/governance/governance-audit.js`) records decisions
- Actor IDs are truncated in audit logs
- Raw payloads are never logged
- Secrets are redacted from all audit events
- Audit log has a maximum size limit

## Dashboard Security

- All governance dashboard routes require authentication
- No direct action execution from dashboard
- No secrets visible in dashboard UI
- Simulation is read-only — never executes actions
- Secret scan results show labels only, not raw values
- Redacted payloads are shown for demonstration only

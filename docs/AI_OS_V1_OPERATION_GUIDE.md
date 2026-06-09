# AI OS v1 Operation Guide

## Starting the Bot

```bash
node telebot.js
```

Requires:
- Node.js 20+
- All required env vars configured
- PostgreSQL running (or JSON fallback)

## Health Checks

- HTTP: GET /health
- Telegram: /health, /prodhealth
- Dashboard: Overview tab

## Dashboard Access

1. Open /dashboard in browser
2. Enter DASHBOARD_ADMIN_TOKEN
3. Navigate tabs via sidebar

## Telegram Commands

Core:
- /start, /help, /dashboard, /ping, /stats, /whoami

Executor:
- /pending - View pending proposals
- /propose - Create proposal (dry-run only)
- /approve <id> - Approve proposal
- /runexec <id> - Run approved proposal
- /reject <id> - Reject proposal

Health:
- /health - System health
- /prodhealth - Production health check
- /incidents - View incidents

Release:
- /releasecandidate - RC status
- /releasefreeze - Freeze status
- /readiness - Module readiness
- /productionready - Production readiness
- /releaseblockers - Blockers
- /releaserisks - Risks
- /releasenotes - Release notes
- /changelog - Changelog
- /envchecklist - Env checklist (names only)
- /propose_release - GitHub release proposal
- /propose_release_deploy - Deploy proposal

## Approval Flow

1. dry-run: Preview action
2. Evaluation v2: Validate safety/quality
3. Executor proposal: Create proposal
4. Approval: Owner/admin approves
5. Run: /runexec executes

## Incident Response

1. /prodhealth - Check health
2. /incidents - List incidents
3. /analyze_incident - Root cause
4. /responseplan - Create plan
5. /propose_incident_repair - Repair proposal
6. /propose_incident_rollback - Rollback proposal
7. /approve + /runexec

## Backup & Recovery

1. /backupcreate - Manual backup
2. /backups - List backups
3. Backup tab - Download JSON
4. /recovery - Disaster recovery check
5. Restore via dashboard upload

## Security & Privacy

1. /secretscan - Check for secret leaks
2. /securityscore - View scorecard
3. /datainventory - View stored data
4. /exportdata - Request data export
5. /deleterequest - Request deletion (soft)

## Deploy & Rollback

1. /deploycheck - Check deploy readiness
2. /propose_deploy - Deploy proposal
3. /propose_rollback - Rollback proposal
4. Approval + execution via executor flow

All write/external/danger actions are proposal-only.
No auto-approve, no auto-run, no shell executor.

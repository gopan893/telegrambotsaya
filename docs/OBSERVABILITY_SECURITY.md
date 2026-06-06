# Observability Security

Phase 37 follows the project safety contract.

## Sanitization

Incident logs, timeline events, dashboard responses, and Telegram notifications redact:

- tokens
- API keys
- passwords
- authorization headers
- `DATABASE_URL`
- `REDIS_URL`
- PostgreSQL/Redis connection strings
- GitHub/Google/Cloudflare/Render secrets

## Approval Boundary

Repair, rollback, deploy, and external write actions must follow:

```text
incident analysis
→ Evaluation v2
→ executor proposal
→ approval
→ run
```

Proposal creation does not execute action.

## Service Worker

The PWA service worker may cache static dashboard assets only. It must not cache:

- `/api/dashboard/*`
- Authorization headers
- user data
- backup/export JSON
- incident API responses

## Unsupported

Phase 37 does not add:

- shell executor
- direct SSH
- direct Render rollback
- direct GitHub push/workflow dispatch
- autonomous code repair

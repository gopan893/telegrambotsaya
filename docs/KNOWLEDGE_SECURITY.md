# Knowledge Security

## Threat Model

The knowledge graph stores long-term project context. A compromised graph
could:

- Leak tokens or credentials.
- Exfiltrate internal decisions.
- Poison future agent responses.
- Hide malicious deploy notes.

## Defenses

1. **Secret detection at ingest** — every candidate is scanned with regex
   patterns for tokens, API keys, passwords, env vars, and provider tokens.
2. **Sensitivity gating** — `sensitivity: 'secret'` is rejected.
3. **Redaction** — any string field that contains a secret is replaced with
   `[REDACTED_SECRET]`.
4. **Protected decisions** — architectural decisions cannot be archived or
   renamed through the API.
5. **No hard delete** — all deletions are archive-only; archive is the only
   removal flow.
6. **Audit log** — every create, update, archive, dedup hit, and safety event
   is recorded.
7. **Scope and retention** — `temporary_chat` candidates can be marked
   `temporary` and never reach the long-term store.

## Secret Patterns

```
token, secret, password, api_key, Authorization, Bearer,
DATABASE_URL, REDIS_URL, postgresql://, rediss://,
sk-, gph_, github_pat_, gsk_, tvly_,
TELEGRAM_TOKEN, GITHUB_TOKEN, GOOGLE_CLIENT_SECRET,
CLOUDFLARE_API_TOKEN, RENDER_DEPLOY_HOOK, xox[baprs]-
```

## What We Never Store

- Raw env values.
- Telegram token / dashboard admin token.
- API keys (GitHub, OpenAI, Google, Cloudflare, Render, Tavily).
- Connection strings (DATABASE_URL, REDIS_URL).
- Raw prompts that contain credentials.

## Dashboard Safety

- All knowledge routes are protected by dashboard auth middleware.
- All responses pass through `dashboard-guards.safeDashboardResponse` for
  redaction of secret-shaped keys.
- No `/api/dashboard/knowledge/*` is cached by the service worker.

## Audit

`knowledgeGraphStore.getAuditLog({ type, nodeId })` exposes the audit stream
for the dashboard. The default limit is 100.

## Operational Rules

- Knowledge must not perform any GitHub push, Render deploy/rollback, or
  email send — all external actions go through the executor proposal flow.
- The knowledge graph never auto-archives more than 200 ids in a single call.
- Documentation intelligence returns findings only — it does not edit files.

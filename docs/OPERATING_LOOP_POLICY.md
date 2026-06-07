# Operating Loop Policy

## Modes

| Mode | Description | Allowed Actions |
|---|---|---|
| `manual` | Only manual triggers | read, list, view |
| `scheduled_readonly` | Scheduled cycle, read-only | read, list, view, search, summarize, export, analyze, audit, monitor, inspect, review |
| `scheduled_dry_run` | Like readonly but simulates actions | Same as readonly + dry-run proposals |
| `proposal_only` | Only creates proposals | propose, plan, recommend |

## Blocked Actions

The following actions are **always blocked** in all operating loop modes:

- `write` — any file/system write
- `external` — external API calls
- `danger` — dangerous operations
- `shell` — shell execution
- `git_push` — git push
- `deploy` — deployment
- `rollback` — rollback
- `email_send` — send email
- `calendar_write` — modify calendar
- `webhook_post` — post webhook

## Validation Rules

When registering a loop, the registry validates:

1. `id` must be a non-empty string
2. `mode` must be one of: manual, scheduled_readonly, scheduled_dry_run, proposal_only
3. `status` must be one of: enabled, disabled, paused
4. `autoApprove` must **never** be true
5. `autoRun` must **never** be true
6. `blockedActions` must include all dangerous defaults

## Quiet Hours

Loops respect quiet hours (default 22:00-07:00). During quiet hours, notifications are suppressed and non-urgent blockers are queued.

## Rate Limits

- Maximum 3 notifications per day per loop
- Maximum 10 dashboard API requests per minute per IP

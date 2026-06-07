# Telegram Security

## Overview

The Telegram Control Layer implements defense-in-depth security across five areas: permission gating, risk classification, rate limiting, secret detection, and audit logging. No action that writes data, modifies external systems, or causes side effects executes without explicit human approval.

---

## 1. Permission Guard

`telegram-permission-guard.js` enforces two tiers of access:

| Tier | Identifier | Privileges |
|------|-----------|------------|
| Owner | `OWNER_CHAT_ID` env var | Full access — can run owner-only commands (`/approve`, `/runexec`, `/settings`, `/deployplan`, etc.) |
| Admin | `ADMIN_IDS` env var (comma-separated) | Can run admin-only commands (`/council`, `/debate`, `/propose`, `/integration_eval`) and high-risk commands |

Rules:
- `requiresOwner` → only if user/chat ID matches `OWNER_CHAT_ID`
- `requiresAdmin` → owner or any ID in `ADMIN_IDS`
- `riskLevel === 'high' || 'danger'` → requires admin
- `module === 'lifeos'` → requires owner (private data)
- Unknown/non-matching users can run only `read_only` commands (e.g., `/help`, `/status`, `/menu`)

Permission denied responses are formatted in Indonesian: `"⚠️ Akses ditolak"` with reason.

---

## 2. Risk Classification

`telegram-risk-classifier.js` assigns one of 5 levels with deterministic actions:

| Level | Rank | Examples | Requires Approval | Requires Evaluation |
|-------|------|----------|-------------------|---------------------|
| `read_only` | 0 | `/help`, `/status`, `/goals` | No | No |
| `low` | 1 | `/settings`, `/routine_on`, `/mood` | No | No |
| `medium` | 2 | `/backupcreate`, `/reject`, `/memory_cleanup` | Yes* | No |
| `high` | 3 | `/approve`, `/propose_push`, `/propose_deploy` | Yes | Yes |
| `danger` | 4 | `/runexec`, push, deploy, rollback, restore, shell_exec | Yes | Yes |

*\* Medium-risk commands require proposal creation but not Evaluation v2 gate.*

Natural language intents are classified against predefined action lists (`DANGER_ACTIONS`, `HIGH_ACTIONS`, `MEDIUM_ACTIONS`, `LOW_ACTIONS`). Unknown intents default to `read_only`.

---

## 3. Rate Limiting

`telegram-rate-limit.js` enforces per-user, per-risk-tier rate windows:

| Risk Tier | Max Requests | Window |
|-----------|-------------|--------|
| `read_only` | 30 | 60 seconds |
| `default` | 10 | 60 seconds |
| `high` | 3 | 60 seconds |
| `danger` | 1 | 120 seconds |

Rate limit state is in-memory per-user ID. Returns `{ allowed, remaining, retryAfter }` or `{ allowed: false, reason }`.

Additional protections:
- **Duplicate reply suppression**: Same reply within 5 seconds is suppressed
- **Visible agent reply limiting**: Max 5 visible agent replies per 30 seconds per chat

---

## 4. Bot-to-Bot Loop Prevention

`preventBotToBotLoop()` in `telegram-rate-limit.js`:

- Drops all updates from bot accounts (`update.message.from.is_bot === true`)
- Exception: bot messages starting with `/` (slash commands) are not dropped
- Combined with Telegram-level privacy mode (bot only sees commands by default)

---

## 5. Secret Pattern Detection

Two layers of secret detection:

### Layer 1: Intent Classifier Blocked Patterns (`telegram-intent-classifier.js`)

Messages matching any of these patterns are **immediately rejected** with no processing, no storage, no audit:

- `TELEGRAM_TOKEN=`
- `GITHUB_TOKEN=`
- `DATABASE_URL=`
- `REDIS_URL=`
- `DASHBOARD_ADMIN_TOKEN=`
- `GOOGLE_CLIENT_SECRET=`
- `CLOUDFLARE_API_TOKEN=`
- `RENDER_DEPLOY_HOOK=`
- `sk-[A-Za-z0-9]{10,}` (OpenAI API keys)
- `ghp_[A-Za-z0-9]{10,}` (GitHub PAT)
- `github_pat_[A-Za-z0-9_]{10,}`
- `postgresql://` URLs
- `rediss://` URLs

### Layer 2: Response Sanitization (`telegram-utils.js`)

All text output is sanitized before sending to Telegram. Redactions:
- `sk-*` → `[REDACTED_API_KEY]`
- `ghp_*` → `[REDACTED_GH_TOKEN]`
- `github_pat_*` → `[REDACTED_GH_PAT]`
- `gsk_*` → `[REDACTED_GSK_KEY]`
- `tvly_*` → `[REDACTED_TVLY_KEY]`
- `postgresql://*` → `[REDACTED_DB_URL]`
- `rediss://*` → `[REDACTED_REDIS_URL]`
- `TELEGRAM_TOKEN=*` → `TELEGRAM_TOKEN=[REDACTED]`
- `GITHUB_TOKEN=*` → `GITHUB_TOKEN=[REDACTED]`
- `GOOGLE_CLIENT_SECRET=*` → `GOOGLE_CLIENT_SECRET=[REDACTED]`
- `CLOUDFLARE_API_TOKEN=*` → `CLOUDFLARE_API_TOKEN=[REDACTED]`
- `RENDER_DEPLOY_HOOK=*` → `RENDER_DEPLOY_HOOK=[REDACTED]`

### Layer 3: Audit Log Sanitization (`telegram-command-audit.js`)

Audit events are sanitized on insertion: any key containing `secret`, `token`, `password`, or `key` is replaced with `[REDACTED]`. String values are run through `sanitizeText()`.

---

## 6. Audit Logging

`telegram-command-audit.js` maintains an in-memory audit log (max 10,000 entries, FIFO eviction).

Each record contains:
- `id`, `workspaceId`, `userId`, `chatId`
- `command`, `intent`, `module`
- `riskLevel`, `actionType`
- `allowed` (boolean), `proposalId`, `resultStatus`
- `reason`, `createdAt`

Audit is queryable by command, module, userId, chatId, allowed status, risk level, and time range via `listTelegramCommandAudit(filters)`. The `/audit` command allows viewing recent entries.

---

## 7. Prohibition of Auto-Approve / Auto-Run

**No command or flow may auto-approve or auto-execute a high-risk action.**

This is enforced at architectural level:
- `/approve` only changes proposal status to `approved` — does NOT execute
- `/runexec` only executes an already-approved proposal — does NOT auto-approve
- No command has both `requiresApproval: false` and `riskLevel >= high` for write actions
- The intent classifier has a `refuse_full_auto` intent that explicitly rejects "selesaikan semua otomatis" requests
- The natural router refuses fully automatic completion requests with a message suggesting step-by-step proposals instead
- Dashboard and Telegram share the same executor proposal pipeline — no bypass exists

This is enforced in code: `AGENTS.md` states:
> Write/external/danger actions must go through: dry-run → Evaluation v2 → executor proposal → approval → run
> Proposal creation must not execute action.
> /approve only approves.
> /runexec only runs approved proposal.

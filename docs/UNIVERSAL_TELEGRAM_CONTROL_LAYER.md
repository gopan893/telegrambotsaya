# Universal Telegram Control Layer

## Overview

The Telegram Control Layer is a modular middleware architecture that sits between the Telegram webhook entry point (`telebot.js`) and all command execution. It provides unified command registration, natural language routing, permission checking, risk classification, rate limiting, audit logging, session context, and proposal-based approval for high-risk actions.

### Architecture

```
Telegram Update (webhook)
       |
       v
telegram-update-normalizer.js -- text/caption/callback/edit normalization
       |
       v
telegram-runtime-dispatcher.js -- bot-loop guard, diagnostics, context sync
       |
       v
telegram-rate-limit.js      -- rate limit check
telegram-session-context.js  -- session restoration
telegram-natural-router.js   -- entry router
       |
       v
telegram-intent-classifier.js -- classify: slash command or natural intent
       |
       v
telegram-permission-guard.js  -- permission check (owner/admin)
telegram-risk-classifier.js   -- risk level classification
       |
       v
telegram-command-registry.js  -- resolve command definition
       |
       v
[read_only/low] ────────────> execute immediately
       |
[medium/high/danger] ──────> telegram-proposal-router.js
                                └── create proposal
                                └── Evaluation v2 gate
                                └── /approve → /runexec
```

## 17 Modules

All modules live in `src/telegram-control/`:

| # | File | Role |
|---|------|------|
| 1 | `index.js` | Barrel entry, re-exports all modules |
| 2 | `telegram-command-registry.js` | Command definitions, search, registration (`/command → definition`) |
| 3 | `telegram-natural-router.js` | Routes natural language messages through intent → command mapping |
| 4 | `telegram-intent-classifier.js` | Regex-based intent classification + blocked secret patterns |
| 5 | `telegram-permission-guard.js` | Owner/admin permission check against `OWNER_CHAT_ID` / `ADMIN_IDS` |
| 6 | `telegram-risk-classifier.js` | Classifies risk: `read_only`, `low`, `medium`, `high`, `danger` |
| 7 | `telegram-response-formatter.js` | Formats and sanitizes responses (short, long, list, error, proposal) |
| 8 | `telegram-help-menu.js` | Dynamic help menu by category, command search |
| 9 | `telegram-proposal-router.js` | Creates/lists/updates executor proposals for high-risk actions |
| 10 | `telegram-command-audit.js` | In-memory audit log (max 10k entries), sanitized |
| 11 | `telegram-rate-limit.js` | Per-user rate limiting by risk tier + bot-to-bot loop prevention |
| 12 | `telegram-session-context.js` | Chat session context (30-min TTL, follow-up support) |
| 13 | `telegram-utils.js` | Text sanitization, ID generation, secret pattern detection, Telegram update helpers |
| 14 | `telegram-update-normalizer.js` | Normalizes text, captions, edits, callbacks, channel posts, and reply context |
| 15 | `telegram-runtime-dispatcher.js` | Primary runtime entrypoint for webhook sync, diagnostics, context persistence, and safe pass-through |
| 16 | `telegram-context-store.js` | Per-chat/user sanitized session context store with short follow-up resolution |
| 17 | `telegram-message-sync-checker.js` | Builds safe `/telegramcheck`, `/webhookcheck`, and `/messagecheck` diagnostics |

## Command Registration

Commands are defined via `BUILTIN_COMMANDS` array in `telegram-command-registry.js` (174 built-in commands). Each entry has:

- `name`, `aliases`, `module`, `category`, `description`, `examples`
- `riskLevel`: `read_only | low | medium | high | danger`
- `requiresOwner`, `requiresAdmin`, `requiresApproval`, `requiresEvaluation`
- `enabled`, `handler`

Dynamic registration via `registerTelegramCommand(def)`. Command lookup supports `/name` and alias resolution via inverted index.

## Routing

1. **Normalize update** (`message.text`, `caption`, `edited_message`, `callback_query.data`, channel posts) → unified message shape.
2. **Bot-loop + duplicate guard** → bot messages and repeated message IDs are ignored.
3. **Diagnostics commands** (`/telegramcheck`, `/webhookcheck`, `/messagecheck`) → safe runtime report, no secrets.
4. **Slash commands** (`/command ...`) → resolved directly from registry.
5. **Natural language** → `intent-classifier` matches regex patterns → mapped to a command or special intent (greeting, thanks, followup, refuse_full_auto, etc.).
6. **Blocked patterns** (secrets/tokens) → immediately rejected with no processing or storage.

## Permission Checking

`telegram-permission-guard.js`:
- Compares user/chat ID against `OWNER_CHAT_ID` for owner check
- Compares against `ADMIN_IDS` (comma-separated) for admin check
- High/danger risk commands require admin
- Life OS module requires owner
- Returns `{ allowed, reason }` object

## Risk Classification

`telegram-risk-classifier.js`:
- `read_only` (rank 0): Info requests, no side effects
- `low` (rank 1): Preference changes, non-critical
- `medium` (rank 2): Data modification, non-critical operations
- `high` (rank 3): Write/external actions → **requires approval + evaluation**
- `danger` (rank 4): Deploy/rollback/restore/destructive → **requires approval + evaluation**

Risk rank ≥ 2 (`medium`) triggers executor proposal creation. Rank ≥ 3 (`high`) also triggers Evaluation v2 gate.

## Proposal Flow

For `high`/`danger` commands:

1. Natural or slash command matched → risk classification triggers proposal
2. `telegram-proposal-router.js` creates a `pending` proposal with unique ID
3. Duplicate detection prevents identical pending proposals
4. Proposal is formatted as a Telegram message with `/approve` and `/reject` instructions
5. After approval (`/approve`), status changes to `approved`
6. Execution via `/runexec` changes status to `executed`

## Dashboard Integration

The Dashboard provides a dedicated tab accessible via `src/dashboard/telegram-control-routes.js`. Routes:

- `GET /api/dashboard/telegram-control` — layer status
- `GET /api/dashboard/telegram-control/commands` — list all commands (filtered)
- `GET /api/dashboard/telegram-control/commands/:name` — command detail
- `GET /api/dashboard/telegram-control/categories` — category listing
- `POST /api/dashboard/telegram-control/test-intent` — test NL classification
- `GET /api/dashboard/telegram-control/audit` — audit log
- `GET /api/dashboard/telegram-control/pending-proposals` — pending proposals
- `POST /api/dashboard/telegram-control/validate-registry` — validate integrity

The Dashboard "Commands" tab (📜) displays the registered command catalog organized by category.

## Integration With Existing Modules

- **Executor**: Proposals feed into the executor system for Evaluation v2 gating
- **Audit**: Commands are logged via `telegram-command-audit.js` (sanitized, no secrets)
- **Session Context**: Follow-up messages are resolved via `telegram-session-context.js`
- **Rate Limiting**: Per-user, per-risk-tier windows (e.g., danger: 1 req/2min)
- **Bot-to-bot prevention**: Non-slash messages from bots are dropped via `preventBotToBotLoop`

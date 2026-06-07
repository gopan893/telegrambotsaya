# Telegram Natural Chat Routing

## Architecture

Natural language messages are processed through a runtime sync pipeline before legacy handlers run:

```
Telegram Update (message/caption/edit/callback/channel)
    │
    ▼
┌─────────────────────────────────┐
│  0. Update Normalizer           │ ← telegram-update-normalizer.js
│     → Extract text/caption,     │
│       chat/user/message metadata│
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  Runtime Dispatcher             │ ← telegram-runtime-dispatcher.js
│     → bot-loop + duplicate guard│
│     → diagnostics commands      │
│     → context sync              │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  1. Secret Pattern Detection    │ ← BLOCKED_PATTERNS (tokens, URLs)
│     → If matched: blocked,      │
│       no processing, no storage │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  2. Intent Classification       │ ← 49 regex patterns in
│     → Slash command detection   │   telegram-intent-classifier.js
│     → Natural intent matching   │
└─────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────┐
│  3. Command Resolution + Risk   │ ← telegram-command-registry.js
│     → Map intent→command        │   telegram-risk-classifier.js
│     → Classify risk level       │
│     → Create action plan        │
└─────────────────────────────────┘
    │
    ▼
[Execute / Proposal / Response]
```

The dispatcher is now the primary Telegram runtime entrypoint. Existing legacy command and natural handlers remain as fallback/execution handlers after the message has been normalized and saved into the short-lived session context.

## Intent Patterns Table

All patterns are defined in `INTENT_PATTERNS` array in `telegram-intent-classifier.js`. Patterns are matched in order (first match wins).

| # | Pattern (regex) | Intent | Mapped Command | Example |
|---|-----------------|--------|----------------|---------|
| 1 | `^\/(\w+)` | `slash_command` | resolved from registry | `/help` |
| 2 | `cek\|check\|lihat\|tampilkan\|show (productions?\|production health\|kesehatan)` | `prod_health` | `prodhealth` | "cek production health" |
| 3 | `ada\|apa\|list (incident\|insiden\|kejadian\|masalah)` | `list_incidents` | `incidents` | "ada incident?" |
| 4 | `kenapa\|mengapa\|why (deploy\|render\|gagal\|fail)` | `analyze_deploy_failure` | `analyze_incident` | "kenapa deploy gagal?" |
| 5 | `kenapa\|mengapa\|why (gagal\|fail\|error)` | `analyze_incident` | `analyze_incident` | "kenapa error?" |
| 6 | `project (mana\|yang\|apa) (harus\|saya\|lanjut)` | `portfolio_next` | `portfolio_next` | "project mana yang harus saya lanjut?" |
| 7 | `buat\|bikin\|create (rencana\|plan\|jadwal) (hari ini\|today)` | `daily_plan` | `daily` | "buat rencana hari ini" |
| 8 | `(rencana\|plan\|jadwal) (hari ini\|today)` | `daily_plan` | `daily` | "rencana hari ini" |
| 9 | `buat\|bikin\|create rencana (minggu\|weekly)` | `weekly_plan` | `weekly` | "buat rencana minggu ini" |
| 10 | `push (perubahan\|change\|init) (ini\|ke) github` | `propose_push` | `propose_push` | "push perubahan ini ke github" |
| 11 | `deploy (ke\|to) render` | `propose_deploy` | `propose_deploy` | "deploy ke render" |
| 12 | `rollback (deploy\|release\|terakhir)` | `propose_rollback` | `propose_rollback` | "rollback deploy terakhir" |
| 13 | `buat\|bikin\|create (event\|acara\|calendar) (besok\|tomorrow)` | `calendar_proposal` | `null` | "buat event besok" |
| 14 | `kirim\|send (email\|surel) (ini\|this)` | `gmail_proposal` | `null` | "kirim email ini" |
| 15 | `selesaikan (semua\|all) (otomatis\|automatic)` | `refuse_full_auto` | — | "selesaikan semua otomatis" |
| 16 | `otomatiskan (semua\|all)` | `refuse_full_auto` | — | "otomatiskan semua" |
| 17 | `berapa\|how many\|how much (token\|usage\|cost\|biaya\|pemakaian)` | `usage_check` | `usage` | "berapa token usage?" |
| 18 | `(token\|usage\|cost\|biaya) (hari ini\|today\|bulan ini)` | `usage_check` | `usage` | "token hari ini" |
| 19 | `apa (keputusan\|decision) (penting\|pentingnya)` | `decision_memory` | `decision_memory` | "apa keputusan penting?" |
| 20 | `(codex\|opencode\|hermes) (harus\|sebaiknya\|recommend)` | `tool_recommendation` | — | "codex recommend apa?" |
| 21 | `help\|bantuan\|tolong` | `help` | `help` | "tolong" |
| 22 | `^(halo\|hi\|hello\|hai\|pagi\|siang\|sore\|malam\|good)` | `greeting` | — | "halo" |
| 23 | `terima kasih\|thanks\|thank you\|makasih` | `thanks` | — | "makasih" |
| 24 | `(solusi\|solution\|jawaban\|answer)\s*(apa\|nya)?\s*\??$` | `followup_answer` | — | "solusinya apa?" |
| 25 | `^(baik\|ok\|oke\|okay\|yes\|ya\|setuju)$` | `confirmation` | — | "oke" |
| 26 | `^(tidak\|no\|nggak\|gak\|skip\|batal)$` | `rejection` | — | "batal" |
| 27 | `(status\|kondisi) (bot\|server\|system\|sistem)` | `status` | `status` | "status bot" |
| 28 | `(siapa\|who) (saya\|i am\|aku)` | `whoami` | `whoami` | "siapa saya?" |
| 29 | `(tugas\|task\|kerjaan) (saya\|hari ini\|today)` | `tasks` | `tasks` | "tugas saya hari ini" |
| 30 | `habits?\|kebiasaan (hari ini\|today\|check)` | `habits` | `habits` | "habits check" |
| 31 | `(mood\|suasana hati\|perasaan) (hari ini\|today)` | `mood` | `mood` | "mood hari ini" |
| 32 | `(energi\|energy) (hari ini\|today)` | `energy` | `energy` | "energi hari ini" |
| 33 | `(focus\|fokus) (hari ini\|today\|session)` | `focus` | `focus` | "focus session" |
| 34 | `(sekarang\|now\|waktunya) (focus\|fokus\|kerja)` | `focus` | `focus` | "waktunya fokus" |
| 35 | `(reminder\|pengingat\|ingatkan)` | `reminders` | `reminders` | "ingatkan saya" |
| 36 | `(knowledge\|pengetahuan\|dokumen\|docs) (cari\|search\|tentang)` | `knowledge_search` | `knowledge_search` | "cari knowledge tentang X" |
| 37 | `(knowledge\|pengetahuan) (status\|overview)` | `knowledge` | `knowledge` | "knowledge status" |
| 38 | `(portfolio\|portofolio\|project) (status\|overview\|ringkasan)` | `portfolio` | `portfolio` | "portfolio status" |
| 39 | `(goal\|tujuan) (apa\|list\|saya)` | `goals` | `goals` | "goal saya" |
| 40 | `(prioritas\|priority) (apa\|list\|saya)` | `priorities` | `priorities` | "prioritas saya" |
| 41 | `(plans\|rencana) (apa\|list\|saya)` | `plans` | `plans` | "rencana saya" |
| 42 | `(integrations?\|integrasi\|konektor) (status\|list)` | `integrations` | `integrations` | "integrations status" |
| 43 | `(backup\|cadangan) (status\|buat\|create)` | `backup` | `backup` | "backup status" |
| 44 | `(briefing\|ringkasan\|daily brief)` | `briefing` | `briefing` | "briefing" |
| 45 | `(laporan\|report) (portfolio\|portofolio\|project)` | `portfolioreport` | `portfolioreport` | "laporan portfolio" |
| 46 | `(laporan\|report) (life\|hidup)` | `lifereport` | `lifereport` | "laporan life" |

## Special Intents (No Command Mapping)

These intents produce direct responses without executing a command:

- **`greeting`** — Responds with "Halo! Ada yang bisa saya bantu?"
- **`thanks`** — Responds with "Sama-sama! Senang bisa membantu."
- **`refuse_full_auto`** — Rejects requests for fully automatic execution and suggests step-by-step proposals
- **`followup_answer`** — Passes through to session context for follow-up resolution
- **`confirmation`** / **`rejection`** — Used in multi-step dialogs
- **`contains_secret`** — Immediately blocked, no processing or storage
- **`calendar_proposal`**, **`gmail_proposal`** — Recognized but require explicit proposal flow (no direct execution)
- **`tool_recommendation`** — Recommends which tool/agent to use

## Routing Examples

### Example 1: Slash command
```
User: /deploy
  → intent: slash_command
  → command: deploy (read_only)
  → response: Show deploy overview
```

### Example 2: Natural → command
```
User: berapa token usage hari ini?
  → intent: usage_check
  → command: /usage
  → risk: read_only
  → response: Token usage summary
```

### Example 3: Natural → proposal
```
User: deploy ke render
  → intent: propose_deploy
  → command: /propose_deploy
  → risk: high → requires approval + evaluation
  → proposal created → "Use /approve <id> to approve"
```

### Example 4: Blocked secret
```
User: TELEGRAM_TOKEN=12345...
  → intent: contains_secret
  → blocked: true
  → response: "Pesan mengandung pola rahasia. Tidak akan diproses atau disimpan."
```

### Example 5: Refuse auto
```
User: selesaikan semua otomatis
  → intent: refuse_full_auto
  → response: "Saya tidak bisa menyelesaikan semua secara otomatis.
     Saya bisa membantu dengan: membuat rencana bertahap,
     menyarankan tindakan berikutnya, membuat proposal untuk setiap langkah."
```

### Example 6: Follow-up
```
User: (previous context: discussing deploy)
  "solusinya apa?"
  → intent: followup_answer
  → resolved via session context → passes through for AI follow-up
```

### Example 7: Greeting
```
User: hai
  → intent: greeting
  → response: "Halo! Ada yang bisa saya bantu?"
```

## Session Context

`telegram-context-store.js` backs `telegram-session-context.js` and maintains per-chat/user context with 30-minute TTL:
- Stores `latestTopic`, `latestCommand`, `latestIntent`, `previousResponse`
- Stores sanitized `latestUserMessage` for short follow-ups
- Enables follow-up resolution via `resolveFollowupContext()`
- Cleanup runs every 5 minutes
- Supports cross-user access detection

Short follow-ups such as `Solusinya apa?`, `Terus gimana?`, `Lanjut`, and `Jelaskan` resolve against:
1. the replied Telegram message,
2. the latest per-user session topic,
3. the latest sanitized user message.

## Runtime Diagnostics

Read-only diagnostics commands:

- `/telegramcheck` — shows normalized text, command/intent, chat/user IDs, and multi-bot mapping.
- `/webhookcheck` — same runtime report, focused on webhook route and mapping.
- `/messagecheck` — shows the current normalized message shape safely.

Diagnostics never print bot tokens, webhook secrets, database URLs, Redis URLs, or API keys.

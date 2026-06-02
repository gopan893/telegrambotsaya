# Multi-Bot Foundation

Phase 20 menambahkan fondasi satu server untuk banyak bot Telegram. Semua bot tetap memakai backend yang sama: PostgreSQL, Redis, workspace/permission, executor approval, tool registry, audit log, backup, dan dashboard.

## Arsitektur

- Satu server Express.
- Satu database PostgreSQL dan Redis optional.
- Banyak token bot Telegram dari environment.
- Setiap bot dipetakan ke `agentId`.
- Token hanya hidup di memory server dan tidak pernah dikirim ke API/dashboard/Telegram.
- Jika specialist bot belum dikonfigurasi, response fallback dikirim lewat Orchestrator/default bot dengan label agent.

## Env

Legacy single bot tetap didukung:

```env
TELEGRAM_TOKEN=
```

Multi-bot optional:

```env
TELEGRAM_TOKEN_ORCHESTRATOR=
TELEGRAM_TOKEN_PLANNER=
TELEGRAM_TOKEN_CODER=
TELEGRAM_TOKEN_CRITIC=
TELEGRAM_TOKEN_RESEARCH=
TELEGRAM_TOKEN_OPS=
TELEGRAM_TOKEN_SECURITY=
TELEGRAM_TOKEN_MEMORY=
TELEGRAM_TOKEN_EXECUTOR=
TELEGRAM_TOKEN_REFLECTION=
```

Gunakan nama env persis seperti daftar di atas. Jika server mendeteksi typo `TELEGRAM_TOKEN_PLANNE`, dashboard/log hanya menampilkan peringatan aman:

```text
Possible typo: TELEGRAM_TOKEN_PLANNE detected. Use TELEGRAM_TOKEN_PLANNER.
```

Nilai token tidak pernah ditampilkan.

Username dan webhook secret optional memakai suffix yang sama, misalnya:

```env
TELEGRAM_USERNAME_CODER=
TELEGRAM_WEBHOOK_SECRET_CODER=
```

## Webhook

Legacy route tetap:

```text
/webhook/<TELEGRAM_TOKEN>
```

Multi-bot route baru:

```text
/webhook/bot/:botId
/webhook/bot/:botId/:secret
```

Route yang direkomendasikan:

```text
/webhook/bot/coder/<TELEGRAM_WEBHOOK_SECRET_CODER>
```

Jangan pakai token bot di URL multi-bot. Gunakan webhook secret terpisah.

## Agent ke Bot Mapping

Mapping default:

| Agent | Bot env |
| --- | --- |
| `orchestrator` | `TELEGRAM_TOKEN` atau `TELEGRAM_TOKEN_ORCHESTRATOR` |
| `planner` | `TELEGRAM_TOKEN_PLANNER` |
| `coder` | `TELEGRAM_TOKEN_CODER` |
| `critic` | `TELEGRAM_TOKEN_CRITIC` |
| `research` | `TELEGRAM_TOKEN_RESEARCH` |
| `ops` | `TELEGRAM_TOKEN_OPS` |
| `security` | `TELEGRAM_TOKEN_SECURITY` |
| `memory` | `TELEGRAM_TOKEN_MEMORY` |
| `executor` | `TELEGRAM_TOKEN_EXECUTOR` |
| `reflection` | `TELEGRAM_TOKEN_REFLECTION` |

Command `/botmapping` menampilkan mapping ini secara aman dengan status `configured true/false`, tanpa token.

## Visible Multi-Bot Replies

Secara default, single-bot/private mode tetap orchestrator-only. Untuk grup yang memakai beberapa bot, specialist bot bisa dibuat visible hanya saat dipilih router:

```text
/multibot
/multibot_on
/multibot_off
/visibleagents
/botmapping
```

Perilaku:

- `/multibot_on`: Orchestrator tetap memberi jawaban utama, lalu maksimal 2 specialist terpilih boleh memberi komentar singkat dengan bot masing-masing.
- `/multibot_off`: hanya Orchestrator/default bot yang menjawab.
- `quiet`: selalu Orchestrator saja.
- `council`/`debate`: agent yang dipilih boleh tampil sebagai opini berlabel.

Agent internal-only dan muted tidak pernah mengirim pesan Telegram.

## BotFather

- Buat tiap bot dari BotFather.
- Jangan paste token ke chat.
- Privacy mode menentukan apakah bot membaca semua pesan grup.
- Mode aman: Orchestrator membaca pesan utama; specialist bot tetap command/mention-based.
- Jika grup mulai ramai, gunakan `/quiet`.

## Anti-Spam

- Bot message diabaikan agar tidak memicu loop bot-ke-bot.
- Fingerprint pesan terbaru mencegah reply duplicate.
- Specialist visible replies dibatasi oleh `maxVisibleSpecialistBots`, default 2.
- Agent yang tidak dipilih router diam.

## Compatibility

Jika hanya `TELEGRAM_TOKEN` ada, bot berjalan seperti sebelumnya dengan:

- `botId=default`
- `agentId=orchestrator`
- semua command lama tetap memakai bot utama.

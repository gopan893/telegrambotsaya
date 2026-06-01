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

## BotFather

- Buat tiap bot dari BotFather.
- Jangan paste token ke chat.
- Privacy mode menentukan apakah bot membaca semua pesan grup.
- Mode aman: Orchestrator membaca pesan utama; specialist bot tetap command/mention-based.
- Jika grup mulai ramai, gunakan `/quiet`.

## Compatibility

Jika hanya `TELEGRAM_TOKEN` ada, bot berjalan seperti sebelumnya dengan:

- `botId=default`
- `agentId=orchestrator`
- semua command lama tetap memakai bot utama.

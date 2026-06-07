# Documentation Agent

Documentation Agent membuat draft dan update plan dokumen, tetapi tidak menulis file secara langsung dari Telegram/runtime bot.

## Yang Bisa Dilakukan

- Mendeteksi jenis dokumen yang dibutuhkan.
- Membaca dokumen proyek yang ada.
- Membuat draft README, env guide, command guide, troubleshooting guide, atau phase summary.
- Membuat documentation update plan.
- Membuat prompt/proposal untuk Codex/OpenCode/Hermes.

## Approval Boundary

Perubahan dokumen yang menyentuh repo tetap harus lewat:

```text
draft → update plan → Evaluation v2 → executor proposal → approval → run
```

Runtime bot tidak melakukan commit, push, atau file write langsung.

## Env Docs

Env documentation hanya boleh menampilkan nama env, bukan value:

- `DATABASE_URL`
- `REDIS_URL`
- `TELEGRAM_TOKEN`
- `DASHBOARD_ADMIN_TOKEN`

Value, URL credential, token, dan API key tidak boleh masuk docs, audit log, atau Knowledge Graph.

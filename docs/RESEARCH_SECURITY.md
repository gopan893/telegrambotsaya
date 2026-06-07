# Research Security

Research Agent memakai safety gate sebelum menyimpan task, source, evidence, report, atau Knowledge Graph link.

## Secret Pattern

Input berisi pola berikut akan diblokir atau di-redact:

- `token`
- `secret`
- `password`
- `api_key`
- `Authorization`
- `Bearer`
- `DATABASE_URL`
- `REDIS_URL`
- `postgresql://`
- `rediss://`
- `sk-`
- `ghp_`
- `github_pat_`
- `gsk_`
- `tvly_`
- `TELEGRAM_TOKEN`
- `GITHUB_TOKEN`
- `GOOGLE_CLIENT_SECRET`
- `CLOUDFLARE_API_TOKEN`
- `RENDER_DEPLOY_HOOK`

## Rules

- Jangan simpan raw secret sebagai source.
- Jangan masukkan secret ke docs draft.
- Jangan masukkan secret ke Knowledge Graph.
- Jangan tampilkan credential value di dashboard/API/Telegram.
- External/write action tetap proposal-only dan butuh approval.

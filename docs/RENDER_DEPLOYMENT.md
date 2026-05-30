# Render Deployment Guide

## Required Env

```text
TELEGRAM_TOKEN=
WEBHOOK_URL= atau TELEGRAM_WEBHOOK_URL=
OWNER_CHAT_ID=
ADMIN_IDS=
MISTRAL_API_KEY= atau GROQ_API_KEY=
```

## Optional Env

```text
DATABASE_URL=
REDIS_URL=
STORAGE_DRIVER=auto
PGSSL=false
RUN_MIGRATIONS=true
TAVILY_API_KEY=
OPENWEATHER_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

## Render Settings

- Runtime: Node.js 20 atau lebih baru.
- Build command: `npm install`
- Start command: `npm start`
- Port: gunakan `process.env.PORT` dari Render.
- Deploy branch: `main`.

## Deployment Checklist

- `TELEGRAM_TOKEN` valid.
- `WEBHOOK_URL`/`TELEGRAM_WEBHOOK_URL` mengarah ke domain Render.
- Minimal satu provider AI aktif: `MISTRAL_API_KEY` atau `GROQ_API_KEY`.
- `OWNER_CHAT_ID`/`ADMIN_IDS` diisi untuk command admin.
- `DATABASE_URL` optional; jika kosong, JSON fallback aktif.
- `REDIS_URL` optional; jika kosong, memory cache fallback aktif.
- `RUN_MIGRATIONS=true` untuk membuat schema PostgreSQL saat database tersedia.
- Tidak ada secret ditulis di log.

## Smoke Test Setelah Deploy

1. Buka `/health`.
2. Cek Render logs untuk:
   - storage driver aktif;
   - Redis tersedia atau fallback;
   - webhook terpasang;
   - tidak ada crash startup.
3. Di Telegram jalankan:
   - `/ping`
   - `/help`
   - `/stats`
   - `/adaptive status`
   - `/aios`
   - `Halo`
   - `Apa langkah berikutnya untuk project bot saya?`

## Clear Build Cache

Gunakan Render dashboard:

1. Service -> Manual Deploy.
2. Pilih `Clear build cache & deploy`.
3. Pantau logs sampai server berjalan.

## Rollback Basic

Jika deploy gagal:

1. Render -> Deploys.
2. Pilih deploy sebelumnya yang sehat.
3. Klik rollback/redeploy.
4. Jika masalah berasal dari database, set sementara `STORAGE_DRIVER=json`.

## PostgreSQL/Redis Fallback

- Tanpa `DATABASE_URL`: bot memakai JSON file fallback.
- Jika PostgreSQL error saat startup/migration: bot fallback ke JSON.
- Tanpa `REDIS_URL`: bot memakai memory cache lokal.
- Jika Redis error: cache fallback memory/local.

## Known Deployment Risk

- Render free tier bisa cold start; webhook mungkin lambat beberapa detik pertama.
- File JSON fallback di free tier tidak cocok untuk data jangka sangat panjang.
- Jika memakai PostgreSQL hosted, aktifkan SSL via `PGSSL=true` jika provider butuh.
- Jangan expose `/api/dashboard` untuk data sensitif; endpoint hanya metadata publik.

# Security Policy — Telegram AI Bot

## Environment Variable Wajib

| Variable | Deskripsi |
|----------|-----------|
| `TELEGRAM_TOKEN` | Token bot dari BotFather |
| `MISTRAL_API_KEY` | API key untuk Mistral AI |
| `OWNER_CHAT_ID` | Telegram user ID pemilik bot |

## Environment Variable Sensitif (jangan pernah di-log)

| Variable | Kategori |
|----------|----------|
| `TELEGRAM_TOKEN` | Credential bot |
| `DATABASE_URL` | Koneksi database (mengandung password) |
| `REDIS_URL` | Koneksi Redis (mengandung password) |
| `MISTRAL_API_KEY` | API key AI |
| `GROQ_API_KEY` | API key AI |
| `DEEPSEEK_API_KEY` | API key AI |
| `GEMINI_API_KEY` | API key AI |
| `TAVILY_API_KEY` | API key search |
| `DASHBOARD_ADMIN_TOKEN` | Token dashboard |
| `DASHBOARD_WRITE_TOKEN` | Token dashboard |
| `DASHBOARD_DANGER_TOKEN` | Token dashboard |
| `GITHUB_TOKEN` | Token GitHub |
| `GOOGLE_CLIENT_SECRET` | OAuth secret Google |
| `CLOUDFLARE_API_TOKEN` | Token Cloudflare |
| `WEBHOOK_SHARED_SECRET` | Secret webhook |

## Jika Ada Credential Bocor

1. **Rotate immediately**: Segera ganti token/key yang bocor.
2. Untuk TELEGRAM_TOKEN: buat token baru di BotFather, update `.env`, deploy ulang.
3. Untuk DATABASE_URL: reset password database, update di Render dashboard.
4. Untuk API keys: buat key baru di dashboard provider, hapus key lama.
5. Untuk DASHBOARD_ADMIN_TOKEN: ganti dengan nilai baru, update `.env`.
6. Jangan commit credential ke git. Jika sudah terlanjur, force-push hapus dari history.

## Dashboard Token

- **Dashboard token harus berbeda antara dev dan production**.
- Token dev bisa simpel, token production harus kuat (min 32 karakter).
- Jangan gunakan token yang sama untuk environment berbeda.
- Lihat `DEPLOY.md` untuk konfigurasi production.

## Best Practices

- Jangan pernah menyimpan `.env` di git.
- Jangan pernah me-log nilai environment variable sensitif.
- Gunakan `[REDACTED_SECRET]` untuk menggantikan nilai sensitif di log.
- Semua aksi write/external/danger harus melalui Evaluation v2 + executor approval.
- Rate limiting aktif untuk mencegah spam dan abuse.
- Audit log mencatat semua aksi admin dan perubahan konfigurasi.

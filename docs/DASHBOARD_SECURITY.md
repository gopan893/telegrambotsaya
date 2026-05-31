# Dashboard Security

Dashboard Phase 11 memakai token admin sederhana untuk endpoint data.

## Auth

Endpoint protected membutuhkan header:

```bash
Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>
```

Endpoint public hanya:

- `/dashboard`
- `/api/dashboard/health`

Endpoint lain akan menolak request tanpa token.

## Env

Required untuk dashboard protected:

- `DASHBOARD_ENABLED=true`
- `DASHBOARD_ADMIN_TOKEN=<token-panjang>`
- `DASHBOARD_WRITE_TOKEN=<opsional>`
- `DASHBOARD_DANGER_TOKEN=<opsional>`

Jika dashboard disabled, endpoint protected return `403`.
Jika token belum diset, endpoint protected return `401`.

## Masking

Serializer dan guard dashboard menyembunyikan:

- `TELEGRAM_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- AI provider API keys
- `DASHBOARD_ADMIN_TOKEN`
- Authorization header
- connection string
- `rediss://` Redis TLS connection string
- Groq `gsk_...` key
- Tavily `tvly_...` key
- generic bearer token

`/api/dashboard/env-check` hanya mengembalikan `set` atau `missing`.

## Storage Health Sanitization

Endpoint health/storage tidak pernah mengembalikan URL database/cache asli. Field yang boleh tampil:

- configured/available
- status
- latency
- table readiness
- safe error message
- recommended fix

`DATABASE_URL`, `REDIS_URL`, username/password, token, dan credential lain selalu diringkas menjadi status aman.

## LocalStorage Risk

Token disimpan di `localStorage` browser agar admin tidak perlu login ulang. Risiko:

- Siapa pun yang memakai browser yang sama bisa mengakses dashboard.
- Extension browser yang berbahaya bisa membaca localStorage.

Mitigasi:

- Jangan pakai dashboard di device publik.
- Logout setelah selesai.
- Rotate token jika pernah dibagikan atau dicurigai bocor.

## Safe Actions

Action dashboard dibatasi:

- Tidak menjalankan shell command.
- Tidak mengubah environment.
- Tidak hard-delete memory/goal/workflow user.
- Archive/restore memakai soft delete dan confirmation word.
- Permission bertingkat: read, write, danger, ops.
- `DASHBOARD_ADMIN_TOKEN` mendapat akses penuh.
- Rate limit 10 request per menit per IP/token hash.
- Semua action sukses masuk audit log.
- Phase 12 menambahkan export report yang hanya mengembalikan data sanitized.
- Phase 13 menambahkan kontrol aman untuk memory, goal, workflow, dan audit log.

## Known Limitations

- Belum ada multi-user dashboard auth.
- Belum ada session expiry server-side.
- Token masih bearer stateless, bukan OAuth.

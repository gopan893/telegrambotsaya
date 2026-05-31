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

`/api/dashboard/env-check` hanya mengembalikan `set` atau `missing`.

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
- Tidak menghapus memory user.
- Rate limit 10 request per menit per IP/token hash.
- Action berat/destruktif tidak diaktifkan di Phase 11.

## Known Limitations

- Belum ada multi-user dashboard auth.
- Belum ada session expiry server-side.
- Token masih bearer stateless, bukan OAuth.

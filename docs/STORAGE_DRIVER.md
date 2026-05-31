# Storage Driver

Phase 13 memperjelas pemilihan storage aktif agar dashboard dan command Telegram tidak ambigu saat PostgreSQL tersedia tetapi bot masih memakai JSON fallback.

## Env

```env
STORAGE_DRIVER=auto
DATABASE_URL=
REDIS_URL=
RUN_MIGRATIONS=true
PGSSL=false
```

Nilai `STORAGE_DRIVER`:

| Nilai | Perilaku |
| --- | --- |
| `json` | Paksa JSON fallback. PostgreSQL tidak dipakai sebagai persistent store. |
| `postgres` | Coba PostgreSQL. Jika gagal, bot tetap fallback aman ke JSON dan melaporkan alasannya. |
| `auto` | Pakai PostgreSQL jika `DATABASE_URL` valid, migration sukses, dan tabel siap. Jika tidak, pakai JSON. |

## Status Shape

Storage status aman yang ditampilkan dashboard dan `/dbstatus` berisi:

```json
{
  "configuredDriver": "auto",
  "activeDriver": "postgres",
  "driver": "postgres",
  "postgres": {
    "configured": true,
    "available": true,
    "tableReady": true,
    "status": "connected",
    "latencyMs": 12,
    "recommendedFix": "No action needed"
  },
  "redis": {
    "configured": false,
    "available": false,
    "status": "missing_env",
    "latencyMs": null
  },
  "fallbackActive": false,
  "fallbackReason": null,
  "jsonFallbackAvailable": true
}
```

Credential seperti `DATABASE_URL`, `REDIS_URL`, token, password, dan API key tidak pernah ditampilkan.

## Render Checklist

1. Set `STORAGE_DRIVER=auto`.
2. Set `DATABASE_URL` jika ingin memakai PostgreSQL.
3. Set `RUN_MIGRATIONS=true`.
4. Deploy ulang.
5. Cek `/dbstatus` atau `/api/dashboard/health`.
6. Jika `activeDriver=json` padahal PostgreSQL tersedia, lihat `fallbackReason` dan `postgres.recommendedFix`.

## Fallback

Jika PostgreSQL gagal konek, migration gagal, atau `DATABASE_URL` kosong:

- Bot tetap start.
- Telegram command tetap jalan.
- Dashboard tetap bisa dibuka.
- `activeDriver` menjadi `json`.
- `fallbackReason` menjelaskan alasan aman tanpa membocorkan secret.


# Phase 12 Dashboard Tests

## Automated

```bash
node --check telebot.js
node scratch/test-postgres-health-dashboard.js
node scratch/test-redis-health-dashboard.js
node scratch/test-phase12-dashboard-ux.js
node scratch/test-dashboard-export-security.js
node scratch/test-dashboard-actions-v2.js
```

## Manual Telegram

- `/dashboard`
- `/dashboardstatus`
- `/dbstatus`
- `/redisstatus`
- `/help`

Expected:

- Token tidak pernah tampil.
- `DATABASE_URL` dan `REDIS_URL` tidak pernah tampil.
- PostgreSQL status menjelaskan connected/missing/migration/timeout.
- Redis status menjelaskan connected/missing/TLS/timeout/fallback.

## Manual Browser

- `GET /dashboard`
- `GET /api/dashboard/health`
- `GET /api/dashboard/storage` tanpa token harus `401`.
- `GET /api/dashboard/storage` dengan bearer token menampilkan JSON sanitized.
- `POST /api/dashboard/actions/report/export-health` dengan bearer token mengembalikan report sanitized.
- Overview tidak menampilkan `Redis Available: -`.
- Graph tab menampilkan SVG atau empty state aman.

## Render Checklist

- `DASHBOARD_ENABLED=true`
- `DASHBOARD_ADMIN_TOKEN` set
- `DATABASE_URL` optional
- `REDIS_URL` optional
- Jika PostgreSQL/Redis tidak tersedia, fallback tetap aktif dan dashboard tetap bisa dibuka.

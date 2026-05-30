# Phase 9 Dashboard/API Tests

## Automated

```bash
node --check telebot.js
node --check src/dashboard/index.js
node --check src/dashboard/dashboard-routes.js
node --check src/dashboard/dashboard-auth.js
node --check src/dashboard/dashboard-serializers.js
node --check src/dashboard/dashboard-guards.js
node --check src/dashboard/dashboard-utils.js
node --check src/natural-language/natural-tool-router.js
node scratch/test-dashboard-api.js
node scratch/test-natural-tool-router.js
```

## Telegram Manual

| Step | Input | Expected |
| --- | --- | --- |
| 1 | `/cuaca Tokyo` | Command lama tetap memakai weather tool. |
| 2 | `Cuaca di Tokyo` | Natural route memakai `getWeather("Tokyo")`. |
| 3 | `Supaya bisa online gimana?` | Menjelaskan tool/API OpenWeather dan Tavily. |
| 4 | `Cari berita AI terbaru` | Natural route memakai Tavily jika key tersedia. |
| 5 | `Halo` | Tidak masuk tool router. |
| 6 | `25*4` | Kalkulator tetap jalan. |
| 7 | `750jam berapa hari?` | Unit conversion tetap jalan. |
| 8 | `/dashboard` | Menampilkan URL dashboard dan health endpoint. |
| 9 | `/dashboardstatus` | Menampilkan enabled/token set/missing tanpa token asli. |
| 10 | `dashboard nya dimana?` | Menjawab link dashboard dan warning auth. |
| 11 | `cara cek health bot?` | Menjawab endpoint health dan /dashboard. |

## Browser/API Manual

| Step | Request | Expected |
| --- | --- | --- |
| 1 | `GET /dashboard` | HTML minimal tampil. |
| 2 | `GET /api/dashboard/health` | Public JSON aman. |
| 3 | `GET /api/dashboard/summary` tanpa token | `401`. |
| 4 | `GET /api/dashboard/summary` dengan `Authorization: Bearer <token>` | JSON sanitized. |
| 5 | `GET /api/dashboard/env-check` dengan token | Hanya `set`/`missing`. |
| 6 | `GET /api/dashboard/user/<id>/graph/search?q=memory` dengan token | Node/edge sanitized, tidak ada secret. |

## Safety Checklist

- Tidak ada `DATABASE_URL`, `REDIS_URL`, `TELEGRAM_TOKEN`, atau API key di response.
- Endpoint protected disabled jika `DASHBOARD_ENABLED=false`.
- Endpoint protected `401` jika token missing/salah.
- Dashboard module error tidak boleh menghentikan bot Telegram.

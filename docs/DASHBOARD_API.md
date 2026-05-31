# Dashboard API

Phase 9 menambahkan fondasi Dashboard/API read-only untuk melihat status AI OS, memory, goal, workflow, insight, graph, ops, dan health tanpa membangun frontend berat.

## Env

```env
DASHBOARD_ENABLED=false
DASHBOARD_ADMIN_TOKEN=
```

Endpoint publik:

- `GET /dashboard`
- `GET /api/dashboard/health`

Endpoint data user dan ops membutuhkan token admin:

```http
Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>
```

Jika `DASHBOARD_ADMIN_TOKEN` belum diset, endpoint protected akan mengembalikan `401`.

## Endpoint

Public-safe:

```text
GET /dashboard
GET /api/dashboard/health
```

Protected:

```text
GET /api/dashboard/summary
GET /api/dashboard/user/:userId/overview
GET /api/dashboard/user/:userId/memories?q=&type=&limit=
GET /api/dashboard/user/:userId/goals
GET /api/dashboard/user/:userId/workflows
GET /api/dashboard/user/:userId/insights
GET /api/dashboard/user/:userId/graph
GET /api/dashboard/user/:userId/graph/search?q=<query>
GET /api/dashboard/ops
GET /api/dashboard/commands
GET /api/dashboard/env-check
```

## Contoh Curl

Health publik:

```bash
curl https://your-render-url.onrender.com/api/dashboard/health
```

Summary protected:

```bash
curl \
  -H "Authorization: Bearer $DASHBOARD_ADMIN_TOKEN" \
  https://your-render-url.onrender.com/api/dashboard/summary
```

Env check protected:

```bash
curl \
  -H "Authorization: Bearer $DASHBOARD_ADMIN_TOKEN" \
  https://your-render-url.onrender.com/api/dashboard/env-check
```

Output `env-check` hanya `set` atau `missing`, tidak pernah value asli.

## Keamanan

- Jangan share `DASHBOARD_ADMIN_TOKEN`.
- Jangan set token pendek/mudah ditebak.
- Endpoint user data selalu protected.
- Serializer memotong text panjang dan meredaksi token, API key, password, secret, dan connection string.
- Dashboard tidak menampilkan `DATABASE_URL`, `REDIS_URL`, `TELEGRAM_TOKEN`, atau API key.

## Render Deployment

1. Tambahkan env:
   - `DASHBOARD_ENABLED=true`
   - `DASHBOARD_ADMIN_TOKEN=<random-long-token>`
2. Pastikan `WEBHOOK_URL` atau `TELEGRAM_WEBHOOK_URL` mengarah ke URL Render.
3. Redeploy service.
4. Cek:
   - `/dashboard`
   - `/api/dashboard/health`
   - `/api/dashboard/summary` tanpa token harus `401`
   - `/api/dashboard/summary` dengan token harus JSON sanitized

## Known Limitations

- Belum ada frontend React/Next.js.
- Endpoint saat ini read-only.
- Summary total untuk data relational masih foundation-level; dashboard detail per user lebih akurat.
- Tidak ada role-based auth granular; hanya admin token tunggal.

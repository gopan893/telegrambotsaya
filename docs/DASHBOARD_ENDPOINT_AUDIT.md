# Dashboard Endpoint Audit

## Authentication Layer

**File**: `src/dashboard/dashboard-auth.js`
**File**: `src/dashboard/dashboard-guards.js`

### Proteksi Token

| Endpoint Pattern | Butuh Token? | Middleware | Catatan |
|-----------------|:---:|-----------|---------|
| `/api/dashboard/*` | Ya | `requireDashboardAuth` | Semua endpoint dashboard API |
| `/api/dashboard/health` | Tidak | — | Public health check |
| `/api/dashboard/public/*` | Tidak | — | Static/public data |
| `/dashboard` | Ya | Dashboard serves HTML, auth via API | SPA frontend |
| `/` | Tidak | — | Root redirect |

### Level Token

| Token | Level Akses |
|-------|-------------|
| `DASHBOARD_ADMIN_TOKEN` | Admin penuh — semua operasi |
| `DASHBOARD_WRITE_TOKEN` | Write — bisa membuat/mengubah data, tidak bisa danger actions |
| `DASHBOARD_DANGER_TOKEN` | Danger — aksi berisiko tinggi seperti shutdown |

### Middleware Guards (`dashboard-guards.js`)

| Middleware | Fungsi |
|-----------|--------|
| `requireDashboardEnabled()` | Pastikan `DASHBOARD_ENABLED=true` |
| `requireDashboardAuth()` | Validasi Bearer token |
| `rateLimitDashboardAction()` | 10 request per menit per IP/token |
| `safeDashboardResponse()` | Redact secret sebelum response |
| `preventSecretLeak()` | Filter semua response untuk secret patterns |

### Endpoint yang Tidak Dilindungi (Public)

- `/api/dashboard/health` — health check dasar
- Static assets di `/public/`

### Endpoint yang Dilindungi

Semua endpoint di `src/dashboard/*-routes.js` menggunakan `requireDashboardAuth`:

- Agent evaluation, executor, memory, task, runtime routes
- Backup, boundary, cicd routes
- Coding workspace, consolidation routes
- Cost, council, decision routes
- Deploy, devgovernance, devices routes
- Disaster recovery, docs-intel routes
- Evaluation, executor routes
- GitHub Ops, governance routes
- Improvement, integration execution routes
- Knowledge, lifeos, long-term-planning routes
- Mobile, model-router, monitoring routes
- Observability, operating-loop, operator routes
- Performance, planner, plugin-hardening, plugin routes
- Portfolio, post-v2, privacy, production-release routes
- PWA, rag-kb, rag-quality, recipe routes
- Registry-v2, registry-v3, release-candidate routes
- Reliability, research, routine routes
- Security, selfhealing, soft-delete, stabilization routes
- Telegram-control, tool routes
- V2-planning, v2-production, v2-release, v2-stabilization routes
- V3-blueprint, v3-planning routes
- Workflow-studio, workspace routes
- dashboard-actions, dashboard-routes, safe-actions routes

### Rekomendasi

1. Hanya endpoint `/api/dashboard/health` yang boleh public.
2. Semua endpoint lain wajib token.
3. IP allowlist opsional (via `DASHBOARD_ALLOWED_IPS`) untuk proteksi tambahan.
4. Security headers (helmet) harus ditambahkan di dashboard Express app.
5. Rate limiter sudah aktif — pastikan threshold sesuai untuk production.

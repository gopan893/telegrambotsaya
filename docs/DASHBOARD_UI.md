# Dashboard UI

Phase 11 menambahkan dashboard web vanilla untuk melihat status AI OS dari browser tanpa React/Next.js.
Phase 12 menambahkan health card PostgreSQL/Redis, graph SVG renderer, export report, dan state ringan untuk UX admin.

## Akses

- UI: `https://telegrambotsaya.onrender.com/dashboard`
- Health publik: `/api/dashboard/health`
- Static assets:
  - `/dashboard/styles.css`
  - `/dashboard/api.js`
  - `/dashboard/auth.js`
  - `/dashboard/ui.js`
  - `/dashboard/charts.js`
  - `/dashboard/graph.js`
  - `/dashboard/export.js`
  - `/dashboard/state.js`
  - `/dashboard/utils.js`
  - `/dashboard/app.js`

## Login

1. Set `DASHBOARD_ENABLED=true` di Render.
2. Set `DASHBOARD_ADMIN_TOKEN` dengan token panjang.
3. Deploy ulang.
4. Buka `/dashboard`.
5. Paste token ke form login.

Token disimpan di `localStorage` browser. Jangan share token dan rotate jika pernah bocor.

## Tab

- Overview
- Ops
- Memory
- Goals
- Workflows
- Insights
- Knowledge Graph
- Benchmarks
- Incidents
- Commands
- Env Check
- Settings

## Safe Actions

Dashboard menyediakan action aman:

- Run Diagnostics
- Run Light Benchmark
- Prune Telemetry
- Refresh Ops Snapshot
- Export Health Report
- Export User Summary Report

Action ini protected, butuh token, rate-limited, dan tidak menghapus memory user.

## PostgreSQL dan Redis Health

Overview menampilkan:

- storage driver aktif
- configured storage driver
- PostgreSQL status, table readiness, latency, dan rekomendasi perbaikan
- Redis status, latency, fallback memory cache, dan rekomendasi perbaikan

Jika PostgreSQL atau Redis tidak dikonfigurasi, dashboard tetap berjalan dan menampilkan fallback secara eksplisit.

## Graph Visualization

Tab Knowledge Graph memakai SVG renderer ringan di `graph.js`.

- Node diberi warna berdasarkan type.
- Edge menampilkan relationship label.
- Output dibatasi agar Render free tier tetap ringan.
- Jika graph kosong, UI menampilkan empty state tanpa error.

## Export

Health report bisa diunduh dari Overview. Export memanggil safe admin action dan fallback ke data client-side jika action tidak tersedia.

## Troubleshooting

Jika dashboard disabled:

- Pastikan `DASHBOARD_ENABLED=true`.
- Clear build cache & deploy di Render.
- Cek `/api/dashboard/health`.

Jika token belum dikonfigurasi:

- Pastikan `DASHBOARD_ADMIN_TOKEN` terisi.
- Restart/redeploy service.
- Jangan menaruh token di URL.

Jika CSS/JS tidak load:

- Buka langsung `/dashboard/styles.css`.
- Pastikan assets memakai path absolut `/dashboard/...`.
- Jangan membuka file HTML secara lokal.

Jika "server tidak terhubung":

- Buka dashboard dari domain Render, bukan file lokal.
- Pastikan service bot sedang running.
- Cek route health publik.

## Mobile

UI memakai sidebar responsive dan card grid yang mengecil di layar HP. Jika tampilan melebar, reload cache browser setelah deploy.

# Dashboard Stable Release Audit

Tanggal audit: 2026-06-05

## Temuan

Dashboard production menampilkan beberapa halaman yang belum layak menjadi menu utama:

- `Routines`
- `Monitoring`
- `CI/CD`

Penyebabnya:

1. `public/dashboard/index.html` mengekspos tab internal sebagai item sidebar.
2. `public/dashboard/state.js` menandai tab internal sebagai `navVisible: true`, sehingga hash seperti `#monitoring` tetap dianggap route normal.
3. `dashboard_last_tab` dari `localStorage` bisa memulihkan tab internal lama setelah reload.
4. `realtime-monitoring.js` dan `cicd.js` dimuat di shell utama, padahal modul tersebut masih eksperimental dan bergantung pada service runtime khusus.
5. Service worker memakai cache lama, sehingga browser mobile/PWA dapat terus menyajikan asset dashboard sebelum fix.

## Perbaikan

1. Sidebar public hanya menampilkan halaman stabil:
   - Overview
   - Ops Viewer
   - Workspaces
   - Users
   - Permissions
   - Memory
   - Goals
   - Workflows
   - Planner
   - Executor
   - Agents
   - Tools
   - Integrations
   - Backup
   - Insights
   - Knowledge Graph
   - Benchmarks
   - Incidents
   - Audit Log
   - Commands
   - Env Check
   - Settings
   - Agent Evaluation
   - Coding Workspace
   - Release
   - Self-Healing

2. Tab internal yang belum siap tetap ada di registry untuk kompatibilitas modul, tetapi diberi:
   - `navVisible: false`
   - `routeEnabled: false`
   - `internalOnly: true`

3. Router dashboard sekarang:
   - menolak hash internal/unknown sebagai route public,
   - mengarahkannya ke `#overview`,
   - menghapus `dashboard_last_tab` lama jika mengarah ke tab internal.

4. Script eksperimental tidak dimuat default:
   - `realtime-monitoring.js`
   - `cicd.js`

5. Cache PWA dinaikkan ke `telegram-aios-dashboard-static-v31-stable-nav`.

6. Static asset diberi query version `v=20260605-stable` agar browser yang masih memegang cache lama mengambil asset baru.

## Yang Tidak Dihapus

Backend dan modul internal tidak dihapus:

- `src/dashboard/routine-routes.js`
- `src/dashboard/monitoring-routes.js`
- `src/dashboard/cicd-routes.js`
- modul `src/routines`, `src/monitoring`, dan `src/cicd`

Ini sengaja agar fitur tersebut tetap bisa dimatangkan nanti tanpa memutus kompatibilitas fase sebelumnya.

Catatan Phase 32: `Self-Healing` sudah dipromosikan menjadi tab stabil karena panelnya read-only/proposal-only dan diperlukan untuk regression guard.

## Risiko Deployment

- Pengguna yang sudah membuka dashboard lama mungkin perlu reload sekali atau klik `Clear App Cache` di Settings/PWA card.
- Jika browser masih menyimpan service worker lama, versi asset query baru tetap membantu memaksa fetch file baru.
- Endpoint internal tetap protected oleh dashboard auth; perbaikan ini fokus pada UX dan routing public dashboard.

## Verifikasi

Command utama:

```bash
node --check telebot.js
node scratch/test-dashboard-stable-routes.js
node scratch/test-dashboard-router-registry.js
node scratch/test-dashboard-all-menu-routes.js
node scratch/test-dashboard-coding-release-routing.js
node scratch/test-dashboard-agent-routing.js
node scratch/test-pwa-assets.js
```

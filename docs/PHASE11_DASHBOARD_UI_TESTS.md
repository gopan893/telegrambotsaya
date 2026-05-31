# Phase 11 Dashboard UI Tests

## Browser

| Test | Expected |
| --- | --- |
| Open `/api/dashboard/health` | Public JSON, no token required, no secret values |
| Open `/dashboard` | Styled dashboard UI, not raw/default HTML |
| Open `/dashboard/styles.css` | CSS file loads, status 200 |
| Open `/dashboard/app.js` | JS file loads, status 200 |
| Open `/dashboard/api.js` | JS file loads and uses `/api/dashboard` |
| Login with `DASHBOARD_ADMIN_TOKEN` | Overview protected data loads |
| Open `/api/dashboard/summary` without token | 401 |
| Open `/api/dashboard/env-check` with token | Only `set`/`missing` |

## Tabs

| Tab | Expected |
| --- | --- |
| Overview | Public health and protected summary if logged in |
| Ops | Health, telemetry, reliability, actions |
| Memory | User-scoped read-only memory list |
| Goals | User-scoped read-only goals |
| Workflows | User-scoped read-only workflows and steps |
| Insights | User-scoped read-only insights |
| Knowledge Graph | Graph stats, nodes, edges, search |
| Benchmarks | Benchmark history and light benchmark action |
| Incidents | Recent incidents read-only |
| Commands | Categorized command catalog and search |
| Env Check | Sanitized env status |
| Settings | Dashboard status, local token, security notes |

## Telegram

- `/dashboard`
- `/dashboardstatus`
- `dashboard dimana?`
- `dashboard tidak bisa login`
- `kenapa token belum dikonfigurasi?`

Expected: bot memberi URL dashboard, health endpoint, status enabled/token set, dan tidak menampilkan token.

## Security

- `TELEGRAM_TOKEN` tidak tampil.
- `DATABASE_URL` tidak tampil.
- `REDIS_URL` tidak tampil.
- Provider API keys tidak tampil.
- `DASHBOARD_ADMIN_TOKEN` tidak tampil.
- Protected endpoint membutuhkan Authorization Bearer token.
- Safe action endpoint rate-limited.

## Mobile

- Sidebar bisa dibuka/tutup.
- Card tidak melebar.
- Table bisa scroll horizontal.
- Login form tetap usable.

## Render Deploy

1. Set `DASHBOARD_ENABLED=true`.
2. Set `DASHBOARD_ADMIN_TOKEN`.
3. Manual Deploy.
4. Clear build cache jika assets lama masih muncul.
5. Test health, UI, static assets, login, dan protected endpoints.

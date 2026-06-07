# Portfolio Dashboard

Dashboard Phase 41 menambahkan tab `Portfolio`.

## Route

- Tab id: `portfolio`
- Hash: `#portfolio`
- API base: `/api/dashboard/portfolio`
- Frontend file: `public/dashboard/portfolio.js`

Aliases dashboard:

- `projects`
- `multi-project`
- `priority`
- `portfolio-manager`
- `roadmap-manager`

## Konten

Tab Portfolio menampilkan:

- Active projects
- Open tasks
- Pending approvals
- Open incidents
- Next recommended action
- Priority ranking
- Risk summary
- Cost summary
- Dependency edges
- Stale/blocked projects
- Weekly report

## Tombol

- `Refresh`: reload snapshot.
- `Generate Weekly Plan`: read-only weekly portfolio plan.
- `Generate Monthly Plan`: read-only monthly portfolio plan.
- `Create Proposal`: membuat action plan/executor proposal bila Evaluation v2 gate aman. Tidak menjalankan aksi.

## API

- `GET /api/dashboard/portfolio`
- `GET /api/dashboard/portfolio/snapshot`
- `GET /api/dashboard/portfolio/projects`
- `GET /api/dashboard/portfolio/health`
- `GET /api/dashboard/portfolio/priorities`
- `GET /api/dashboard/portfolio/dependencies`
- `GET /api/dashboard/portfolio/stale`
- `GET /api/dashboard/portfolio/risk`
- `GET /api/dashboard/portfolio/cost`
- `GET /api/dashboard/portfolio/next-action`
- `POST /api/dashboard/portfolio/weekly-plan`
- `POST /api/dashboard/portfolio/monthly-plan`
- `POST /api/dashboard/portfolio/proposal`
- `GET /api/dashboard/portfolio/report`

Semua endpoint protected dan sanitized. Service worker tetap tidak cache `/api/dashboard/*`.

## Mobile/PWA

Asset version Phase 41 membust cache dashboard agar `portfolio.js` terbaru dipakai browser/PWA.

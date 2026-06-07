# Life OS Dashboard

The dashboard tab is:

- Tab id: `lifeos`
- Hash route: `#lifeos`
- Title: `Life OS`
- Frontend: `public/dashboard/lifeos.js`
- Backend: `src/dashboard/lifeos-routes.js`
- API base: `/api/dashboard/lifeos`

## Features

- daily plan card
- weekly plan action
- personal task list/create/complete
- habit list/create/check-in
- reminder plan list/create
- focus session list/create
- mood/energy note form
- personal goal list/create
- Calendar/Gmail proposal buttons
- Life OS summary/report

## API Endpoints

```text
GET  /api/dashboard/lifeos
GET  /api/dashboard/lifeos/daily
POST /api/dashboard/lifeos/daily
GET  /api/dashboard/lifeos/weekly
POST /api/dashboard/lifeos/weekly
GET  /api/dashboard/lifeos/tasks
POST /api/dashboard/lifeos/tasks
POST /api/dashboard/lifeos/tasks/:id/complete
GET  /api/dashboard/lifeos/habits
POST /api/dashboard/lifeos/habits
POST /api/dashboard/lifeos/habits/:id/checkin
GET  /api/dashboard/lifeos/reminders
POST /api/dashboard/lifeos/reminders
GET  /api/dashboard/lifeos/focus
POST /api/dashboard/lifeos/focus
GET  /api/dashboard/lifeos/goals
POST /api/dashboard/lifeos/goals
POST /api/dashboard/lifeos/mood
POST /api/dashboard/lifeos/integration-proposal
GET  /api/dashboard/lifeos/report
```

All endpoints are protected by dashboard auth and responses are sanitized. The service worker may cache `lifeos.js` as static shell only; it must never cache `/api/dashboard/*`.

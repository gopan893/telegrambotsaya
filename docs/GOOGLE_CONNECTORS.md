# Google Calendar & Gmail Draft Connectors

Phase 28 menambahkan Google connector dalam mode aman.

## Env

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Nilai `GOOGLE_CLIENT_SECRET` tidak pernah tampil di Telegram, dashboard, API, audit, atau export.

## Google Calendar

Read-only:

- `calendar.status`
- `calendar.events.list`

Proposal-only:

- `calendar.event.create`
- `calendar.event.update`

Event create/update hanya menjadi executor proposal. Tidak ada event dibuat saat proposal, dry-run, atau evaluation.

## Gmail

Read-only:

- `gmail.status`

Proposal-only:

- `gmail.draft.create`

Disabled:

- `gmail.send`

Gmail direct send sengaja disabled di v1. Bot hanya menyiapkan draft proposal.

## Telegram

- `/calendar_status`
- `/calendar_events`
- `/gmail_status`
- `/propose_calendar_event <text>`
- `/propose_gmail_draft <text>`

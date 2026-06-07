# Personal Life OS

Phase 44 adds a Personal Productivity / Life OS layer for daily planning, weekly planning, personal tasks, habits, reminders, focus sessions, mood/energy notes, personal goals, and safe personal memory.

The module lives under `src/lifeos/` and is intentionally separate from project automation. It helps plan and reflect, but it does not perform external actions automatically.

## Data Model

Life OS stores sanitized personal items with this shape:

```json
{
  "id": "personal_task_xxx",
  "workspaceId": "default",
  "userId": "123",
  "type": "personal_task",
  "title": "Small task",
  "description": "",
  "status": "todo",
  "priority": "medium",
  "dueAt": "",
  "scheduledAt": "",
  "tags": [],
  "source": "lifeos",
  "sensitivity": "normal",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

Supported types include `personal_task`, `habit`, `reminder`, `focus_session`, `daily_plan`, `weekly_plan`, `personal_goal`, `energy_note`, `mood_note`, `reflection`, `routine`, `calendar_proposal`, and `email_draft_proposal`.

## Safety Boundary

- No direct Gmail send.
- No direct Calendar create/update.
- No external write without approval.
- No diagnosis, therapy, legal, financial, or medical decision-making.
- Sensitive mood/energy notes are private by default.
- Secret-like input is rejected or redacted and must not be stored.

External/write actions must remain:

```text
dry-run -> Evaluation v2 -> executor proposal -> approval -> run
```

## Telegram

Main commands:

- `/lifeos`
- `/daily`
- `/weekly`
- `/today`
- `/tasks`
- `/taskdone <taskId>`
- `/habits`
- `/habitcheck <habitId>`
- `/reminders`
- `/focus`
- `/mood <note>`
- `/energy <note>`
- `/lifegoals`
- `/lifereport`
- `/eveningreview`

Natural chat examples:

- `buat rencana hari ini`
- `apa yang harus saya kerjakan sekarang?`
- `catat mood saya capek hari ini`
- `buat rutinitas belajar coding tiap malam`
- `jadwalkan meeting besok`
- `buat draft email untuk klien`

Calendar/Gmail/routine requests create proposals only.

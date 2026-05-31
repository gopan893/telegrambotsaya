# Long-Term Planner

Phase 15 menambahkan planner ringan untuk membuat roadmap, menghubungkan goal/workflow, dan memilih next action tanpa menjalankan aksi eksternal otomatis.

## Model Plan

Plan disimpan dengan key storage:

```text
planner_sessions
```

Field utama:

| Field | Keterangan |
| --- | --- |
| `id` | ID plan, contoh `plan_<uuid>`. |
| `workspaceId` | Workspace pemilik data. |
| `userId` | Telegram user pemilik plan. |
| `title` | Judul roadmap. |
| `description` | Ringkasan konteks. |
| `horizon` | `daily`, `weekly`, `monthly`, `quarterly`, atau `yearly`. |
| `status` | `draft`, `active`, `paused`, `completed`, atau `archived`. |
| `linkedGoalIds` | Goal yang terkait. |
| `linkedWorkflowIds` | Workflow yang terkait. |
| `taskIds` | Task orchestration di dalam plan. |
| `assumptions` | Asumsi singkat. |
| `risks` | Risiko singkat. |
| `milestones` | Milestone progres plan. |

Archive bersifat soft archive. Tidak ada hard delete.

## Engine

Module utama:

```text
src/planner/planner-engine.js
```

Fungsi:

- `createPlan`
- `getPlan`
- `listPlans`
- `updatePlan`
- `archivePlan`
- `generatePlanFromGoal`
- `generatePlanFromText`
- `suggestNextActions`
- `summarizePlan`

Semua write action melakukan permission check workspace dan audit log.

## Dashboard

Endpoint protected:

```text
GET  /api/dashboard/planner
POST /api/dashboard/planner/create
GET  /api/dashboard/planner/:planId
POST /api/dashboard/planner/:planId/update
POST /api/dashboard/planner/:planId/archive
GET  /api/dashboard/planner/next-actions
POST /api/dashboard/planner/from-goal
POST /api/dashboard/planner/from-text
```

Dashboard UI punya tab `Planner` untuk load plans, create plan, generate plan from text, add task, mark done, block, archive, dan next actions.

## Telegram

```text
/plans
/plan <planId>
/planadd <title> | <description optional> | <horizon>
/plantasks <planId>
/next
/priorities
```

Natural chat yang memicu planner:

- `apa prioritas saya?`
- `langkah berikutnya apa?`
- `buat roadmap`
- `pecah goal ini jadi task`
- `apa yang harus saya kerjakan minggu ini?`

Sapaan, hitungan sederhana, dan chat umum tidak memicu planner.

## Safety

- Viewer hanya bisa read.
- Editor/admin/owner bisa write.
- Payload mirip secret ditolak.
- Planner tidak menjalankan shell/API/action eksternal.
- Jika storage gagal, fallback memory/JSON dari storage manager tetap dipakai.

Phase 16 dapat menambahkan human-approved autonomous executor, tetapi Phase 15 hanya membuat rencana dan task.

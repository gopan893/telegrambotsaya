# Task Orchestration

Task orchestration memecah plan menjadi pekerjaan kecil yang bisa diprioritaskan dan dilacak.

## Model Task

Task disimpan dengan key:

```text
planner_tasks
```

Field utama:

| Field | Keterangan |
| --- | --- |
| `id` | ID task, contoh `task_<uuid>`. |
| `workspaceId` | Workspace pemilik task. |
| `userId` | User pemilik task. |
| `planId` | Plan parent. |
| `title` | Judul task. |
| `description` | Detail task. |
| `status` | `todo`, `doing`, `blocked`, `done`, atau `archived`. |
| `priority` | `low`, `medium`, `high`, atau `critical`. |
| `priorityScore` | Skor 0-100. |
| `effort` | `small`, `medium`, atau `large`. |
| `impact` | `low`, `medium`, atau `high`. |
| `urgency` | `low`, `medium`, atau `high`. |
| `dependencies` | ID task dependency. |
| `linkedGoalId` | Goal terkait. |
| `linkedWorkflowId` | Workflow terkait. |
| `dueDate` | Deadline optional. |

Archive adalah soft archive. Task lama tetap ada untuk audit/history.

## Priority Scoring

Module:

```text
src/planner/priority-scorer.js
```

Faktor skor:

- impact
- urgency
- effort
- dependency blocker
- dueDate proximity
- linked goal priority
- workspace status
- risk level

Output skor dipakai oleh `/next`, `/priorities`, dan dashboard Planner tab.

## Dependency Detection

Module:

```text
src/planner/dependency-detector.js
```

Deteksi memakai heuristic ringan:

- explicit `dependencies`
- kata seperti `setelah`, `after`, `menunggu`, `butuh`, `requires`, `depends`
- relasi graph `depends_on`, `requires`, atau `blocks`

Tidak ada AI call berat default.

## Milestones

Module:

```text
src/planner/milestone-planner.js
```

Milestone dibuat dari task aktif dan progresnya dihitung dari task `done`. Jika task berubah status, progress milestone bisa diperbarui lewat `updateMilestoneProgress`.

## Telegram Commands

```text
/taskadd <planId> | <task title> | <description optional>
/taskdone <taskId>
/taskblock <taskId> | <reason>
/plantasks <planId>
```

Semua command workspace-aware dan audited.

## Security

- Tidak ada hard delete.
- Tidak ada executor otomatis penuh. Phase 16 hanya mendukung human-approved executor: task bisa dibuat menjadi proposal dengan `/propose <taskId>`, lalu harus `/approve` dan `/runexec` secara eksplisit.
- Payload token/API key/connection string ditolak atau dimask.
- Cross-workspace access ditolak/hidden.
- Write action dicatat di audit log.

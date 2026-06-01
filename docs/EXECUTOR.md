# Human-Approved Executor

Phase 16 menambahkan executor yang bisa mengubah planner task, goal, workflow, atau request dashboard menjadi proposal eksekusi. Executor ini tidak fully autonomous: proposal dibuat dulu, manusia harus approve, lalu run dilakukan sebagai langkah terpisah.

## Prinsip Utama

- Proposal creation tidak menjalankan action.
- Semua write, external, danger, dan irreversible action butuh approval eksplisit.
- Approval tidak otomatis menjalankan action.
- Run hanya boleh untuk proposal dengan status `approved`.
- Tidak ada shell executor, arbitrary JavaScript executor, env/config mutation, hard delete, atau external messaging otomatis.
- Semua action workspace-aware, permission-checked, audited, dan disanitasi.

## Model Proposal

```text
executor_proposals
```

Field utama:

| Field | Keterangan |
| --- | --- |
| `id` | ID proposal, contoh `exec_<uuid>`. |
| `workspaceId` | Workspace pemilik proposal. |
| `userId` | User pemilik data. |
| `sourceType` | `manual`, `planner_task`, `goal`, `workflow`, `ops`, atau `dashboard`. |
| `sourceId` | ID task/goal/workflow sumber. |
| `proposedActions` | Daftar action yang akan dijalankan setelah approved. |
| `riskLevel` | `low`, `medium`, `high`, atau `danger`. |
| `status` | `pending_approval`, `approved`, `rejected`, `running`, `completed`, `failed`, `expired`, atau `cancelled`. |
| `requiresApproval` | Selalu `true` untuk Phase 16. |
| `expiresAt` | Default 24 jam. |

Run dicatat pada:

```text
executor_runs
```

## Safe Action Types

Phase 16 mendaftarkan action aman berikut:

- `planner.task.mark_done`
- `planner.task.mark_blocked`
- `workflow.step.add`
- `workflow.step.done`
- `goal.progress.update`
- `ops.diagnostics.run`
- `ops.benchmark.light`
- `report.health.export`
- `report.user_summary.export`
- `memory.suggest_archive`

`memory.suggest_archive` hanya membuat rekomendasi, bukan archive otomatis.

Phase 17 menambahkan action bridge:

- `tool.run`

`tool.run` hanya menjalankan tool yang sudah terdaftar di Tool Registry, enabled, workspace-aware, permission-valid, dan sudah punya approval eksplisit jika risk/write/external/danger. Proposal tool tetap tidak menjalankan aksi saat dibuat.

## Telegram Commands

```text
/executions
/pending
/propose <taskId>
/approve <proposalId>
/runexec <proposalId>
/reject <proposalId> | <reason>
/cancel_exec <proposalId>
```

Alur umum:

1. `/propose <taskId>`
2. Review proposal dan risk.
3. `/approve <proposalId>`
4. `/runexec <proposalId>`

## Dashboard

Dashboard memiliki tab `Executor`:

- list proposal
- pending approvals
- recent executions
- proposal detail/action preview
- approve/reject/cancel
- run approved
- create manual safe proposal
- propose from planner task

Semua endpoint executor berada di `/api/dashboard/executor` dan protected oleh `DASHBOARD_ADMIN_TOKEN`.

## API

```text
GET  /api/dashboard/executor
GET  /api/dashboard/executor/pending
GET  /api/dashboard/executor/:proposalId
POST /api/dashboard/executor/propose
POST /api/dashboard/executor/propose/from-task
POST /api/dashboard/executor/propose/from-goal
POST /api/dashboard/executor/propose/from-workflow
POST /api/dashboard/executor/:proposalId/approve
POST /api/dashboard/executor/:proposalId/reject
POST /api/dashboard/executor/:proposalId/cancel
POST /api/dashboard/executor/:proposalId/run
GET  /api/dashboard/executor/runs
```

## Security

- Secret-like payload ditolak atau dimask.
- Viewer tidak boleh approve/write.
- Danger risk hanya boleh owner/admin.
- Cross-workspace access ditolak.
- Run melakukan permission check ulang.
- Audit log merekam proposal, approval, rejection, cancel, run, action completed/failed, dan permission denied.

## Limitasi

- Belum ada autonomous executor.
- Belum ada rollback otomatis.
- Belum ada scheduler/daemon execution.
- Tidak ada shell/API eksternal bebas.
- Tool write/external/danger tetap harus melalui approval dan run terpisah.
- Phase 18 direkomendasikan untuk backup/export/import registry dan audit.

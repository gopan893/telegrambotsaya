# Backup Scheduler

Backup scheduler Phase 19 bersifat manual dan approved. Schedule tidak membuat backup tanpa approval eksplisit.

## Model

Schedule menyimpan:

- `workspaceId`
- `userId`
- `name`
- `scope`: `workspace`, `user`, `system_safe`
- `frequency`: `manual`, `daily`, `weekly`, `monthly`
- `enabled`
- `requiresApproval: true`
- `nextRunAt`
- `lastRunAt`
- `lastStatus`

Run menyimpan:

- `scheduleId`
- `status`: `pending_approval`, `approved`, `running`, `completed`, `failed`
- `approvedBy`
- `backupId`

## Flow Approval

1. Buat schedule dari dashboard atau `/backupscheduleadd`.
2. Request run approval dari dashboard.
3. Owner/admin approve run.
4. Run approved backup.
5. Backup baru dibuat dan audit dicatat.

Tidak ada restore/import terjadwal.

## Telegram Commands

- `/backupschedule`
- `/backupscheduleadd <nama> | <scope> | <frequency>`
- `/backupschedules`
- `/backupdue`
- `/backupapprove <runId>`
- `/backuprun <runId>`

## Dashboard

Tab **Backup & Recovery** memiliki panel Scheduler untuk membuat schedule, preview run, request approval, approve run, dan menjalankan run yang sudah approved.

## Security

- Run backup butuh approval eksplisit.
- Approval run hanya owner/admin.
- Scheduler tidak upload ke cloud.
- Scheduler tidak restore/import.
- Semua create/update/archive/approve/run diaudit.

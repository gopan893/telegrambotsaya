# Backup & Recovery

Phase 18 menambahkan backup, export, import, restore plan, disaster recovery check, dan integrity check untuk data AI OS.

## Prinsip

- Backup/export/import/restore protected.
- Restore tidak berjalan otomatis.
- Restore membutuhkan role owner/admin dan confirmation text `RESTORE`.
- Tidak ada hard delete.
- Backup tidak mengekspor env, token, API key, `DATABASE_URL`, `REDIS_URL`, credential, atau authorization header.
- Jika PostgreSQL aktif, backup tersimpan melalui storage manager aktif. Jika PostgreSQL tidak tersedia, JSON fallback tetap dipakai.

## Storage Keys

```text
backup_manifests
backup_snapshots
restore_logs
import_jobs
```

## Backup Scope

| Scope | Isi |
| --- | --- |
| `workspace` | Data aman dalam satu workspace. |
| `user` | Data aman milik user tertentu. |
| `system` | Snapshot aman sistem tanpa secret. |
| `audit` | Audit log sanitized. |
| `full_safe` | Data aman lintas fitur, tetap tanpa secret/env. |

## Data Yang Diikutkan

- workspaces
- memory
- goals
- workflows
- insights
- graph
- planner sessions/tasks
- executor proposals/runs
- tool registry metadata
- audit logs jika diminta

## Data Yang Dikecualikan

- env
- token
- API key
- `DATABASE_URL`
- `REDIS_URL`
- credentials
- authorization headers
- raw private prompt yang terdeteksi sensitif

## Dashboard

Tab `Backup` menyediakan create backup, list backup, validate checksum, export JSON, import validate/preview, restore plan, recovery check, dan integrity check.

## Telegram Commands

```text
/backup
/backupcreate
/backups
/backupstatus
/recovery
/integrity
/exportsummary
```

Telegram hanya memberi summary. Export JSON penuh diarahkan ke dashboard agar output tidak terlalu panjang.

## Restore

```text
validate import/backup
-> preview diff
-> create restore plan
-> run restore dengan confirmationText RESTORE
-> audit log
```

Restore memakai merge/upsert dan tidak melakukan hard delete.

## Security Limits

- Tidak ada cloud upload otomatis.
- Tidak ada database dump raw.
- Tidak ada encryption/KMS kompleks.
- Tidak ada auto restore tanpa approval/confirmation.
- Cross-workspace restore ditolak kecuali owner/admin.

## Phase 19 UX

Tab Backup & Recovery sekarang dipisah menjadi:

- Create Backup
- Download/Export
- Import Preview
- Restore Plan
- Scheduler
- Disaster Recovery
- Integrity Check

Export JSON memakai Blob download di browser dengan filename aman, checksum, dan item counts. Import mendukung paste JSON atau drag/drop file, lalu tetap harus validate dan preview sebelum restore plan dibuat.

## Approved Backup Scheduler

Scheduler tidak menjalankan backup otomatis di background. Flow aman:

```text
create schedule
-> request run approval
-> owner/admin approve
-> run approved backup
-> audit log
```

Lihat `docs/BACKUP_SCHEDULER.md`.

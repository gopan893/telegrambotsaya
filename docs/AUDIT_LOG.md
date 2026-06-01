# Dashboard Audit Log

Phase 13 menambahkan audit log untuk aksi dashboard/admin.

## Storage

Audit disimpan dengan key:

```text
dashboard_audit_logs
```

Jika PostgreSQL aktif, key tersebut tersimpan lewat storage manager. Jika PostgreSQL tidak tersedia, audit fallback ke JSON. Jika storage gagal total, audit memakai fallback in-memory agar action tidak crash.

Limit default:

- Maksimal 1000 entry terbaru.
- Entry lama dipruning otomatis.

## Entry

Setiap entry disanitasi dan berisi:

```json
{
  "id": "audit_...",
  "timestamp": "2026-06-01T00:00:00.000Z",
  "actorType": "dashboard",
  "actorId": "admin",
  "action": "memory/update",
  "targetType": "memory",
  "targetId": "mem_123",
  "userId": "123",
  "workspaceId": "ws_personal_123",
  "actorRole": "owner",
  "permission": "write",
  "decision": "allowed",
  "status": "ok",
  "beforeSummary": {},
  "afterSummary": {},
  "reason": ""
}
```

IP dan user-agent diringkas. Secret, token, API key, connection string, dan payload panjang tidak disimpan penuh.

## Endpoint

```text
GET /api/dashboard/audit
```

Query optional:

```text
action=<action>
status=<ok|rejected|not_found|error>
targetType=<memory|goal|workflow>
userId=<telegramUserId>
workspaceId=<workspaceId>
decision=<allowed|denied>
limit=20
```

Endpoint ini protected dan membutuhkan bearer token.

## Telegram Command

```text
/audit
/audit recent
```

Command ini admin-only. Output tidak menampilkan secret.

## Planner Audit Events

Phase 15 mencatat perubahan planner/task:

```text
planner/plan_created
planner/plan_updated
planner/plan_archived
planner/plan_generated_from_goal
planner/plan_generated_from_text
planner/task_created
planner/task_updated
planner/task_done
planner/task_blocked
planner/task_archived
planner/task_reordered
planner/permission_denied/<permission>
```

Entry menyertakan `workspaceId`, `actorRole`, `permission`, `decision`, dan ringkasan `beforeSummary`/`afterSummary` yang sudah disanitasi.

## Executor Audit Events

Phase 16 mencatat semua perubahan executor:

```text
executor/proposal_created
executor/approval_requested
executor/approved
executor/rejected
executor/cancelled
executor/run_started
executor/action_completed
executor/action_failed
executor/run_completed
executor/run_failed
executor/permission_denied
```

Audit executor menyertakan `workspaceId`, `actorRole`, `proposalId`/`targetId`, risk/action summary, `decision`, dan ringkasan hasil yang sudah disanitasi. Proposal creation tidak menjalankan action; approval dan run dicatat sebagai event terpisah.

## Tool Registry Audit Events

Phase 17 mencatat governance tool:

```text
tool/registered
tool/enabled
tool/disabled
tool/previewed
tool/run_attempted
tool/run_completed
tool/run_failed
tool/proposal_created
tool/permission_denied
tool/approval_required
tool/rate_limited
```

Audit tool menyertakan `workspaceId`, `actorRole`, `toolId`, `actionType`, `riskLevel`, `decision`, dan summary input/output yang sudah disanitasi. Direct run untuk write/external/danger tidak dieksekusi; event-nya dicatat sebagai `approval_required` dan diarahkan ke executor proposal.

## Backup & Recovery Audit Events

Phase 18 mencatat backup/import/restore/recovery:

```text
backup/created
backup/validated
backup/exported
backup/archived
backup/permission_denied
restore/plan_created
restore/run_started
restore/completed
restore/failed
restore/permission_denied
```

Entry menyertakan `workspaceId`, `actorRole`, `backupId` atau `restorePlanId`, scope, decision, dan summary yang sudah disanitasi. Secret/env/API key/connection string tidak disimpan di audit.

## Known Limits

- Belum ada export audit terpisah.
- Belum ada tamper-proof log chain.
- Belum ada retention policy berbasis umur, baru limit jumlah entry.
- Belum ada export audit terpisah per workspace.

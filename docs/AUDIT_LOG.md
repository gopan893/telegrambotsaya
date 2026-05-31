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

## Known Limits

- Belum ada export audit terpisah.
- Belum ada tamper-proof log chain.
- Belum ada retention policy berbasis umur, baru limit jumlah entry.
- Belum ada export audit terpisah per workspace.

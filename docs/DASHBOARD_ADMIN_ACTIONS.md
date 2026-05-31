# Dashboard Admin Actions

Phase 13 menambahkan kontrol admin aman untuk memory, goal, dan workflow dari dashboard/API tanpa memberi bot kemampuan menjalankan aksi berbahaya di server.

Phase 14 menambahkan workspace guard: bearer token tetap diperlukan, lalu setiap action dicek lagi terhadap role actor pada `workspaceId` target.

## Permission

Endpoint protected membutuhkan bearer token:

```http
Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>
```

Level permission:

| Level | Fungsi |
| --- | --- |
| `read` | Membaca summary, storage, graph, env-check, dan audit. |
| `write` | Update non-destruktif seperti edit memory/goal dan tambah step workflow. |
| `danger` | Archive/restore data. |
| `ops` | Akses penuh. `DASHBOARD_ADMIN_TOKEN` selalu mendapat level ini. |

Token masa depan yang sudah disiapkan:

```env
DASHBOARD_WRITE_TOKEN=
DASHBOARD_DANGER_TOKEN=
```

Jika tidak diisi, cukup gunakan `DASHBOARD_ADMIN_TOKEN`.

## Workspace Guard

Payload action dapat membawa:

```json
{
  "actorId": "123456",
  "userId": "123456",
  "workspaceId": "ws_personal_123456"
}
```

Aturan:

- Jika `workspaceId` kosong, data dianggap berada di personal workspace target user.
- Update memory/goal/workflow step butuh workspace permission `write`.
- Archive/restore butuh workspace permission `danger`.
- Actor yang tidak menjadi member workspace akan mendapat `WORKSPACE_PERMISSION_DENIED`.
- Denial dicatat ke audit log dengan `decision=denied`.

## Safe Actions

Endpoint action:

```text
POST /api/dashboard/actions/memory/update
POST /api/dashboard/actions/memory/archive
POST /api/dashboard/actions/memory/restore
POST /api/dashboard/actions/goal/update
POST /api/dashboard/actions/goal/archive
POST /api/dashboard/actions/goal/restore
POST /api/dashboard/actions/workflow/step/add
POST /api/dashboard/actions/workflow/step/done
POST /api/dashboard/actions/workflow/step/reorder
POST /api/dashboard/actions/workflow/archive
POST /api/dashboard/actions/workflow/restore
```

Action archive/restore membutuhkan confirmation word:

| Action | Confirmation |
| --- | --- |
| Archive | `ARCHIVE` |
| Restore | `RESTORE` |

## Safety Rules

- Tidak ada hard delete.
- Archive memakai soft delete (`deletedAt`/`deleted_at`, status `archived` bila relevan).
- Restore mengaktifkan data kembali.
- Semua query PostgreSQL memakai parameterized query.
- Payload berbau secret/token/password/API key ditolak.
- Output action disanitasi dan dipotong.
- Action sukses dicatat ke audit log.
- Action ditolak karena workspace permission juga dicatat ke audit log.
- Jika action gagal, Telegram bot dan dashboard tetap berjalan.

## UI

Dashboard menampilkan kontrol sederhana:

- Memory: copy ID, edit, archive.
- Goal: update progress, update status, archive.
- Workflow: tambah step, tandai step selesai, archive.
- Workspaces: create workspace, pilih active workspace, kelola member, archive.
- Permissions: cek role dan permission actor pada workspace aktif.
- Audit Log: filter action/status/target/user/workspace/decision/limit.

UI masih memakai vanilla HTML/JS agar ringan untuk Render free tier.

# Dashboard Admin Actions

Phase 13 menambahkan kontrol admin aman untuk memory, goal, dan workflow dari dashboard/API tanpa memberi bot kemampuan menjalankan aksi berbahaya di server.

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
- Jika action gagal, Telegram bot dan dashboard tetap berjalan.

## UI

Dashboard menampilkan kontrol sederhana:

- Memory: copy ID, edit, archive.
- Goal: update progress, update status, archive.
- Workflow: tambah step, tandai step selesai, archive.
- Audit Log: filter action/status/target/user/limit.

UI masih memakai vanilla HTML/JS agar ringan untuk Render free tier.


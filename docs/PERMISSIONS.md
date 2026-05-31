# Workspace Permissions

Phase 14 memisahkan dua lapis permission:

1. Dashboard bearer token menentukan akses API dashboard global.
2. Workspace role menentukan data workspace mana yang boleh dibaca/diubah oleh actor.

## Dashboard Token Level

| Token | Level | Fungsi |
| --- | --- | --- |
| `DASHBOARD_ADMIN_TOKEN` | `ops` | Akses dashboard penuh. |
| `DASHBOARD_WRITE_TOKEN` | `write` | Aksi tulis non-destruktif. |
| `DASHBOARD_DANGER_TOKEN` | `danger` | Archive/restore. |

Token tidak pernah ditampilkan di UI/API/Telegram.

## Workspace Role Matrix

| Role | read | write | danger | ops | manage_members | limited_read |
| --- | --- | --- | --- | --- | --- | --- |
| `owner` | yes | yes | yes | yes | yes | yes |
| `admin` | yes | yes | no | yes | yes | yes |
| `editor` | yes | yes | no | no | no | yes |
| `viewer` | yes | no | no | no | no | yes |
| `guest` | no | no | no | no | no | yes |

## Access Rule

- User selalu bisa membaca personal workspace miliknya.
- Untuk workspace project/team/admin, actor harus menjadi member aktif.
- Aksi update butuh `write`.
- Aksi archive/restore butuh `danger`.
- Kelola member butuh `manage_members`.

## Audit

Audit log mencatat:

| Field | Keterangan |
| --- | --- |
| `workspaceId` | Workspace terkait aksi. |
| `actorRole` | Role actor saat aksi. |
| `permission` | Permission yang dibutuhkan. |
| `decision` | `allowed` atau `denied`. |

Gunakan filter:

```text
GET /api/dashboard/audit?workspaceId=<id>&decision=denied
```

## Known Limits

- Auth dashboard masih berbasis bearer token sederhana.
- Belum ada undangan berbasis link/email.
- Belum ada UI granular untuk permission custom per resource.

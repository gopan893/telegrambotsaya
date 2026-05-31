# Multi-User Workspaces

Phase 14 menambahkan workspace ringan untuk memisahkan data user, project, dan akses dashboard tanpa mengganti storage lama.

## Model

Workspace disimpan di storage manager dengan key:

```text
workspaces
```

Jika PostgreSQL aktif, key ini ikut memakai storage aktif PostgreSQL. Jika PostgreSQL tidak tersedia, fallback JSON tetap berjalan.

Workspace memiliki field utama:

| Field | Keterangan |
| --- | --- |
| `id` | ID workspace aman, contoh `ws_personal_<userId>` atau `ws_<uuid>`. |
| `name` | Nama workspace. |
| `description` | Deskripsi singkat. |
| `type` | `personal`, `project`, `team`, atau `admin`. |
| `ownerId` | Telegram user ID owner. |
| `members` | Daftar member aktif/removed dan role. |
| `archivedAt` | Terisi jika workspace diarsipkan. |

Setiap user mendapat personal workspace otomatis. Owner bot juga dapat admin workspace jika `OWNER_CHAT_ID` tersedia.

## Roles

| Role | Keterangan |
| --- | --- |
| `owner` | Kontrol penuh workspace. |
| `admin` | Kelola member, tulis data, ops ringan. |
| `editor` | Baca dan tulis data workspace. |
| `viewer` | Baca data workspace. |
| `guest` | Limited read saja. |

## Dashboard API

Endpoint workspace memakai path:

```text
GET  /api/dashboard/workspaces
POST /api/dashboard/workspaces/create
GET  /api/dashboard/workspaces/:workspaceId
GET  /api/dashboard/workspaces/:workspaceId/members
POST /api/dashboard/workspaces/:workspaceId/members/add
POST /api/dashboard/workspaces/:workspaceId/members/role
POST /api/dashboard/workspaces/:workspaceId/members/remove
POST /api/dashboard/workspaces/:workspaceId/archive
GET  /api/dashboard/permissions/me
GET  /api/dashboard/users
GET  /api/dashboard/users/:userId/overview
```

Semua endpoint di atas butuh bearer token dashboard. Actor permission ditentukan dari `actorId` di query/body. Jika tidak dikirim, server memakai `OWNER_CHAT_ID`.

## Data Guard

Endpoint user data dashboard sekarang menerima `workspaceId`:

```text
GET /api/dashboard/user/:userId/memories?workspaceId=...
GET /api/dashboard/user/:userId/goals?workspaceId=...
GET /api/dashboard/user/:userId/workflows?workspaceId=...
GET /api/dashboard/user/:userId/insights?workspaceId=...
GET /api/dashboard/user/:userId/graph?workspaceId=...
```

Data lama yang belum punya `workspaceId` dianggap milik personal workspace user tersebut agar backward compatible.

## Telegram Commands

```text
/whoami
/workspace
/workspaces
```

`/workspace` tetap menampilkan cognitive workspace lama, tetapi sekarang juga menampilkan workspace permission system.

## Safety

- Tidak ada hard delete workspace.
- Personal workspace tidak bisa diarsipkan.
- Archive workspace butuh confirmation word `ARCHIVE`.
- Semua output dashboard disanitasi dari token/API key/connection string.
- Permission denied dicatat ke audit log dengan `decision=denied`.

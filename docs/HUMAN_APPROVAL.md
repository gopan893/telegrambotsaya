# Human Approval Flow

Human approval adalah guard utama untuk executor Phase 16. Bot boleh menyusun proposal dan preview action, tetapi tidak boleh menjalankan write/external/danger action tanpa persetujuan eksplisit.

## Flow

```text
planner task / goal / workflow / dashboard request
-> execution proposal
-> pending_approval
-> approve/reject/cancel
-> run approved proposal
-> audit result
```

Tool Registry Phase 17 memakai flow yang sama:

```text
toolpropose / dashboard tool propose
-> execution proposal dengan action tool.run
-> pending_approval
-> approve
-> runexec
```

Approval dan run sengaja dipisah:

- `approve` hanya mengubah status menjadi `approved`.
- `runexec` atau tombol `Run Approved` baru menjalankan action.
- Proposal expired, rejected, cancelled, failed, atau completed tidak bisa dijalankan.

## Permission

| Role | Read | Create Proposal | Approve Low/Medium/High | Approve Danger |
| --- | --- | --- | --- | --- |
| owner | yes | yes | yes | yes |
| admin | yes | yes | yes | yes |
| editor | yes | yes | yes | no |
| viewer | yes | no | no | no |
| guest | limited | no | no | no |

Semua permission dievaluasi terhadap `workspaceId`. Jika tidak ada workspaceId, sistem memakai personal default workspace user.

## Risk

- `low`: report/export/rekomendasi read-like.
- `medium`: update task/goal/workflow ringan.
- `high`: aksi write lebih sensitif.
- `danger`: archive/delete-like/dangerous request, hanya owner/admin.

## Yang Tidak Boleh di Phase 16

- Shell command execution.
- Arbitrary JavaScript/code execution.
- Hard delete.
- Env/config mutation.
- External messaging otomatis.
- Menyimpan atau menampilkan token/API key/DATABASE_URL/REDIS_URL.
- Menjalankan tool write/external/danger tanpa proposal dan approval.

## Audit

Event yang dicatat:

- proposal created
- approval requested
- approved
- rejected
- cancelled
- run started
- action completed
- action failed
- run completed
- run failed
- permission denied
- tool proposal created
- tool approval required

Audit output disanitasi agar secret tidak bocor.

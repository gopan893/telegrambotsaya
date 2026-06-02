# Approval Flow

Approval flow menjaga agar agent tidak berubah menjadi executor otomatis.

## Urutan Wajib

1. Agent membuat action plan.
2. Preflight mengecek risk, secret, duplicate, unsupported action, dan workspace.
3. Executor proposal dibuat dengan status `pending_approval`.
4. Human approver menjalankan `/approve <proposalId>`.
5. Setelah approved, human menjalankan `/runexec <proposalId>`.

Approval tidak pernah otomatis menjalankan action.

## Siapa Yang Boleh Approve

- Low/medium/write: owner, admin, editor jika permission workspace sesuai.
- Danger: owner/admin.
- Agent actor seperti `agent:executor` tidak boleh approve.

## Command

```text
/pending
/approve <proposalId>
/reject <proposalId> | <reason>
/runexec <proposalId>
/cancel_exec <proposalId>
/proposalstatus <proposalId>
```

## Batasan

- Tidak ada shell executor.
- Tidak ada arbitrary code execution.
- Tidak ada env/config mutation.
- Tidak ada restore/import langsung dari natural chat.

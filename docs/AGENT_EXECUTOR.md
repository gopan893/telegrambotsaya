# Agent Executor Bridge

Phase 25 menghubungkan multi-agent reasoning dengan human-approved executor.

## Prinsip

- Agent boleh membuat action plan.
- Agent boleh membuat execution proposal.
- Agent tidak boleh approve.
- Agent tidak boleh run.
- Proposal creation tidak menjalankan action.
- Approval dan run tetap dua langkah: `/approve`, lalu `/runexec`.

## Flow

```text
natural chat / decision / council / delegation / task
-> action intent detector
-> action plan
-> executor preflight
-> execution proposal
-> human approve
-> human run
-> result routed back to source
```

## Contoh

User:

```text
jalankan backup sekarang
```

Bot:

```text
Saya buat proposal: Backup workspace.
Status: pending_approval.
Belum dijalankan.
Approve: /approve exec_xxx
Run setelah approve: /runexec exec_xxx
```

## Guard

- Secret-like payload ditolak.
- Shell/code/env/config unsupported.
- Restore/import dibuat sebagai request berisiko dan tetap butuh dashboard confirmation flow.
- High/danger membutuhkan security review dan owner/admin.
- Semua proposal/action diaudit.

# GitHub Connector

Connector `github` menyediakan akses GitHub aman untuk Phase 28.

## Env

```env
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
```

Dashboard/API hanya menampilkan status configured, owner, dan repo. Nilai `GITHUB_TOKEN` tidak pernah dikembalikan.

## Actions

Read-only:

- `github.status`
- `github.repo.info`
- `github.issues.list`

Proposal-only:

- `github.issue.create`
- `github.pr.create`
- `github.comment.create`

Write action hanya membuat executor proposal setelah preflight, dry-run, dan Evaluation Gate v2.

## Telegram

- `/github_status`
- `/github_issues`
- `/propose_github_issue <title/description>`

Jika env belum lengkap, read-only status memberi setup plan aman. Write action diblokir sampai env connector siap.

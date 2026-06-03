# External Integrations

External integrations Phase 28 memakai satu model:

- Connector metadata dan status aman.
- Read-only action dapat berjalan langsung.
- Write/external/danger action menjadi proposal executor.
- Proposal hanya dibuat setelah preflight, dry-run, connector quality gate, dan Evaluation Gate v2.
- Approval dan run tetap eksplisit dari manusia.

## Connector

| Connector | Read-only | Proposal-only |
| --- | --- | --- |
| GitHub | status, repo info, issues list | create issue, create PR, comment |
| Google Calendar | status, events list | create/update event |
| Gmail | status | create draft |
| Cloudflare/NAS | tunnel/NAS diagnostics | config change |
| Webhook | status, validate, preview | send webhook |

## Env Optional

```env
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPO=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
NAS_BASE_URL=
NAS_HEALTH_URL=
EXTERNAL_WEBHOOK_URL=
WEBHOOK_SHARED_SECRET=
```

Jika env connector tidak lengkap, connector berada dalam degraded/read-only setup mode dan write action diblokir aman.

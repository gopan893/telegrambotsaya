# Portfolio Security

Phase 41 mengikuti boundary keamanan yang sama dengan executor, integration gate, deploy gate, dan observability.

## Boundary

- Scan, ranking, report, dan weekly/monthly plan adalah read-only.
- Write/external/danger action menjadi action plan/proposal.
- Proposal creation tidak menjalankan aksi.
- Approval dan run tetap terpisah:
  - `/approve <proposalId>`
  - `/runexec <proposalId>`
- Agent/bot tidak boleh self-approve.
- Shell/code executor tidak ada.
- Direct GitHub push, workflow dispatch, Render deploy, dan rollback tidak dijalankan dari runtime bot.

## Evaluation Gate

`portfolio-proposal-bridge` menjalankan Evaluation v2 gate sebelum membuat proposal untuk action medium/high/danger.

Jika Evaluation v2 tidak tersedia atau gagal, proposal berisiko diblokir dengan status aman seperti `EVALUATION_GATE_REQUIRED`.

## Secret Handling

Portfolio sanitizer memakai dashboard guard untuk mencegah output berisi:

- token
- secret
- password
- api_key
- Authorization/Bearer
- DATABASE_URL/REDIS_URL
- postgresql://, rediss://
- sk-, ghp_, github_pat_, gsk_, tvly_
- TELEGRAM_TOKEN, GITHUB_TOKEN, RENDER_DEPLOY_HOOK

## Dashboard/API

Endpoint `/api/dashboard/portfolio/*` protected oleh dashboard auth. Error optional module dikembalikan sebagai response degraded/safe, bukan crash.

## Known Limitations

- Dependency detection masih heuristic.
- Tidak ada vector database atau deep project graph khusus Portfolio.
- Cost signal memakai fallback ops cost optimizer bila Cost Guard khusus belum tersedia.

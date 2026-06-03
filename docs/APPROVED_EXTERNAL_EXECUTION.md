# Approved External Execution

Phase 28 menambahkan jalur eksekusi integrasi eksternal yang tetap human-approved.

## Prinsip

- Read-only connector boleh berjalan langsung setelah permission, rate limit, dan quality gate.
- Write/external/danger connector tidak pernah berjalan langsung.
- Write/external/danger connector wajib melewati:
  1. Integration proposal pipeline dibuat.
  2. Preflight permission + connector quality gate.
  3. Dry-run connector tanpa mutasi eksternal.
  4. Agent Evaluation Gate v2.
  5. Executor proposal dibuat.
  6. User menjalankan `/approve <proposalId>`.
  7. User menjalankan `/runexec <proposalId>`.

Approval dan run tetap dua langkah terpisah. Agent tidak bisa self-approve.

## Connector v1

- `github`: status/repo/issues read-only, issue/PR/comment proposal-only.
- `google_calendar`: status/events read-only, event create/update proposal-only.
- `gmail`: status read-only, draft create proposal-only, direct send disabled.
- `cloudflare_nas`: tunnel/NAS diagnostics read-only, config change proposal-only.
- `webhook`: status/payload preview read-only, send proposal-only.

## Dashboard API

Protected endpoints tersedia di `/api/dashboard/integrations/*`.

- `POST /integrations/execute`: read-only only.
- `POST /integrations/dry-run`: connector dry-run, no mutation.
- `POST /integrations/propose`: creates executor proposal only after gates pass.
- `POST /integrations/pipeline/create`
- `POST /integrations/pipeline/:id/preflight`
- `POST /integrations/pipeline/:id/dry-run`
- `POST /integrations/pipeline/:id/evaluate`
- `POST /integrations/pipeline/:id/create-proposal`

Semua response disanitasi dan tidak mengembalikan token/env secret.

## Telegram

- `/connector_status <connectorId>`
- `/connector_quality <connectorId>`
- `/github_status`
- `/github_issues`
- `/calendar_status`
- `/calendar_events`
- `/gmail_status`
- `/nas_status`
- `/webhook_preview <payload>`
- `/propose_github_issue <text>`
- `/propose_calendar_event <text>`
- `/propose_gmail_draft <text>`
- `/propose_webhook <text>`
- `/integration_pipeline <pipelineId>`
- `/integration_eval <pipelineId>`

Natural chat seperti `buat issue GitHub untuk bug deploy Render` membuat proposal, bukan menjalankan aksi eksternal.

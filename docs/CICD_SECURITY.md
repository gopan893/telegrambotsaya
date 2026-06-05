# CI/CD Security

CI/CD Phase 33 mengikuti batasan production safety:

- Tidak ada direct deploy.
- Tidak ada direct workflow dispatch.
- Tidak ada direct GitHub push/PR/issue dari runtime bot.
- Tidak ada shell executor.
- Tidak ada secret di response dashboard, Telegram, WebSocket, atau audit.
- Semua write/external/danger action harus melewati Evaluation v2 dan executor approval.

## Env

`GITHUB_TOKEN` atau `GH_TOKEN` bersifat optional. Jika tidak tersedia, status GitHub Actions mengembalikan setup plan tanpa crash.

## Telegram

- `/cicd`
- `/cicd_status`
- `/github_actions`
- `/propose_workflow <workflowId>`
- `/propose_deploy`

Command proposal tidak menjalankan dispatch/deploy. User tetap harus approve dan run proposal secara eksplisit.

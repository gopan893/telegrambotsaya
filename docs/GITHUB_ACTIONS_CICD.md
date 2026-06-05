# GitHub Actions CI/CD

Phase 33 menambahkan fondasi CI/CD yang aman.

## Workflows

- `.github/workflows/ci.yml`
- `.github/workflows/release-check.yml`
- `.github/workflows/dashboard-regression.yml`

Workflow memakai Node.js 20, menjalankan syntax check, dan menjalankan scratch tests yang tersedia melalui `scratch/run-existing-tests.js`.

## Dashboard

Tab `CI/CD` menampilkan status release/proposal/pipeline dan GitHub Actions setup status.

Endpoint protected:

- `GET /api/dashboard/cicd`
- `GET /api/dashboard/cicd/status`
- `GET /api/dashboard/cicd/workflows`
- `GET /api/dashboard/cicd/runs`
- `POST /api/dashboard/cicd/workflow-dispatch/propose`
- `POST /api/dashboard/cicd/deploy/propose`
- `GET /api/dashboard/cicd/quality-gates`

## Proposal Only

Workflow dispatch dan deploy tidak pernah dijalankan langsung dari dashboard atau Telegram. Keduanya hanya membuat proposal executor dan tetap butuh Evaluation v2, `/approve`, lalu `/runexec`.

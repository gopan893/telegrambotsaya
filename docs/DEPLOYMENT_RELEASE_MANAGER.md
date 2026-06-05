# Deployment Release Manager

## Overview
The Deployment Release Manager manages the full lifecycle of a release: from candidate creation through Render deploy gate, deploy plan/proposal, post-deploy monitoring, and rollback.

## Flow
1. Release candidate created (branch, commit SHA, message)
2. Secret scan run (via Phase 35 githubops)
3. Render deploy gate checks (start script, deps, env, port binding)
4. Env check (required + optional env names — never values)
5. Startup check (syntax, deps, ESM mismatch)
6. Release gate evaluation
7. Evaluation v2 run
8. Deploy plan created
9. Deploy proposal created (requires executor approval)
10. User approves → deploy runs
11. Post-deploy checks run
12. If failed → rollback plan/proposal created

## Module Summary
| File | Purpose |
|---|---|
| `deploy-utils.js` | `now()`, `shortId()`, `maskSecrets()`, `sanitizeEnvReport()` |
| `deploy-release-store.js` | In-memory store for candidates, plans, proposals, reports |
| `release-candidate-manager.js` | CRUD for release candidates |
| `render-deploy-gate.js` | Render deploy readiness checks |
| `render-env-checker.js` | Required/optional env name checks |
| `render-startup-checker.js` | Syntax, dep, ESM checks |
| `deploy-plan-generator.js` | Deploy plan creation and validation |
| `deploy-proposal-builder.js` | Deploy proposal via executor |
| `post-deploy-monitor.js` | Post-deploy health checks |
| `rollback-plan-generator.js` | Rollback plan and proposal creation |
| `deploy-result-router.js` | Summary/stats router |

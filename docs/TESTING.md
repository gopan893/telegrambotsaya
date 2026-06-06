# TESTING.md

## Mandatory Pre/Post-Check

Always run before and after any change:

```bash
node --check telebot.js
```

## Syntax Checks (fast)

```bash
node --check telebot.js
node --check src/bot/app.js
node --check src/dashboard/dashboard-routes.js
node --check src/dashboard/index.js
```

## Dashboard Router Tests

```bash
node scratch/test-dashboard-router-registry.js
node scratch/test-dashboard-all-menu-routes.js
node scratch/test-dashboard-dark-form-ui.js
```

## Natural Chat / Agent Routing Tests

```bash
node scratch/test-natural-chat-stable-release.js
node scratch/test-natural-chat-domain-routing.js
node scratch/test-natural-chat-guard.js
```

## Executor Boundary Tests

```bash
node scratch/test-executor-boundary-stable-release.js
node scratch/test-executor-safety-guard.js
node scratch/test-executor-preflight-review.js
```

## Integration Gate Tests

```bash
node scratch/test-integration-gate-stable-release.js
node scratch/test-integration-evaluation-gate.js
node scratch/test-integration-gate-guard.js
```

## Coding Workspace Tests

```bash
node scratch/test-coding-workspace-stable-release.js
node scratch/test-coding-request-classifier.js
```

## Self-Healing Tests

```bash
node scratch/test-selfhealing-health-suite.js
node scratch/test-selfhealing-dashboard-api.js
node scratch/test-selfhealing-natural-chat.js
```

## Phase 36 Deploy Tests

```bash
node scratch/test-render-deploy-gate.js
node scratch/test-render-env-checker.js
node scratch/test-render-startup-checker.js
node scratch/test-release-candidate-manager.js
node scratch/test-deploy-plan-generator.js
node scratch/test-post-deploy-monitor.js
node scratch/test-rollback-plan-generator.js
node scratch/test-deploy-proposal-builder.js
node scratch/test-deploy-dashboard-api.js
node scratch/test-phase36-deploy-regression.js
```

## Phase 37 Observability Tests

```bash
node scratch/test-production-health-monitor.js
node scratch/test-incident-detector.js
node scratch/test-incident-classifier.js
node scratch/test-incident-timeline.js
node scratch/test-root-cause-analyzer.js
node scratch/test-incident-response-planner.js
node scratch/test-incident-proposal-builder.js
node scratch/test-observability-dashboard-api.js
node scratch/test-phase37-observability-regression.js
```

## Phase 41 Portfolio Tests

```bash
node scratch/test-portfolio-scanner.js
node scratch/test-project-health-scorer.js
node scratch/test-project-priority-engine.js
node scratch/test-project-dependency-detector.js
node scratch/test-project-staleness-detector.js
node scratch/test-portfolio-risk-review.js
node scratch/test-portfolio-cost-review.js
node scratch/test-portfolio-strategy-planner.js
node scratch/test-portfolio-next-action-engine.js
node scratch/test-portfolio-proposal-bridge.js
node scratch/test-portfolio-dashboard-api.js
node scratch/test-phase41-portfolio-regression.js
```

## Security / Leak Tests

```bash
node scratch/test-file-analysis-leak.js
node scratch/test-dashboard-security.js
node scratch/test-dashboard-export-security.js
```

## PWA / Service Worker Tests

```bash
node scratch/test-pwa-assets.js
```

## Reporting Rules

| Condition | Report |
|---|---|
| Test file exists and runs | Report PASS or FAIL with details |
| Test file not found | Report SKIPPED — do not claim PASS |
| Test fails due to recent change | Fix if P0; else document as known limitation |
| Test fails pre-existing | Document as known limitation |

## Test File Convention

- File name: `scratch/test-<module-name>.js`
- Should export and run tests with inline assertions
- Use `console.log` with `PASS`/`FAIL` prefix for each assertion
- Print summary at end: `Total: N | PASS: M | FAIL: K`

## CI Pipeline

Defined in `.github/workflows/ci.yml`:
- `node --check telebot.js`
- `node --check src/dashboard/dashboard-routes.js` (warning on fail)
- Module load test for autohealing, monitoring, cicd

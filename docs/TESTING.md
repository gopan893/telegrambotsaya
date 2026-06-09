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

## Phase 38 Cost / Token / Budget Tests

```bash
node scratch/test-token-estimator.js
node scratch/test-cost-estimator.js
node scratch/test-model-selection-policy.js
node scratch/test-budget-policy.js
node scratch/test-budget-guard.js
node scratch/test-usage-aggregator.js
node scratch/test-cost-alerts.js
node scratch/test-prompt-compression-advisor.js
node scratch/test-cost-dashboard-api.js
node scratch/test-phase38-cost-regression.js
```

Also verify:
```bash
node --check src/cost/index.js
node --check src/dashboard/cost-routes.js
node --check src/dashboard/dashboard-routes.js
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

## Phase 41 Portfolio Tests (Phase 42)

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

## Phase 42 Knowledge Graph Tests

```bash
node --check src/knowledge/*.js
node --check src/dashboard/knowledge-routes.js
node --check public/dashboard/knowledge.js
node scratch/test-knowledge-graph-store.js
node scratch/test-knowledge-node-manager.js
node scratch/test-knowledge-edge-manager.js
node scratch/test-project-knowledge-ingestor.js
node scratch/test-decision-memory-manager.js
node scratch/test-memory-governance-policy.js
node scratch/test-memory-safety-gate.js
node scratch/test-memory-deduplicator.js
node scratch/test-memory-staleness-reviewer.js
node scratch/test-context-retrieval-engine.js
node scratch/test-documentation-intelligence.js
node scratch/test-knowledge-dashboard-api.js
node scratch/test-phase42-knowledge-regression.js
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

## Phase 44.5 Telegram Control Layer Tests

```bash
node --check src/telegram-control/index.js
node scratch/test-telegram-command-registry.js
node scratch/test-telegram-natural-router.js
node scratch/test-telegram-intent-classifier.js
node scratch/test-telegram-permission-guard.js
node scratch/test-telegram-risk-classifier.js
node scratch/test-telegram-response-formatter.js
node scratch/test-telegram-help-menu.js
node scratch/test-telegram-proposal-router.js
node scratch/test-telegram-command-audit.js
node scratch/test-telegram-control-dashboard-api.js
node scratch/test-phase44-5-telegram-control-regression.js
```

Also rerun:
- `node scratch/test-natural-chat-stable-release.js`
- `node scratch/test-dashboard-router-registry.js`
- `node scratch/test-dashboard-all-menu-routes.js`
- `node scratch/test-executor-boundary-stable-release.js`
- `node scratch/test-file-analysis-leak.js`

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

## Phase 46 Continuous Improvement Tests

```bash
node scratch/test-feedback-collector.js
node scratch/test-outcome-collector.js
node scratch/test-quality-signal-classifier.js
node scratch/test-weakness-detector.js
node scratch/test-pattern-analyzer.js
node scratch/test-lesson-manager.js
node scratch/test-regression-case-generator.js
node scratch/test-improvement-plan-generator.js
node scratch/test-next-agent-improvement-prompt.js
node scratch/test-improvement-evaluation-gate.js
node scratch/test-improvement-proposal-bridge.js
node scratch/test-improvement-dashboard-api.js
node scratch/test-phase46-improvement-regression.js
```

Also verify:
```bash
node --check src/improvement/index.js
node --check src/dashboard/improvement-routes.js
node --check src/dashboard/dashboard-routes.js
node --check public/dashboard/improvement.js
```

## Phase 48 Security Hardening Tests

```bash
node scratch/test-secret-surface-scanner.js
node scratch/test-secret-finding-classifier.js
node scratch/test-credential-rotation-planner.js
node scratch/test-env-drift-detector.js
node scratch/test-permission-auditor.js
node scratch/test-capability-risk-auditor.js
node scratch/test-approval-bypass-auditor.js
node scratch/test-redteam-simulator.js
node scratch/test-prompt-injection-tester.js
node scratch/test-security-scorecard.js
node scratch/test-security-proposal-bridge.js
node scratch/test-security-dashboard-api.js
node scratch/test-phase48-security-regression.js
```

Also verify:
```bash
node --check src/security/index.js
node --check src/dashboard/security-routes.js
node --check src/dashboard/dashboard-routes.js
node --check public/dashboard/security.js
```

## Phase 50 Release Candidate Tests

```bash
node --check telebot.js
node --check src/release/index.js
node --check src/dashboard/release-candidate-routes.js
node scratch/test-release-candidate-store.js
node scratch/test-release-freeze-manager.js
node scratch/test-module-readiness-checker.js
node scratch/test-production-readiness-gate.js
node scratch/test-compatibility-verifier.js
node scratch/test-release-risk-reviewer.js
node scratch/test-release-notes-generator.js
node scratch/test-changelog-generator.js
node scratch/test-environment-checklist-generator.js
node scratch/test-release-candidate-dashboard-api.js
node scratch/test-phase50-release-candidate-regression.js
```

Also rerun:
- `node scratch/test-dashboard-router-registry.js`
- `node scratch/test-dashboard-all-menu-routes.js`
- `node scratch/test-dashboard-dark-form-ui.js`
- `node scratch/test-telegram-command-registry.js`
- `node scratch/test-telegram-natural-router.js`
- `node scratch/test-executor-boundary-stable-release.js`
- `node scratch/test-integration-gate-stable-release.js`
- `node scratch/test-natural-chat-stable-release.js`
- `node scratch/test-file-analysis-leak.js`
- `node scratch/test-pwa-assets.js`
- `node scratch/test-operating-loop-runner.js`

## Phase 49 Privacy & Data Retention Tests

```bash
node scratch/test-data-inventory-scanner.js
node scratch/test-data-classification-engine.js
node scratch/test-privacy-policy-engine.js
node scratch/test-retention-policy-manager.js
node scratch/test-privacy-access-guard.js
node scratch/test-export-control-manager.js
node scratch/test-export-package-builder.js
node scratch/test-archive-cleanup-planner.js
node scratch/test-delete-request-manager.js
node scratch/test-privacy-audit.js
node scratch/test-privacy-dashboard-api.js
node scratch/test-phase49-privacy-regression.js
```

Also verify:
```bash
node --check src/privacy/index.js
node --check src/dashboard/privacy-routes.js
node --check src/dashboard/dashboard-routes.js
node --check public/dashboard/privacy.js
```

## Phase 50.5 — RC Stabilization

### Stabilization Modules
- test-rc-stabilization-auditor.js — 27 assertions
- test-rc-blocker-classifier.js — 30 assertions
- test-rc-regression-checker.js — 15 assertions
- test-rc-fix-policy.js — 20 assertions
- test-phase50-5-rc-stabilization-regression.js — 56 assertions
- Run: `node scratch/test-rc-stabilization-auditor.js && node scratch/test-rc-blocker-classifier.js && node scratch/test-rc-regression-checker.js && node scratch/test-rc-fix-policy.js && node scratch/test-phase50-5-rc-stabilization-regression.js`
- Or: `npm run test:rc-all`

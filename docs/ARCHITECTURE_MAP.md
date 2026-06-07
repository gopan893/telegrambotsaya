# ARCHITECTURE_MAP.md

## Entry Points

| File | Role |
|---|---|
| `telebot.js` | Production entry |
| `start-local.js` | Dev entry |

## Dashboard Tabs

| Tab ID | Found in state.js |
|---|---|
| `overview` | ✅ |
| `ops` | ❌ |
| `workspaces` | ❌ |
| `users` | ❌ |
| `permissions` | ❌ |
| `memory` | ❌ |
| `goals` | ❌ |
| `workflows` | ❌ |
| `planner` | ❌ |
| `executor` | ❌ |
| `agents` | ❌ |
| `tools` | ❌ |
| `integrations` | ❌ |
| `backup` | ❌ |
| `insights` | ❌ |
| `graph` | ❌ |
| `benchmarks` | ❌ |
| `incidents` | ✅ |
| `observability` | ✅ |
| `portfolio` | ✅ |
| `audit` | ❌ |
| `commands` | ❌ |
| `env` | ❌ |
| `settings` | ❌ |
| `agent-evaluation` | ✅ |
| `coding` | ✅ |
| `release` | ❌ |
| `routines` | ❌ |
| `selfhealing` | ❌ |
| `monitoring` | ❌ |
| `cicd` | ✅ |
| `devgovernance` | ❌ |
| `cost` | ✅ |
| `operator` | ❌ |
| `knowledge` | ✅ |
| `telegram-control` | ✅ |

## Backend Dashboard Routes

- `/health`
- `/summary`
- `/storage`
- `/user/:userId/overview`
- `/user/:userId/memories`
- `/user/:userId/goals`
- `/user/:userId/workflows`
- `/user/:userId/insights`
- `/user/:userId/graph`
- `/user/:userId/graph/search`
- `/ops`
- `/reliability`
- `/benchmarks`
- `/incidents`
- `/commands`
- `/env-check`
- `/audit`
- `/actions/diagnostics/run`
- `/actions/benchmark/run-light`
- `/actions/telemetry/prune`
- `/actions/ops/refresh`
- `/actions/report/export-health`
- `/actions/report/export-user-summary`
- `/actions/memory/update`
- `/actions/memory/archive`
- `/actions/memory/restore`
- `/actions/goal/update`
- `/actions/goal/archive`
- `/actions/goal/restore`
- `/actions/workflow/step/add`
- `/actions/workflow/step/done`
- `/actions/workflow/step/reorder`
- `/actions/workflow/archive`
- `/actions/workflow/restore`
- `/portfolio`
- `/portfolio/snapshot`
- `/portfolio/projects`
- `/portfolio/health`
- `/portfolio/priorities`
- `/portfolio/dependencies`
- `/portfolio/stale`
- `/portfolio/risk`
- `/portfolio/cost`
- `/portfolio/next-action`
- `/portfolio/weekly-plan`
- `/portfolio/monthly-plan`
- `/portfolio/proposal`
- `/portfolio/report`
- `/telegram-control`
- `/telegram-control/commands`
- `/telegram-control/commands/:name`
- `/telegram-control/categories`
- `/telegram-control/test-intent`
- `/telegram-control/audit`
- `/telegram-control/pending-proposals`
- `/telegram-control/help`
- `/telegram-control/validate-registry`

## Phase 41 Portfolio Modules

| File | Role |
|---|---|
| `src/portfolio/portfolio-scanner.js` | Snapshot active goals/tasks/approvals/incidents/deploy/cost. |
| `src/portfolio/project-health-scorer.js` | Score project health and blockers. |
| `src/portfolio/project-priority-engine.js` | Rank active projects. |
| `src/portfolio/project-dependency-detector.js` | Detect heuristic cross-project dependencies. |
| `src/portfolio/project-staleness-detector.js` | Detect stale or blocked project work. |
| `src/portfolio/portfolio-risk-review.js` | Review portfolio-wide risk. |
| `src/portfolio/portfolio-cost-review.js` | Connect cost/budget signals with safe fallback. |
| `src/portfolio/portfolio-strategy-planner.js` | Build weekly/monthly/stabilization strategy plans. |
| `src/portfolio/portfolio-next-action-engine.js` | Recommend next project/task/agent. |
| `src/portfolio/portfolio-report-generator.js` | Generate daily/weekly/monthly/executive reports. |
| `src/portfolio/portfolio-proposal-bridge.js` | Create Evaluation v2 gated executor proposals. |
| `src/dashboard/portfolio-routes.js` | Protected dashboard Portfolio API. |
| `public/dashboard/portfolio.js` | Vanilla dashboard Portfolio tab renderer. |

## Telegram Commands

Total known commands: 86 (Phase 42 added 12 knowledge commands: /knowledge, /kg, /remember_project, /decision_memory, /project_context, /phase_context, /incident_context, /knowledge_search, /memory_review, /memory_cleanup, /docs_status, /contextpack)

## Module Groups

### action/

- `action-executor.js`

### adaptive/

- `adaptive-guards.js`
- `adaptive-memory-selector.js`
- `adaptive-mode-router.js`
- `index.js`
- `intent-complexity-detector.js`
- `response-style-adapter.js`
- `user-context-profiler.js`

### agents/

- `advanced-risk-scorer.js`
- `agent-action-detector.js`
- `agent-knowledge-detector.js` (Phase 42)
- `agent-action-mapper.js`
- `agent-action-plan.js`
- `agent-approval-flow.js`
- `agent-assignment.js`
- `agent-conflict-detector.js`
- `agent-evaluation-cases.js`
- `agent-evaluation-harness.js`
- `agent-evaluation-scorer.js`
- `agent-executor-bridge.js`
- `agent-executor-policy.js`
- `agent-handoff-manager.js`
- `agent-learning-notes.js`
- `agent-memory-relevance.js`
- `agent-memory-store.js`
- `agent-memory-utils.js`
- `agent-opinion-collector.js`
- `agent-personality.js`
- `agent-preferences.js`
- `agent-profile-store.js`
- `agent-prompt-composer.js`
- `agent-registry.js`
- `agent-response-renderer.js`
- `agent-result-aggregator.js`
- `agent-router.js`
- `agent-scoring.js`
- `agent-style-builder.js`
- `agent-task-queue.js`
- `agent-task-runner.js`
- `agent-task-store.js`
- `agent-utils.js`
- `confidence-scorer.js`
- `conversation-bus.js`
- `council-engine.js`
- `council-memory.js`
- `council-moderator.js`
- `council-store.js`
- `council-utils.js`
- `cross-agent-critique.js`
- `debate-engine.js`
- `decision-detector.js`
- `decision-history.js`
- `decision-memory.js`
- `decision-recommender.js`
- `decision-store.js`
- `decision-synthesis.js`
- `decision-utils.js`
- `delegation-engine.js`
- `delegation-memory.js`
- `delegation-utils.js`
- `evaluator.js`
- `executor-preflight-review.js`
- `executor-result-router.js`
- `executor.js`
- `index.js`
- `introspection.js`
- `learning.js`
- `memory.js`
- `observability.js`
- `option-extractor.js`
- `planner.js`
- `proposal-builder.js`
- `pros-cons-engine.js`
- `reasoning.js`
- `recovery.js`
- `reflection.js`
- `research.js`
- `response-policy.js`
- `risk-detector.js`
- `risk-review-engine.js`
- `safety.js`
- `self-improvement.js`
- `tool-router.js`
- `topic-classifier.js`
- `tradeoff-analyzer.js`
- `verifier.js`

### ai-os/

- `aios-guards.js`
- `aios-utils.js`
- `cognitive-analytics.js`
- `cognitive-core.js`
- `cognitive-workspace.js`
- `concept-extractor.js`
- `context-relevance-gate.js`
- `context-sync.js`
- `goal-manager.js`
- `graph-guards.js`
- `graph-natural-integration.js`
- `graph-retriever.js`
- `graph-summarizer.js`
- `graph-utils.js`
- `guards.js`
- `index.js`
- `insight-store.js`
- `knowledge-graph.js`
- `learning-evolution.js`
- `memory-bus.js`
- `meta-reasoning.js`
- `natural-integration.js`
- `output-sanitizer.js`
- `personal-intelligence.js`
- `reflection-engine.js`
- `research-intelligence.js`
- `semantic-relationship-engine.js`
- `strategic-reasoning.js`
- `unified-memory.js`
- `workflow-engine.js`

### autohealing/

- `autoheal-actions.js`
- `autoheal-policy.js`
- `autoheal-proposal-bridge.js`
- `autoheal-registry.js`
- `autoheal-runner.js`
- `autoheal-store.js`
- `autoheal-utils.js`
- `index.js`

### observability/

- `production-health-monitor.js`
- `incident-store.js`
- `incident-detector.js`
- `incident-classifier.js`
- `incident-timeline.js`
- `root-cause-analyzer.js`
- `incident-response-planner.js`
- `incident-proposal-builder.js`
- `incident-notifier.js`
- `observability-sanitizer.js`
- `observability-utils.js`
- `index.js`

### backup/

- `backup-engine.js`
- `backup-guards.js`
- `backup-scheduler.js`
- `backup-store.js`
- `backup-utils.js`
- `disaster-recovery.js`
- `export-engine.js`
- `import-validator.js`
- `index.js`
- `integrity-checker.js`
- `restore-engine.js`

### bot/

- `app.js`
- `bot-context.js`
- `callback-handler.js`
- `command-router.js`
- `error-handler.js`
- `index.js`
- `legacy-adapter.js`
- `legacy-runtime.js`
- `message-handler.js`
- `response-pipeline.js`
- `webhook.js`

### cicd/

- `cicd-github-status.js`
- `cicd-proposal.js`
- `cicd-quality-gate.js`
- `cicd-store.js`
- `cicd-utils.js`
- `index.js`

### coding/

- `code-change-planner.js`
- `codex-prompt-generator.js`
- `coding-evaluation-cases.js`
- `coding-request-classifier.js`
- `coding-review-synthesis.js`
- `coding-task-tracker.js`
- `coding-utils.js`
- `coding-workspace-store.js`
- `github-proposal-builder.js`
- `index.js`
- `regression-risk-reviewer.js`
- `repo-context-manager.js`
- `test-plan-generator.js`

### collaboration/

- `cognitive-goal-analyzer.js`
- `cognitive-workspace.js`
- `collaboration-analytics.js`
- `collaboration-core.js`
- `collaboration-guards.js`
- `collaboration-store.js`
- `collaboration-utils.js`
- `collaborative-reasoning.js`
- `critical-thinking-assistant.js`
- `decision-support.js`
- `deep-analysis-framework.js`
- `index.js`
- `insight-generator.js`
- `intent-understanding.js`
- `learning-intelligence.js`
- `mental-model-engine.js`
- `personal-intelligence.js`
- `reflection-system.js`
- `strategic-thinking-engine.js`
- `thinking-partner.js`

### conversation/

- `clarification-handler.js`
- `context-window.js`
- `continuation-handler.js`
- `conversation-guards.js`
- `conversation-manager.js`
- `dialogue-state.js`
- `followup-detector.js`
- `index.js`
- `pending-actions.js`
- `topic-shift-detector.js`

### core/

- `agent-coordinator.js`
- `autonomous-engine.js`
- `message-bus.js`
- `task-queue.js`

### dashboard/

- `agent-evaluation-routes.js`
- `agent-executor-routes.js`
- `agent-memory-routes.js`
- `agent-routes.js`
- `agent-task-routes.js`
- `audit-log.js`
- `backup-routes.js`
- `cicd-routes.js`
- `coding-workspace-routes.js`
- `council-routes.js`
- `dashboard-actions.js`
- `dashboard-auth.js`
- `dashboard-guards.js`
- `dashboard-permissions.js`
- `dashboard-routes.js`
- `dashboard-serializers.js`
- `dashboard-utils.js`
- `decision-routes.js`
- `deploy-routes.js`
- `devgovernance-routes.js`
- `evaluation-routes.js`
- `executor-routes.js`
- `githubops-routes.js`
- `index.js`
- `integration-execution-routes.js`
- `monitoring-routes.js`
- `planner-routes.js`
- `pwa-routes.js`
- `routine-routes.js`
- `safe-actions.js`
- `selfhealing-routes.js`
- `soft-delete.js`
- `storage-status-formatters.js`
- `tool-routes.js`
- `workspace-routes.js`

### cost/

- `cost-usage-store.js`
- `token-estimator.js`
- `cost-estimator.js`
- `model-cost-registry.js`
- `model-selection-policy.js`
- `budget-policy.js`
- `budget-guard.js`
- `usage-aggregator.js`
- `cost-alerts.js`
- `prompt-compression-advisor.js`
- `cost-utils.js`
- `index.js`

### deploy/

- `deploy-proposal-builder.js`
- `deploy-plan-generator.js`
- `deploy-release-store.js`
- `deploy-result-router.js`
- `deploy-utils.js`
- `index.js`
- `post-deploy-monitor.js`
- `release-candidate-manager.js`
- `render-deploy-gate.js`
- `render-env-checker.js`
- `render-startup-checker.js`
- `rollback-plan-generator.js`

### devgovernance/

- `agent-contract-manager.js`
- `architecture-map-generator.js`
- `backend-frontend-linker.js`
- `change-manifest.js`
- `cicd-governance-gate.js`
- `collision-detector.js`
- `dashboard-route-consistency.js`
- `devgovernance-store.js`
- `devgovernance-telegram.js`
- `devgovernance-utils.js`
- `handoff-orchestrator.js`
- `index.js`
- `integration-contract-validator.js`
- `next-agent-prompt-generator.js`
- `patch-plan-store.js`
- `test-matrix-generator.js`

### executor/

- `approved-runner.js`
- `execution-planner.js`
- `execution-queue.js`
- `execution-store.js`
- `executor-guards.js`
- `executor-registry.js`
- `executor-utils.js`
- `index.js`

### governance/

- `approval-layer.js`
- `audit-logger.js`
- `explainability.js`
- `index.js`
- `permission-engine.js`
- `policy-engine.js`
- `risk-assessment.js`
- `rollback-controller.js`
- `safety-validator.js`

### integrations/

- `connector-execution-store.js`
- `connector-executor.js`
- `connector-permissions.js`
- `connector-quality-gates.js`
- `connector-rate-limit.js`
- `connector-result-sanitizer.js`
- `index.js`
- `integration-evaluation-gate.js`
- `integration-proposal-pipeline.js`

### intent/

- `semantic-parser.js`

### interactions/

- `action-handlers.js`
- `callback-router.js`
- `confirmation-handler.js`
- `index.js`
- `interaction-guards.js`
- `interaction-manager.js`
- `interaction-state.js`
- `interactive-menu.js`
- `keyboard-builder.js`

### learning/

- `reflection.js`

### memory/

- `advanced-memory.js`

### knowledge/ (Phase 42)

- `knowledge-graph-store.js`
- `knowledge-node-manager.js`
- `knowledge-edge-manager.js`
- `project-knowledge-ingestor.js`
- `decision-memory-manager.js`
- `memory-governance-policy.js`
- `memory-safety-gate.js`
- `memory-deduplicator.js`
- `memory-staleness-reviewer.js`
- `context-retrieval-engine.js`
- `documentation-intelligence.js`
- `knowledge-report-generator.js`
- `knowledge-utils.js`
- `index.js`

### bot/ (Phase 42)

- `knowledge-command-handler.js`

### monitoring/

- `event-bus.js`
- `index.js`
- `metrics-store.js`
- `monitoring-sanitizer.js`
- `monitoring-utils.js`
- `websocket-server.js`

### multibot/

- `bot-config.js`
- `bot-identity-resolver.js`
- `bot-registry.js`
- `index.js`
- `multibot-utils.js`
- `telegram-client.js`
- `webhook-manager.js`

### multimodal/

- `cross-modal-engine.js`
- `data-interpreter.js`
- `document-parser.js`
- `file-handler.js`
- `file-intent-guard.js`
- `image-vision.js`

### natural-language/

- `natural-router.js`
- `natural-tool-router.js`

### ops/

- `ab-testing.js`
- `adaptive-ops.js`
- `benchmark-cases.js`
- `benchmark-engine.js`
- `canary-controller.js`
- `cost-optimizer.js`
- `diagnostics-engine.js`
- `evaluation-scheduler.js`
- `health-monitor.js`
- `incident-handler.js`
- `index.js`
- `ops-guards.js`
- `ops-knowledge-base.js`
- `ops-store.js`
- `ops-utils.js`
- `ops-workflow.js`
- `performance-profiler.js`
- `recovery-controller.js`
- `regression-detector.js`
- `reliability-scorer.js`
- `resource-analyzer.js`
- `rollback-manager.js`
- `telemetry-collector.js`
- `token-analyzer.js`
- `tuning-controller.js`

### planner/

- `dependency-detector.js`
- `index.js`
- `milestone-planner.js`
- `planner-engine.js`
- `planner-guards.js`
- `planner-store.js`
- `planner-utils.js`
- `priority-scorer.js`
- `task-orchestrator.js`

### planning/

- `planner.js`

### routines/

- `index.js`
- `routine-briefing-generator.js`
- `routine-evaluation-cases.js`
- `routine-notification-policy.js`
- `routine-policy.js`
- `routine-proposal-bridge.js`
- `routine-registry.js`
- `routine-runner.js`
- `routine-scheduler.js`
- `routine-store.js`
- `routine-utils.js`

### selfhealing/

- `coding-workspace-guard.js`
- `dashboard-route-guard.js`
- `executor-safety-guard.js`
- `health-check-suite.js`
- `index.js`
- `integration-gate-guard.js`
- `natural-chat-guard.js`
- `regression-guard-registry.js`
- `repair-plan-generator.js`
- `repair-prompt-generator.js`
- `repair-proposal-bridge.js`
- `selfhealing-store.js`
- `selfhealing-utils.js`

### storage/

- `database.js`
- `index.js`
- `json-repositories.js`
- `migrations.js`
- `postgres-store.js`
- `redis-store.js`
- `schema.js`
- `storage-manager.js`

### tools/

- `builtin-tools.js`
- `index.js`
- `natural-tool-router.js`
- `tool-audit.js`
- `tool-governance.js`
- `tool-metadata.js`
- `tool-registry.js`
- `tool-runner.js`
- `tool-utils.js`

### utils/

- `message-splitter.js`
- `telegram-formatter.js`
- `telegram-sender.js`

### ux/

- `human-ai-safety.js`
- `multi-device-response.js`

### workspace/

- `index.js`
- `workspace-guards.js`
- `workspace-permissions.js`
- `workspace-store.js`
- `workspace-utils.js`

## Documentation Files

- `AGENT_ACTION_PROPOSALS.md`
- `AGENT_COUNCIL.md`
- `AGENT_DEBATE.md`
- `AGENT_DECISIONS.md`
- `AGENT_DELEGATION.md`
- `AGENT_EVALUATION.md`
- `AGENT_EVALUATION_V2.md`
- `AGENT_EXECUTOR.md`
- `AGENT_HANDOFF.md`
- `AGENT_MEMORY.md`
- `AGENT_PERSONALITY.md`
- `AGENT_ROUTER.md`
- `AGENT_STYLE_GUIDE.md`
- `AGENT_TASKS.md`
- `APPROVAL_FLOW.md`
- `APPROVED_EXTERNAL_EXECUTION.md`
- `ARCHITECTURE.md`
- `ARCHITECTURE_MAP.md`
- `AUDIT_LOG.md`
- `BACKUP_RECOVERY.md`
- `BACKUP_SCHEDULER.md`
- `CODEX_OPENCODE_HANDOFF.md`
- `CODEX_PROMPT_WORKFLOW.md`
- `CODE_CHANGE_PROPOSALS.md`
- `CODING_WORKSPACE.md`
- `COMMANDS.md`
- `CONTEXT_RELEVANCE_GUARD.md`
- `DASHBOARD.md`
- `DASHBOARD_ADMIN_ACTIONS.md`
- `DASHBOARD_API.md`
- `DASHBOARD_SECURITY.md`
- `DASHBOARD_UI.md`
- `DECISION_HISTORY.md`
- `DECISION_SYNTHESIS.md`
- `DEPLOYMENT_RELEASE_MANAGER.md`
- `DEPLOY_SECURITY.md`
- `DEV_GOVERNANCE.md`
- `DISASTER_RECOVERY.md`
- `EXECUTOR.md`
- `EXPORT_IMPORT.md`
- `EXTERNAL_INTEGRATIONS.md`
- `GITHUB_CONNECTOR.md`
- `GOOGLE_CONNECTORS.md`
- `GROUP_MULTI_AGENT.md`
- `HUMAN_APPROVAL.md`
- `INTEGRATION_CONTRACT.md`
- `INTEGRATION_EVALUATION_GATE.md`
- `INTEGRATION_SECURITY.md`
- `KNOWLEDGE_GRAPH.md`
- `MULTIBOT.md`
- `MULTI_AGENT_DEV_WORKFLOW.md`
- `NATURAL_AI_OS_INTEGRATION.md`
- `NATURAL_TOOL_ROUTING.md`
- `OPEN_CODE_INTEGRATION_AUDIT.md`
- `OPEN_CODE_RECOVERY_AUDIT.md`
- `OPS.md`
- `PERMISSIONS.md`
- `PHASE11_DASHBOARD_UI_TESTS.md`
- `PHASE12_DASHBOARD_TESTS.md`
- `PHASE7_E2E_AUDIT.md`
- `PHASE8_GRAPH_TESTS.md`
- `PHASE9_DASHBOARD_API_TESTS.md`
- `PLANNER.md`
- `POSTGRES_HEALTH.md`
- `PWA_DASHBOARD.md`
- `QUALITY_GATES.md`
- `REDIS_HEALTH.md`
- `RELEASE_PHASE_30_AUDIT.md`
- `RENDER_DEPLOYMENT.md`
- `RENDER_DEPLOY_GATE.md`
- `ROLLBACK_SYSTEM.md`
- `RISK_REVIEW.md`
- `SELF_HEALING_OPS.md`
- `STORAGE_DRIVER.md`
- `TASK_ORCHESTRATION.md`
- `TESTING.md`
- `TOOL_GOVERNANCE.md`
- `TOOL_REGISTRY.md`
- `WEBHOOK_CONNECTOR.md`
- `WORKSPACES.md`
- `autohealing.md`
- `cicd.md`
- `monitoring.md`

## Test Files

- `test-adaptive-router.js`
- `test-agent-action-detector.js`
- `test-agent-approval-flow.js`
- `test-agent-assignment.js`
- `test-agent-contract-manager.js`
- `test-agent-dashboard-api.js`
- `test-agent-delegation-engine.js`
- `test-agent-delegation-natural-chat.js`
- `test-agent-evaluation-dashboard-api.js`
- `test-agent-evaluation-harness.js`
- `test-agent-evaluation-v2.js`
- `test-agent-executor-bridge.js`
- `test-agent-executor-natural-chat.js`
- `test-agent-memory-dashboard-api.js`
- `test-agent-memory-relevance.js`
- `test-agent-memory-store.js`
- `test-agent-personality.js`
- `test-agent-prompt-composer.js`
- `test-agent-quality-gates.js`
- `test-agent-response-renderer.js`
- `test-agent-router.js`
- `test-agent-task-dashboard-api.js`
- `test-agent-task-runner.js`
- `test-agent-task-store.js`
- `test-aios-foundation.js`
- `test-aios.js`
- `test-architecture-map-generator.js`
- `test-autonomous.js`
- `test-backend-frontend-linker.js`
- `test-backup-download-import-ux.js`
- `test-backup-engine.js`
- `test-backup-scheduler.js`
- `test-cloudflare-nas-connector.js`
- `test-code-change-planner.js`
- `test-codex-prompt-generator.js`
- `test-coding-request-classifier.js`
- `test-coding-workspace-dashboard-api.js`
- `test-coding-workspace-natural-chat.js`
- `test-coding-workspace-stable-release.js`
- `test-collaboration-mvp.js`
- `test-collision-detector.js`
- `test-connector-executor.js`
- `test-connector-quality-gates.js`
- `test-context-relevance-gate.js`
- `test-conversation-bus.js`
- `test-conversation-layer.js`
- `test-council-dashboard-api.js`
- `test-council-engine.js`
- `test-council-natural-routing.js`
- `test-dashboard-actions-v2.js`
- `test-dashboard-agent-routing.js`
- `test-dashboard-all-menu-routes.js`
- `test-dashboard-api.js`
- `test-dashboard-audit-log.js`
- `test-dashboard-coding-release-routing.js`
- `test-dashboard-dark-form-ui.js`
- `test-dashboard-env-and-static.js`
- `test-dashboard-export-security.js`
- `test-dashboard-goal-workflow-control.js`
- `test-dashboard-memory-control.js`
- `test-dashboard-route-consistency.js`
- `test-dashboard-route-guard.js`
- `test-dashboard-router-registry.js`
- `test-dashboard-safe-actions.js`
- `test-dashboard-security.js`
- `test-dashboard-stable-routes.js`
- `test-dashboard-ui-routes.js`
- `test-debate-engine.js`
- `test-decision-dashboard-api.js`
- `test-decision-detector.js`
- `test-decision-natural-chat.js`
- `test-decision-recommender.js`
- `test-decision-synthesis.js`
- `test-deploy-dashboard-api.js`
- `test-deploy-plan-generator.js`
- `test-deploy-proposal-builder.js`
- `test-devgovernance-dashboard-api.js`
- `test-disaster-recovery.js`
- `test-execution-approval.js`
- `test-execution-planner.js`
- `test-executor-boundary-stable-release.js`
- `test-executor-dashboard-api.js`
- `test-executor-preflight-review.js`
- `test-executor-safety-guard.js`
- `test-export-import.js`
- `test-file-analysis-leak.js`
- `test-final-cognitive-os.js`
- `test-github-connector.js`
- `test-github-proposal-builder.js`
- `test-gmail-draft-connector.js`
- `test-google-calendar-connector.js`
- `test-governance.js`
- `test-handoff-orchestrator.js`
- `test-human-ai-safety.js`
- `test-integration-contract-validator.js`
- `test-integration-evaluation-gate.js`
- `test-integration-execution-dashboard-api.js`
- `test-integration-execution-natural-chat.js`
- `test-integration-gate-guard.js`
- `test-integration-gate-stable-release.js`
- `test-integration-proposal-pipeline.js`
- `test-interactions.js`
- `test-knowledge-graph.js`
- `test-multi-device-ux.js`
- `test-multibot-config.js`
- `test-multibot-stable-release.js`
- `test-multimodal.js`
- `test-natural-chat-domain-routing.js`
- `test-natural-chat-guard.js`
- `test-natural-chat-stable-release.js`
- `test-natural-language-router.js`
- `test-natural-tool-router.js`
- `test-next-agent-prompt-generator.js`
- `test-ops.js`
- `test-option-extractor.js`
- `test-output-sanitizer.js`
- `test-phase12-dashboard-ux.js`
- `test-phase34-devgovernance-regression.js`
- `test-phase36-deploy-regression.js`
- `test-phase7-natural-aios.js`
- `test-planner-dashboard-api.js`
- `test-planner-engine.js`
- `test-post-deploy-monitor.js`
- `test-postgres-health-dashboard.js`
- `test-production-agents.js`
- `test-proposal-builder.js`
- `test-pros-cons-engine.js`
- `test-pwa-assets.js`
- `test-redis-health-dashboard.js`
- `test-regression-risk-reviewer.js`
- `test-release-candidate-manager.js`
- `test-release-gate-phase30.js`
- `test-render-deploy-gate.js`
- `test-render-env-checker.js`
- `test-render-startup-checker.js`
- `test-repair-plan-generator.js`
- `test-repair-prompt-generator.js`
- `test-restore-engine.js`
- `test-risk-confidence-scorer.js`
- `test-rollback-plan-generator.js`
- `test-routine-dashboard-api.js`
- `test-routine-natural-chat.js`
- `test-routine-notifications.js`
- `test-routine-policy.js`
- `test-routine-proposal-bridge.js`
- `test-routine-registry.js`
- `test-routine-runner.js`
- `test-routine-scheduler.js`
- `test-selfhealing-dashboard-api.js`
- `test-selfhealing-health-suite.js`
- `test-selfhealing-natural-chat.js`
- `test-short-followup-context.js`
- `test-storage-driver-selection.js`
- `test-task-orchestrator.js`
- `test-telegram-ux.js`
- `test-test-matrix-generator.js`
- `test-test-plan-generator.js`
- `test-tool-dashboard-api.js`
- `test-tool-governance.js`
- `test-tool-registry.js`
- `test-tradeoff-analyzer.js`
- `test-visible-multibot-replies.js`
- `test-webhook-connector.js`
- `test-workspace-dashboard-api.js`
- `test-workspace-permissions.js`
- `test-workspace-store.js`
## Phase 43 Research / Docs Agent

Research/documentation layer:

- `src/research/research-task-planner.js`
- `src/research/source-collector.js`
- `src/research/source-credibility-scorer.js`
- `src/research/evidence-extractor.js`
- `src/research/research-summarizer.js`
- `src/research/research-knowledge-linker.js`
- `src/research/documentation-agent.js`
- `src/research/documentation-draft-generator.js`
- `src/research/documentation-update-planner.js`
- `src/research/research-safety-gate.js`

Dashboard:

- Tab id: `research`
- Renderer: `window.UI.renderResearch`
- Frontend: `public/dashboard/research.js`
- Backend route: `src/dashboard/research-routes.js`
- API base: `/api/dashboard/research`

Runtime integration:

- Telegram command/natural route integration lives in `src/bot/legacy-runtime.js`.
- Docs update proposals remain proposal-only and do not mutate repo files directly.

## Phase 44 Personal Life OS

Life OS layer:

- `src/lifeos/lifeos-store.js`
- `src/lifeos/daily-planner.js`
- `src/lifeos/weekly-planner.js`
- `src/lifeos/personal-task-manager.js`
- `src/lifeos/habit-tracker.js`
- `src/lifeos/reminder-planner.js`
- `src/lifeos/focus-session-manager.js`
- `src/lifeos/energy-mood-journal.js`
- `src/lifeos/personal-goal-manager.js`
- `src/lifeos/life-priority-engine.js`
- `src/lifeos/life-memory-governance.js`
- `src/lifeos/life-integration-proposal.js`
- `src/lifeos/life-report-generator.js`
- `src/lifeos/lifeos-utils.js`

Dashboard:

- Tab id: `lifeos`
- Renderer: `window.UI.renderLifeOS`
- Frontend: `public/dashboard/lifeos.js`
- Backend route: `src/dashboard/lifeos-routes.js`
- API base: `/api/dashboard/lifeos`

Runtime integration:

- Telegram command/natural route integration lives in `src/bot/legacy-runtime.js`.
- Calendar/Gmail/routine requests become Life OS proposals only.
- Evaluation v2 has Life OS golden cases and quality gates for privacy, secret redaction, external action safety, and personal context relevance.

## Phase 44.5 Universal Telegram Control Layer

Telegram Control Layer modules:

| File | Role |
|---|---|
| `src/telegram-control/telegram-command-registry.js` | Built-in command definitions, registration, lookup, search, validation |
| `src/telegram-control/telegram-natural-router.js` | Natural message routing to commands, intent-to-command mapping |
| `src/telegram-control/telegram-intent-classifier.js` | Intent classification from natural language with 50+ patterns |
| `src/telegram-control/telegram-permission-guard.js` | Owner/admin/workspace permission checks |
| `src/telegram-control/telegram-risk-classifier.js` | Risk level classification (read_only/danger), evaluation/proposal gating |
| `src/telegram-control/telegram-response-formatter.js` | Clean response formatting, sanitization, chunking |
| `src/telegram-control/telegram-help-menu.js` | Main menu, category menu, command help, search |
| `src/telegram-control/telegram-proposal-router.js` | Proposal creation, duplicate detection, approval linking |
| `src/telegram-control/telegram-command-audit.js` | Audit logging for all Telegram command activity |
| `src/telegram-control/telegram-rate-limit.js` | Rate limiting, duplicate suppression, bot-to-bot loop prevention |
| `src/telegram-control/telegram-session-context.js` | Session context storage for short follow-ups |
| `src/telegram-control/telegram-utils.js` | Utility functions: secrets sanitization, IDs, text processing |

Dashboard:

- Tab id: `telegram-control`
- Renderer: `window.renderTelegramControl`
- Frontend: `public/dashboard/telegram-control.js`
- Backend route: `src/dashboard/telegram-control-routes.js`
- API base: `/api/dashboard/telegram-control`

Command coverage: ~250 commands across 20 categories.
Security: secret pattern detection, permission gating, rate limiting, audit logging, no auto-approve, no auto-run.

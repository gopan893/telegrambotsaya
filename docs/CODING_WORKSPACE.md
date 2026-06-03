# Coding Workspace — Phase 29

## Overview

The Coding Workspace is a multi-agent safe coding layer that helps users with coding tasks through collaborative agent analysis — without directly mutating code or performing external writes.

## Architecture

```
User Request
    │
    ▼
┌─────────────────────┐
│  Request Classifier  │ → Detects coding category, risk level, agents needed
└─────────┬───────────┘
          │
    ┌─────▼─────┐
    │  Classify  │ → bug_fix, feature_request, phase_prompt, etc.
    └─────┬─────┘
          │
    ┌─────▼─────────┐
    │  Repo Context  │ → Load workspace config, project constraints
    └─────┬─────────┘
          │
    ┌─────▼──────────┐
    │  Change Planner │ → Generate code change plan (no mutation)
    └─────┬──────────┘
          │
    ┌─────▼──────────────┐
    │  Risk Review (5)    │ → Coder, Planner, Critic, Security, Executor
    └─────┬──────────────┘
          │
    ┌─────▼──────────────┐     ┌──────────────────┐
    │  Test Plan Gen      │     │  Codex Prompt Gen │
    └─────┬──────────────┘     └────────┬─────────┘
          │                              │
          └──────────┬───────────────────┘
                     │
              ┌──────▼──────┐
              │  GitHub     │ → Proposal ONLY (no direct write)
              │  Proposal   │    Requires Evaluation v2 + Executor approval
              └─────────────┘
```

## Agents

| Agent | Role |
|-------|------|
| **Coder** | Implementation feasibility |
| **Planner** | Roadmap/phase fit |
| **Critic** | Regression/scope creep detection |
| **Security** | Secret/permission/external write risk |
| **Executor** | Approval/run boundary |

## Categories Detected

- `bug_fix` — Bug fixes
- `feature_request` — New features
- `phase_prompt` — Phase prompt generation
- `refactor` — Code refactoring
- `dashboard_issue` — Dashboard/UI bugs
- `telegram_bot_issue` — Telegram bot issues
- `database_storage_issue` — Database/storage problems
- `integration_issue` — API/integration issues
- `security_issue` — Security vulnerabilities
- `test_regression` — Test/regression requests
- `deployment_issue` — Deployment problems
- `github_issue_pr` — GitHub issue/PR creation requests

## Risk Levels

| Level | Meaning |
|-------|---------|
| `low` | Standard change, no approval needed |
| `medium` | Moderate risk, review recommended |
| `high` | Significant risk, approval required |
| `critical` | Dangerous operation, blocked without manual review |

## Project Constraints (enforced)

- Node.js 20, CommonJS (require/module.exports)
- Express webhook
- Vanilla HTML/CSS/JS dashboard
- PostgreSQL/Redis compatible with JSON fallback
- No TypeScript, React, Next.js, Vue
- No large refactor
- Preserve ALL existing commands and features
- External writes require evaluation gate + approval

## Security Rules

- No shell execution
- No arbitrary code execution
- No direct repo mutation
- No direct GitHub write
- No auto-approve
- All secrets redacted from output
- External write requires Evaluation v2 + Executor approval

## Files

### Core Modules
- `src/coding/coding-utils.js` — Utilities, constants, secret redaction
- `src/coding/coding-workspace-store.js` — Workspace data model
- `src/coding/coding-request-classifier.js` — Request classification
- `src/coding/repo-context-manager.js` — Repo/project context
- `src/coding/code-change-planner.js` — Code change plan generation
- `src/coding/regression-risk-reviewer.js` — Multi-agent risk review
- `src/coding/test-plan-generator.js` — Test plan generation
- `src/coding/codex-prompt-generator.js` — Codex-ready prompt generation
- `src/coding/github-proposal-builder.js` — GitHub proposal builder
- `src/coding/coding-task-tracker.js` — Coding task tracking
- `src/coding/coding-review-synthesis.js` — Review synthesis formatter
- `src/coding/coding-evaluation-cases.js` — Evaluation test cases
- `src/coding/index.js` — Module exports

### Dashboard
- `src/dashboard/coding-workspace-routes.js` — Dashboard API routes

### Evaluation Harness v2
- Added scoring: `codingClassificationScore`, `codingPlanQualityScore`, `regressionRiskScore`, `testPlanQualityScore`, `codexPromptQualityScore`, `githubProposalSafetyScore`

## API Endpoints

```
GET  /api/dashboard/coding-workspace
POST /api/dashboard/coding-workspace
GET  /api/dashboard/coding-workspace/requests
POST /api/dashboard/coding-workspace/requests/classify
POST /api/dashboard/coding-workspace/change-plan
GET  /api/dashboard/coding-workspace/change-plans
GET  /api/dashboard/coding-workspace/change-plans/:id
POST /api/dashboard/coding-workspace/change-plans/:id/risk-review
POST /api/dashboard/coding-workspace/change-plans/:id/test-plan
POST /api/dashboard/coding-workspace/change-plans/:id/codex-prompt
POST /api/dashboard/coding-workspace/change-plans/:id/github-issue-proposal
POST /api/dashboard/coding-workspace/change-plans/:id/github-pr-proposal
GET  /api/dashboard/coding-workspace/tasks
POST /api/dashboard/coding-workspace/tasks
```

## Telegram Commands

```
/coding
/codereq <text>
/codeplan <text>
/codetasks
/codeprompt <planId>
/testplan <planId>
/riskreview_code <planId>
/propose_github_issue_from_plan <planId>
/propose_github_pr_from_plan <planId>
```

## Natural Chat Examples

| Input | Expected Behavior |
|-------|-------------------|
| "buat prompt phase 30" | Planner + Coder + Critic → Generate phase prompt |
| "menu Agents masih masuk Overview" | Dashboard bug → Hotfix plan + tests |
| "buat issue GitHub" | Code change summary → Evaluation v2 → Executor proposal only |
| "hapus semua file lama" | Critical risk → Blocked with warning |
| "pakai React untuk dashboard" | Constraint violation → High risk warning |
| "bagaimana menghadapi guru marah?" | Not coding → No coding workspace leakage |

# Unified Governance Policy Engine

## Overview

Phase 47 introduces a **Unified Governance Policy Engine** that centralizes safety rules, permission checks, risk classification, approval policy, Evaluation v2 gate requirements, secret redaction, external action policy, capability contracts, and policy simulation.

## Architecture

```
Module Request → Capability Registry → Policy Engine → Risk Engine → Secret Guard
→ Budget/Cost Guard → Evaluation v2 Check → Approval Check → Decision → Audit
```

## Core Components

### 1. Governance Policy Store
- Central policy repository (`src/governance/governance-policy-store.js`)
- Rules: noDirectExternalWrite, noAutoApprove, noShellExecutor, etc.
- Approval flow: dry_run → evaluation_v2 → executor_proposal → approval → run

### 2. Capability Registry
- Every module registers capabilities with risk levels, action types, and requirements
- `src/governance/capability-registry.js`
- Modules: telegram_control, agents, executor, integrations, coding, routines, selfhealing, autohealing, monitoring, cicd, githubops, deploy, observability, cost, operator, portfolio, knowledge, lifeos, operating_loop, improvement, backup, memory, goals, workflows

### 3. Capability Contracts
- `src/governance/capability-contracts.js`
- Defines standard contracts for risky capabilities (GitHub, Deploy, Gmail, Calendar, Webhook, Backup, etc.)

### 4. Unified Permission Engine
- `src/governance/unified-permission-engine.js`
- Role resolution: owner → admin → user
- Owner/Admin checks, workspace permissions

### 5. Unified Risk Engine
- `src/governance/unified-risk-engine.js`
- Risk levels: read_only, low, medium, high, danger, blocked
- Danger patterns: restore backup, rollback, deploy, GitHub push, workflow dispatch, etc.

### 6. Unified Secret Guard
- `src/governance/unified-secret-guard.js`
- Scans for tokens, secrets, API keys, passwords, database URLs
- Blocks raw storage in memory/knowledge/improvement/lifeos
- Redacts secrets from output

### 7. Unified Approval Policy
- `src/governance/unified-approval-policy.js`
- Read/report/dry_run → direct execution
- External_write/dangerous → proposal + evaluation + approval

### 8. Unified Evaluation v2 Policy
- `src/governance/unified-evaluation-policy.js`
- Evaluation required for: external write, GitHub push/deploy, restore, Gmail, Calendar, Webhook, permission changes

### 9. Unified Cost Policy
- `src/governance/unified-cost-policy.js`
- Cost estimation and guard requirements
- No crash if cost module missing

### 10. Action Policy Simulator
- `src/governance/action-policy-simulator.js`
- Simulates any action against governance policy
- No action is ever executed

### 11. Governance Decision Engine
- `src/governance/governance-decision-engine.js`
- Evaluates governance for any action
- Outcomes: allow_read, allow_dry_run, allow_plan, create_proposal, require_evaluation, require_approval, block, degraded_unavailable

### 12. Governance Audit
- `src/governance/governance-audit.js`
- Records all governance decisions
- Never logs secrets

## Security Rules

- No direct external write
- No direct GitHub push
- No direct workflow dispatch
- No direct deploy/rollback
- No direct Gmail/calendar/webhook write
- No shell executor
- No auto-approve
- No auto-run write/external/danger
- All write/external/danger must go: dry-run → Evaluation v2 → executor proposal → approval → run

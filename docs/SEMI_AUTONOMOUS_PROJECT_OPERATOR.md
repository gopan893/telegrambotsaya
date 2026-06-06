# Semi-Autonomous Project Operator

## Overview

Phase 40 adds a semi-autonomous project operator that manages project work end-to-end: from goal to delivery proposal.

## Core Flow

1. User creates a goal (e.g., "selesaikan bot AI OS sampai production stabil")
2. Goal analyzer classifies and extracts success criteria/constraints/risk
3. Operator planner creates a delivery plan with phases and milestones
4. Task breakdown creates granular tasks from plan phases
5. Agent coordinator selects appropriate agent roles per task
6. Progress tracker monitors completion
7. Decision engine recommends next action and agent (Codex/OpenCode/Hermes)
8. Risk review checks for compatibility, approval bypass, cost, deployment risks
9. Cost guard estimates and warns if budget exceeded
10. Evaluation gate verifies safety before proposal creation
11. Proposal bridge creates executor proposals (no direct execution)
12. Report generator produces status reports

## Security

- No direct GitHub push, deploy, rollback, or external write
- All proposals require Evaluation v2 + executor approval
- No shell executor
- No auto-approve
- Reports are sanitized (secrets redacted)

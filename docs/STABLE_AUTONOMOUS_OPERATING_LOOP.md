# Phase 45: Stable Autonomous Operating Loop

## Overview

The Operating Loop system provides a scheduled, read-only autonomous cycle that monitors system health, detects blockers, synthesizes next actions, and generates periodic AI OS reports. It is designed for observability and recommendation — never for autonomous execution.

## Key Principles

1. **Read-only by default**: All loops run in `scheduled_readonly` mode. No write, external, or danger actions are ever auto-executed.
2. **No auto-run**: `autoRun` and `autoApprove` are blocked at the validation level.
3. **Safety first**: Every loop action passes through evaluation gates and policy checks.
4. **Proposal-only mutations**: Any write/external action discovered during a loop run must go through approval flow.
5. **Secret-free**: All snapshot data and reports are sanitized — no tokens, URLs, or secrets leaked.

## Components

| Component | Purpose |
|---|---|
| `operating-loop-registry` | Register, validate, enable, disable loops |
| `operating-loop-store` | Persist loops, runs, snapshots |
| `system-state-collector` | Collect state from all subsystems |
| `operating-snapshot-builder` | Build health snapshot from state |
| `blocker-detector` | Detect blockers (safety, deploy, cost, etc.) |
| `next-action-synthesizer` | Recommend next action based on state |
| `operating-loop-report-generator` | Generate daily/weekly AI OS reports |
| `operating-loop-policy` | Enforce mode-based policies |
| `operating-loop-cost-guard` | Estimate cost and check budget |
| `operating-loop-evaluation-gate` | Safety eval before any loop action |
| `operating-loop-proposal-bridge` | Create executor proposals from loop findings |
| `operating-loop-notifier` | Send notifications (rate-limited) |

## Default Loops

- Daily AI OS Briefing
- Project Operator Review
- Portfolio Priority Review
- Production Health Review
- Incident Review
- Cost & Budget Review
- Pending Approval Review
- Knowledge & Memory Review
- LifeOS Daily Review
- Weekly Strategy Review

## Dashboard

The Operating Loop dashboard tab (`#operating-loop`) provides:
- Loop status cards with enable/disable/run controls
- Current snapshot health (green/yellow/red)
- Blocker list
- Recommended next action
- Pending proposals
- Daily/weekly report generation
- Run history

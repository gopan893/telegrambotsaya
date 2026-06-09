# Stable AI OS v1 Production Release

## Overview

This document describes the Stable AI OS v1.0.0 Production Release process.

The production release finalizes the v1.0.0-rc.1 candidate after RC stabilization audit (Phase 50.5), runs rollout readiness gates, creates GitHub release/tag proposals, creates production deploy proposals, and manages post-release monitoring.

## Release Process

1. Verify RC 50/50.5 readiness
2. Create production release plan (v1.0.0)
3. Run rollout readiness gate
4. Create GitHub tag/release proposal (proposal only)
5. Create production deploy proposal (proposal only)
6. Run release verification checks
7. Execute approved proposals
8. Start post-release health monitoring
9. Track SLO metrics
10. Generate post-release report

## Key Modules

### src/release/
- production-release-store — In-memory production release store
- production-release-manager — Create, verify, finalize production releases
- rollout-readiness-gate — Check docs, env, security, deploy, monitoring readiness
- release-rollout-planner — Plan rollout stages, checklists, rollback rehearsal
- github-release-proposal-builder — Build GitHub tag/release proposals (proposal only)
- production-deploy-proposal-builder — Build deploy/rollback proposals (proposal only)
- release-verification-checker — Verify boot, dashboard, telegram, webhook, storage, API, secrets
- release-announcement-generator — Generate release announcement text
- release-postmortem-template — Postmortem template for incident response

### src/reliability/
- slo-registry — 12 default SLOs with configurable targets
- slo-monitor — Evaluate SLO status, detect violations, calculate burn rate
- post-release-monitor — Start, check, complete post-release monitoring
- release-health-window — Open/record/summarize/close health windows
- uptime-latency-tracker — Track uptime and latency samples
- regression-watchdog — Watch 5 regression domains, create incidents
- reliability-scorecard — Calculate reliability scores across modules
- reliability-alerts — Build, send, suppress reliability alerts
- reliability-report-generator — Generate comprehensive reliability reports

## Dashboard

- Production Release tab (data-tab="production-release")
- Reliability tab (data-tab="reliability")

## Safety Rules

- All release/tag/deploy/rollback actions require proposal + approval
- No direct GitHub tag/release from runtime
- No direct deploy/rollback from runtime
- Secrets redacted in all outputs
- Hard delete blocked by default

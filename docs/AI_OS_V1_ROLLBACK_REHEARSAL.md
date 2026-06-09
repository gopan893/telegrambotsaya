# Rollback Rehearsal

## Overview

Rollback procedures are proposal-only. No direct rollback from dashboard, Telegram, or runtime.

## Rollback Trigger

- SLO violation (critical severity)
- Critical incident detected
- User-reported regression
- Post-release health window failure

## Rollback Procedure

1. Identify rollback trigger
2. Create rollback proposal via /api/dashboard or Telegram
3. Submit to Evaluation v2 for assessment
4. Executor approves rollback proposal
5. Execute approved rollback (RESTORE previous stable version on Render)
6. Verify app boots after rollback
7. Verify dashboard functional after rollback
8. Verify Telegram functional after rollback
9. Generate post-rollback incident report

## Recovery After Rollback

- Fix root cause in development
- Create new release candidate
- Run RC stabilization audit
- Create new production release proposal
- Go through full release process again

## Safety Rules

- No direct rollback from runtime
- Rollback requires Evaluation v2 + executor approval
- Rollback proposal includes reason and post-rollback verification plan
- Post-rollback incident report documents root cause and lessons learned

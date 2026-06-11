# Phase T3 — Telegram Natural Router Report

## Modules Created (11)
- telegram-intent-classifier.js — Classify intent by pattern matching
- telegram-domain-router.js — Route to domain handler
- telegram-context-builder.js — Build context per domain
- telegram-agent-selector.js — Select agent by domain
- telegram-risk-detector.js — Detect dangerous actions
- telegram-privacy-filter.js — Filter private data
- telegram-router-explainer.js — Explain routing decisions
- telegram-router-regression-guard.js — Regression test suite
- telegram-router-utils.js — Utilities

## Intent Classification
Detects: coding, project, deploy, security, privacy, memory, workflow, device, approval, research, cost, troubleshooting, normal chat

## Risk Detection
Dangerous patterns detected and blocked:
- Direct deploy/rollback/push
- Auto-approve
- Secret exposure
- Shell execution
- Mass delete
- Direct restart

## Privacy
- Group chat: private data blocked
- Private/Life OS data blocked in wrong domain
- Secrets always redacted

## Regression Guard
23 test cases covering all domains and risk scenarios.

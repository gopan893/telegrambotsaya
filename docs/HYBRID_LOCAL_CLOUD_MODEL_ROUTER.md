# Hybrid Local/Cloud AI Model Router

## Overview
Intelligent model routing system that selects between local and cloud AI providers based on task type, privacy requirements, cost constraints, quality needs, and availability.

## Flow
1. User request enters AI pipeline.
2. Router classifies task type, privacy level, complexity, cost level, latency.
3. Local model preferred for private/simple/offline-safe tasks.
4. Cloud model preferred for heavy coding/reasoning/research.
5. Cost guard checks budget.
6. Privacy guard blocks private data from unsafe cloud routing.
7. Fallback selected if primary unavailable.
8. Decision audited with no secrets.

## Modules

| Module | Role |
|--------|------|
| `model-provider-registry.js` | 7 default providers (local, cloud, fallback) |
| `model-capability-registry.js` | 4+ capabilities per provider |
| `task-model-classifier.js` | 13 task classes |
| `privacy-aware-routing-policy.js` | Private data blocked from cloud |
| `cost-aware-routing-policy.js` | Economy/quality routing with budget check |
| `local-model-adapter.js` | OpenAI-compatible + Ollama (fail-soft) |
| `cloud-model-adapter.js` | Cloud provider wrapper (read-only) |
| `model-fallback-manager.js` | Fallback chain for timeout/unavailable/budget/privacy |
| `model-health-checker.js` | Provider health monitoring |
| `model-benchmark-runner.js` | Smoke benchmark (safe) |
| `model-routing-decision-engine.js` | Route selection with explanation |
| `model-router-audit.js` | Audit logging (no secrets) |

## Dashboard
- Tab: `#model-router`
- Aliases: `models`, `local-ai`, `cloud-ai`, `ai-router`, `hybrid-ai`
- API base: `/api/dashboard/model-router`

## Security
- No secrets in audit/logs.
- Private Life OS data blocked from cloud.
- Redaction applied before cloud routing.
- No API key values exposed.

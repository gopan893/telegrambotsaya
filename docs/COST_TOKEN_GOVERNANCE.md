# Cost & Token Governance

## Overview

Phase 38 adds cost tracking, token estimation, budget management, and model usage optimization to the Telegram AI OS.

## Modules

### src/cost/cost-usage-store.js
Records model usage events with metadata. No secrets stored. Supports filtering by workspace, user, source, model, date range.

Sources: natural_chat, agent_router, council, delegation, decision, executor, evaluation, integration, coding_workspace, routine, observability, incident_response.

### src/cost/token-estimator.js
Estimates token counts from text, messages, prompts, response types, and workflows. All estimates are approximate and marked `estimated: true`.

### src/cost/cost-estimator.js
Estimates cost based on provider/model pricing from the registry. Falls back to `unknown` if model price not registered.

### src/cost/model-cost-registry.js
Pre-configured model pricing for OpenAI, Mistral, Groq, Google, local, unknown. Supports add/update/remove. Find cheapest or best model for task.

### src/cost/model-selection-policy.js
Selects model based on request type, complexity, and mode (economy/balanced/quality/local_first/manual). Simple chat uses cheap model; coding/debug uses stronger model; council restricted by policy.

### src/cost/budget-policy.js
Daily/weekly/monthly token and cost limits. Configurable warning threshold. Optional hard limit with overage with approval support.

### src/cost/budget-guard.js
Pre-flight check before expensive operations. Warns, requires approval, or blocks based on budget status. High-cost council/evaluation can require approval. Small chat never blocked.

### src/cost/usage-aggregator.js
Aggregates usage by daily/weekly/monthly periods, by agent, model, feature. Provides cost trends and top expensive workflows.

### src/cost/cost-alerts.js
Creates budget threshold alerts (50%, 80%, 100%), cost spike detection, expensive workflow alerts. Suppresses duplicate alerts.

### src/cost/prompt-compression-advisor.js
Suggests prompt compression while preserving safety instructions. Reduces context for cost. Recommends cheaper model alternatives.

### src/cost/cost-utils.js
Formatting utilities for cost, tokens, percentages. Sanitization for logging. Mode display info.

## Security

- No secrets stored in usage events.
- Secret patterns redacted before storage.
- Prompt compression preserves safety rules.
- Budget guard does not bypass executor/evaluation safety.
- Dashboard API never exposes raw prompts or API keys.

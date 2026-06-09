# Automation Recipe Builder

## Overview

The Recipe Builder allows users to create event-driven automations without writing code. A recipe defines a trigger, optional conditions, and a sequence of actions. Recipes are stored as JSON and executed by the recipe engine.

---

## Recipe Structure

```json
{
  "id": "recipe_001",
  "name": "Daily Standup Reminder",
  "enabled": true,
  "trigger": { "type": "cron", "params": { "expression": "0 9 * * 1-5" } },
  "conditions": [
    { "type": "is_weekday", "params": {} }
  ],
  "variables": {
    "team": "Engineering"
  },
  "actions": [
    { "type": "send_message", "params": { "channel": "general", "text": "Time for standup, {{team}}!" } }
  ],
  "parallel": [],
  "metadata": {
    "created": "2026-06-01T08:00:00Z",
    "template": "daily_summary"
  }
}
```

---

## Trigger Registry (10 Types)

| # | Type | Category | Description |
|---|------|----------|-------------|
| 1 | `cron` | Scheduled | Cron expression (5- or 6-field) |
| 2 | `interval` | Scheduled | Repeat every N minutes/hours/days |
| 3 | `webhook` | Event | Incoming HTTP webhook with payload matching |
| 4 | `connector_event` | Event | Event emitted by any registered connector |
| 5 | `telegram_command` | Event | Telegram bot command (`/command`) |
| 6 | `telegram_message` | Event | Telegram message matching a pattern |
| 7 | `knowledge_change` | Event | Document added/updated/removed from knowledge base |
| 8 | `recipe_completed` | Event | Another recipe finishes execution |
| 9 | `system_alert` | Event | System metric crosses a threshold |
| 10 | `time_range` | Scheduled | Active only within a defined time window |

See `RECIPE_TRIGGERS_ACTIONS_REFERENCE.md` for full parameter details.

---

## Action Registry (16 Types)

| # | Type | Category | Description |
|---|------|----------|-------------|
| 1 | `send_message` | Communication | Send a message via Telegram (or connector) |
| 2 | `send_email` | Communication | Send an SMTP email |
| 3 | `create_issue` | Project Mgmt | Create issue in Jira/GitHub/Linear |
| 4 | `update_issue` | Project Mgmt | Update issue fields or status |
| 5 | `webhook_request` | HTTP | Make an outbound HTTP request |
| 6 | `knowledge_search` | Knowledge | Execute a RAG query |
| 7 | `knowledge_add` | Knowledge | Add a document to the knowledge base |
| 8 | `knowledge_delete` | Knowledge | Remove a document from the knowledge base |
| 9 | `connector_action` | Integration | Invoke a connector-specific action |
| 10 | `run_recipe` | Control | Execute another recipe by ID |
| 11 | `parallel_fork` | Control | Run multiple action branches concurrently |
| 12 | `set_variable` | Data | Assign a variable for downstream use |
| 13 | `log_message` | Utility | Write to the automation log |
| 14 | `wait` | Utility | Pause execution for a duration |
| 15 | `notify_admin` | Utility | Send alert to configured admin channels |
| 16 | `http_request` | HTTP | Generic HTTP request (GET/POST/PUT/DELETE) |

See `RECIPE_TRIGGERS_ACTIONS_REFERENCE.md` for full parameter details.

---

## Condition Engine (10 Types)

| # | Type | Description |
|---|------|-------------|
| 1 | `is_weekday` | True Monday–Friday |
| 2 | `is_weekend` | True Saturday–Sunday |
| 3 | `time_between` | True within a time range (HH:MM–HH:MM) |
| 4 | `variable_match` | Variable equals/contains/matches a pattern |
| 5 | `payload_match` | Trigger payload matches a JSON path expression |
| 6 | `rate_limit` | Throttle execution to N times per window |
| 7 | `random_chance` | Probability gate (0.0–1.0) |
| 8 | `and_condition` | Logical AND of sub-conditions |
| 9 | `or_condition` | Logical OR of sub-conditions |
| 10 | `not_condition` | Logical NOT of a single condition |

Conditions are evaluated in order. If any condition fails, the recipe is skipped (logged as `skipped`).

---

## Execution Engine

- **State machine**: `pending → running → completed | failed | skipped`
- **Retry policy**: Configurable (default 3 retries, 30s/60s/120s backoff)
- **Timeout**: Per-action timeout (default 30s; configurable per recipe)
- **Concurrency**: Max 5 concurrent recipe executions system-wide
- **Queue**: FIFO queue with priority levels (critical > normal > low)
- **Persistence**: Execution state written to `storage/recipes/journal/`

---

## Template Library (6 Templates)

| Template | Trigger | Actions | Description |
|----------|---------|---------|-------------|
| `daily_summary` | cron `0 8 * * 1-5` | send_message, knowledge_search | Morning briefing with knowledge base digest |
| `weekly_review` | cron `0 10 * * 1` | send_email, create_issue | Weekly progress report |
| `error_alert` | system_alert | send_message, notify_admin | Real-time error notification |
| `goal_milestone` | connector_event | send_message, knowledge_add | Track project milestones |
| `weekly_health_check` | cron `0 9 * * 1` | connector_action, send_message | System health check report |
| `webhook_data_ingest` | webhook | knowledge_add, log_message | Ingest external data into knowledge base |

See `RECIPE_TEMPLATE_LIBRARY.md` for full details.

---

## Dry-Run Mode

Recipes can be executed in dry-run mode:

- Trigger detection runs normally
- Conditions are evaluated and reported
- Actions are logged but not committed (connector calls are mocked)
- Returns a report: `"Would send message to #general: 'Hello'"`

Dry-run respects rate limits and provides execution timing estimates.

---

## Scheduling

- **Cron-based**: Unix cron expression (5-field standard, 6-field with seconds)
- **Interval-based**: Minimum 1 minute, maximum 30 days
- **Time range**: Active only within specified hours (e.g., 09:00–18:00)
- **Timezone**: Configurable per recipe (default UTC)
- **Missed executions**: Catch-up policy (skip, run-latest, run-all)

---

## Rollback

When an action fails after retries, the engine triggers rollback:

- Each action can declare an `undo` behavior
- Completed actions in the recipe are reversed in reverse order
- Rollback failure does not prevent further rollback (logged as `rollback_failed`)
- Destructive actions (e.g., `knowledge_delete`) require explicit user confirmation to roll back

---

## Variable Interpolation

Variables use `{{mustache}}` syntax:

- **Predefined**: `{{trigger.type}}`, `{{trigger.payload}}`, `{{now}}`, `{{uuid}}`, `{{recipe.id}}`
- **User-defined**: Set via `set_variable` action or defined in recipe `variables` block
- **Filter modifiers**: `{{value|uppercase}}`, `{{value|date:"YYYY-MM-DD"}}`, `{{value|json}}`
- **Conditional blocks**: `{{#if condition}}...{{/if}}`

---

## Parallel Fork

The `parallel_fork` action accepts an array of action branches:

```json
{
  "type": "parallel_fork",
  "params": {
    "branches": [
      { "actions": [{ "type": "send_message", ... }] },
      { "actions": [{ "type": "create_issue", ... }] }
    ],
    "waitForAll": true,
    "timeout": 120
  }
}
```

All branches execute concurrently. If `waitForAll` is true, the recipe waits for all branches to complete before continuing. Timeout aborts any remaining branches and marks them as `timed_out`.

---

## Security & Privacy

- Recipe definitions are stored as JSON in the managed config directory
- Secrets referenced in actions (e.g., webhook URLs) are resolved from the secrets vault, never stored inline
- Recipe logs are retained for 30 days then auto-purged
- Users can only view/edit recipes they own (multi-tenant isolation)
- Recipe execution respects the permission scope of the triggering plugin

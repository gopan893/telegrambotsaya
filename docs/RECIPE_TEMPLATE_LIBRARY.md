# Recipe Template Library

## Overview

Six built-in recipe templates provide ready-to-use automations. Templates are starting points — users can customize parameters, add conditions, or extend actions after instantiation.

---

## 1. Daily Summary

**ID**: `daily_summary`  
**Trigger**: `cron` — `0 8 * * 1-5` (weekdays at 08:00)  
**Category**: Productivity

**Description**: Sends a morning briefing to a Telegram channel with a knowledge base digest and action items.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `knowledge_search` | `query`: "summary for today {{now\|date:'YYYY-MM-DD'}}" |
| 2 | `send_message` | `channel`: "{{trigger.payload.channel\|default:'daily'}}" |

**User-configurable**:
- Target channel or group
- Knowledge base search query template
- Additional actions (e.g., send email copy)
- Condition to skip on weekends (built-in `is_weekday`)

---

## 2. Weekly Review

**ID**: `weekly_review`  
**Trigger**: `cron` — `0 10 * * 1` (Mondays at 10:00)  
**Category**: Productivity

**Description**: Compiles a weekly progress report by searching the knowledge base for activity from the past 7 days and creating a summary issue in the configured project tracker.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `knowledge_search` | `query`: "activity last 7 days {{now\|date:'YYYY-MM-DD'}}" |
| 2 | `create_issue` | `title`: "Weekly Review — {{now\|date:'YYYY-MM-DD'}}" |
| 3 | `send_message` | `text`: "Weekly review created: {{actions.0.result}}" |

**User-configurable**:
- Project tracker integration (Jira / GitHub / Linear)
- Issue template (title prefix, labels, assignee)
- Distribution list for email summary

---

## 3. Error Alert

**ID**: `error_alert`  
**Trigger**: `system_alert` — threshold: `error.count > 0`  
**Category**: Monitoring

**Description**: Immediately notifies the admin channel when the system detects errors, with context from the knowledge base and a diagnostic summary.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `notify_admin` | `level`: "critical" |
| 2 | `send_message` | `text`: "🚨 Error detected: {{trigger.payload.message}}" |

**User-configurable**:
- Error severity threshold
- Admin notification channels (Telegram, email, Slack)
- Cooldown period (default 5 minutes between alerts via `rate_limit` condition)
- Auto-create issue in project tracker

---

## 4. Goal Milestone

**ID**: `goal_milestone`  
**Trigger**: `connector_event` — source: any project tracker  
**Category**: Project Management

**Description**: When an issue or task transitions to a specified milestone status (e.g., "Done", "Shipped"), logs the achievement to the knowledge base and broadcasts to the team.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `knowledge_add` | `title`: "Milestone: {{trigger.payload.title}}" |
| 2 | `send_message` | `text`: "🎉 Milestone reached: {{trigger.payload.title}}" |

**User-configurable**:
- Source connector (Jira / GitHub / Linear)
- Target status values that trigger the recipe
- Knowledge base tags for milestone entries
- Additional notification channels

---

## 5. Weekly Health Check

**ID**: `weekly_health_check`  
**Trigger**: `cron` — `0 9 * * 1` (Mondays at 09:00)  
**Category**: System Administration

**Description**: Runs configured connector health checks and compiles a status report. Reports degraded or failing connectors.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `connector_action` | `action`: "health_check", `connector`: "all" |
| 2 | `send_message` | `text`: "Health check results: {{actions.0.result}}" |

**User-configurable**:
- Connector scope (all or specific connectors)
- Degradation threshold for alerting (e.g., response time > 2s)
- Additional diagnostic actions (e.g., run a test webhook)
- Report destination (channel, email, or both)

---

## 6. Webhook Data Ingest

**ID**: `webhook_data_ingest`  
**Trigger**: `webhook` — path: `/ingest/:source`  
**Category**: Data Integration

**Description**: Receives incoming webhook payloads and stores them as documents in the knowledge base. Supports payload transformation via variable interpolation.

**Default Actions**:
| Order | Type | Params |
|-------|------|--------|
| 1 | `knowledge_add` | `content`: "{{trigger.payload\|json}}" |
| 2 | `log_message` | `text`: "Ingested from {{trigger.params.source}}" |

**User-configurable**:
- Webhook path and expected payload schema
- Knowledge base source tag (e.g., `@source:webhook_<name>`)
- Payload transformation template
- Validation condition (`payload_match` for required fields)

---

## Template Instantiation

When a user instantiates a template:

1. The template JSON is deep-copied into a new recipe with a fresh `id`
2. User-configurable fields prompt for values (with defaults pre-filled)
3. The recipe is saved in the `enabled: false` state for review
4. User reviews, optionally edits, and enables

Templates cannot modify the user's copy after instantiation — each copy is independent.

---

## Creating Custom Templates

Users can save any enabled recipe as a custom template via the Dashboard or CLI:

```
recipe template save <recipe-id> --name "My Template" --description "..."
```

Custom templates appear alongside built-in templates in the recipe creator UI and are stored under `config/recipes/templates/custom/`.

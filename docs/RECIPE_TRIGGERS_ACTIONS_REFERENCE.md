# Recipe Triggers & Actions Reference

## Triggers (10 Types)

---

### 1. cron
- **Type**: `cron`
- **Category**: Scheduled
- **Description**: Fires on a cron schedule using standard 5-field or 6-field expressions.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `expression` | string | yes | — | Cron expression (e.g., `0 8 * * 1-5`) |
  | `timezone` | string | no | `UTC` | IANA timezone name (e.g., `America/New_York`) |

---

### 2. interval
- **Type**: `interval`
- **Category**: Scheduled
- **Description**: Fires at a fixed interval.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `minutes` | number | no | — | Interval in minutes |
  | `hours` | number | no | — | Interval in hours (alternative to minutes) |
  | `days` | number | no | — | Interval in days (alternative to minutes) |
  | `runImmediately` | boolean | no | `false` | Fire once on recipe enable before first interval |

---

### 3. webhook
- **Type**: `webhook`
- **Category**: Event
- **Description**: Fires on an incoming HTTP request to the webhook endpoint.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `path` | string | yes | — | Webhook path suffix (e.g., `/ingest/github`) |
  | `method` | string | no | `POST` | Allowed HTTP method (`GET`, `POST`, `PUT`) |
  | `secret` | string | no | — | HMAC secret for payload verification |

---

### 4. connector_event
- **Type**: `connector_event`
- **Category**: Event
- **Description**: Fires when a registered connector emits an event.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `connector` | string | yes | — | Connector type or instance ID (e.g., `github`, `slack`) |
  | `event` | string | yes | — | Event name (e.g., `push`, `message`, `issue_create`) |
  | `filter` | object | no | `{}` | JSON path conditions to match against the event payload |

---

### 5. telegram_command
- **Type**: `telegram_command`
- **Category**: Event
- **Description**: Fires when a Telegram bot command is received.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `command` | string | yes | — | Command name without slash (e.g., `status`, `help`) |
  | `chat_id` | string | no | `*` | Restrict to specific chat ID or `*` for all |
  | `role` | string | no | `any` | Require sender role (`admin`, `user`, `any`) |

---

### 6. telegram_message
- **Type**: `telegram_message`
- **Category**: Event
- **Description**: Fires when a Telegram message matches a pattern.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `pattern` | string | yes | — | Regex or keyword pattern to match message text |
  | `chat_id` | string | no | `*` | Restrict to specific chat ID |
  | `match_type` | string | no | `contains` | `contains`, `regex`, `exact`, `starts_with` |

---

### 7. knowledge_change
- **Type**: `knowledge_change`
- **Category**: Event
- **Description**: Fires when the knowledge base is modified.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `change_type` | string | no | `any` | `add`, `update`, `delete`, or `any` |
  | `source` | string | no | `*` | Document source filter (`manual`, `connector`, `*`) |
  | `tag` | string | no | — | Document tag filter |

---

### 8. recipe_completed
- **Type**: `recipe_completed`
- **Category**: Event
- **Description**: Fires when another recipe finishes execution.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `recipe_id` | string | yes | — | ID of the recipe to watch |
  | `status` | string | no | `completed` | `completed`, `failed`, `skipped`, or `any` |

---

### 9. system_alert
- **Type**: `system_alert`
- **Category**: Event
- **Description**: Fires when a system metric crosses a defined threshold.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `metric` | string | yes | — | Metric name (`error.count`, `cpu.usage`, `memory.usage`, `connector.health`) |
  | `operator` | string | yes | — | Comparison (`>`, `<`, `>=`, `<=`, `==`) |
  | `threshold` | number | yes | — | Threshold value |
  | `window` | number | no | `60` | Evaluation window in seconds |

---

### 10. time_range
- **Type**: `time_range`
- **Category**: Scheduled
- **Description**: Active only within a defined daily time window. Typically combined with other triggers via conditions.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `start` | string | yes | — | Start time in `HH:MM` format (24h) |
  | `end` | string | yes | — | End time in `HH:MM` format (24h) |
  | `timezone` | string | no | `UTC` | IANA timezone name |
  | `days` | string[] | no | `["all"]` | Active days (`mon`, `tue`, ..., `sun`, `all`, `weekdays`, `weekends`) |

---

## Actions (16 Types)

---

### 1. send_message
- **Type**: `send_message`
- **Category**: Communication
- **Description**: Sends a message to a Telegram chat or configured connector channel.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `channel` | string | no | `default` | Channel/chat identifier |
  | `text` | string | yes | — | Message content (supports Markdown and variable interpolation) |
  | `parse_mode` | string | no | `Markdown` | `Markdown`, `HTML`, or `none` |
  | `disable_notification` | boolean | no | `false` | Send silently |

---

### 2. send_email
- **Type**: `send_email`
- **Category**: Communication
- **Description**: Sends an email via the SMTP connector.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `to` | string | yes | — | Recipient email address(es), comma-separated |
  | `subject` | string | yes | — | Email subject line |
  | `body` | string | yes | — | Email body (HTML or plain text) |
  | `format` | string | no | `html` | `html` or `text` |
  | `cc` | string | no | — | CC recipients |

---

### 3. create_issue
- **Type**: `create_issue`
- **Category**: Project Management
- **Description**: Creates an issue in the configured project tracker (Jira / GitHub / Linear).
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `title` | string | yes | — | Issue title |
  | `description` | string | no | — | Issue description body |
  | `labels` | string[] | no | `[]` | Label/tag list |
  | `assignee` | string | no | — | Assignee username or ID |
  | `priority` | string | no | `medium` | `critical`, `high`, `medium`, `low` |
  | `connector` | string | no | `default` | Connector instance to use |

---

### 4. update_issue
- **Type**: `update_issue`
- **Category**: Project Management
- **Description**: Updates an existing issue's fields or status.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `issue_id` | string | yes | — | Issue ID or key |
  | `fields` | object | no | `{}` | Field updates (e.g., `{"status": "Done"}`) |
  | `comment` | string | no | — | Comment to add to the issue |
  | `connector` | string | no | `default` | Connector instance to use |

---

### 5. webhook_request
- **Type**: `webhook_request`
- **Category**: HTTP
- **Description**: Makes an outbound HTTP request to a configured webhook URL.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `url` | string | yes | — | Webhook URL |
  | `method` | string | no | `POST` | HTTP method |
  | `headers` | object | no | `{}` | Custom headers |
  | `body` | any | no | `{}` | Request payload |
  | `secret` | string | no | — | HMAC signing secret |

---

### 6. knowledge_search
- **Type**: `knowledge_search`
- **Category**: Knowledge
- **Description**: Executes a RAG query against the knowledge base.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `query` | string | yes | — | Search query (supports filter syntax) |
  | `limit` | number | no | `5` | Max results to return |
  | `mode` | string | no | `hybrid` | `hybrid`, `vector`, `keyword` |

---

### 7. knowledge_add
- **Type**: `knowledge_add`
- **Category**: Knowledge
- **Description**: Adds a document to the knowledge base.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `title` | string | yes | — | Document title |
  | `content` | string | yes | — | Document content body |
  | `source` | string | no | `recipe` | Source tag |
  | `tags` | string[] | no | `[]` | Document tags |
  | `type` | string | no | `text` | Document type |

---

### 8. knowledge_delete
- **Type**: `knowledge_delete`
- **Category**: Knowledge
- **Description**: Removes a document from the knowledge base.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `doc_id` | string | yes* | — | Document ID to delete |
  | `query` | string | yes* | — | Query to match documents for deletion |
  | `confirm` | boolean | no | `false` | Must be `true` to proceed (safety gate) |

\* Exactly one of `doc_id` or `query` is required.

---

### 9. connector_action
- **Type**: `connector_action`
- **Category**: Integration
- **Description**: Invokes a custom action on a specific connector.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `connector` | string | yes | — | Connector type or instance ID |
  | `action` | string | yes | — | Action name (e.g., `health_check`, `sync`, `archive`) |
  | `params` | object | no | `{}` | Action-specific parameters |

---

### 10. run_recipe
- **Type**: `run_recipe`
- **Category**: Control
- **Description**: Executes another recipe by ID.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `recipe_id` | string | yes | — | Target recipe ID |
  | `wait` | boolean | no | `true` | Wait for completion before continuing |
  | `timeout` | number | no | `60` | Max wait time in seconds |
  | `variables` | object | no | `{}` | Variables to pass to the child recipe |

---

### 11. parallel_fork
- **Type**: `parallel_fork`
- **Category**: Control
- **Description**: Executes multiple action branches concurrently.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `branches` | array | yes | — | Array of branch objects, each with an `actions` array |
  | `waitForAll` | boolean | no | `true` | Wait for all branches to complete |
  | `timeout` | number | no | `120` | Overall timeout in seconds |

---

### 12. set_variable
- **Type**: `set_variable`
- **Category**: Data
- **Description**: Sets a variable for use in downstream actions.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `name` | string | yes | — | Variable name (must match `[a-zA-Z_][a-zA-Z0-9_]*`) |
  | `value` | any | yes | — | Variable value (string, number, boolean, object, or array) |

---

### 13. log_message
- **Type**: `log_message`
- **Category**: Utility
- **Description**: Writes a message to the automation execution log.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `text` | string | yes | — | Log message content |
  | `level` | string | no | `info` | `info`, `warn`, `error`, `debug` |

---

### 14. wait
- **Type**: `wait`
- **Category**: Utility
- **Description**: Pauses execution for a specified duration.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `seconds` | number | yes | — | Duration in seconds (1–3600) |

---

### 15. notify_admin
- **Type**: `notify_admin`
- **Category**: Utility
- **Description**: Sends an alert to all configured admin notification channels.
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `message` | string | yes | — | Alert message |
  | `level` | string | no | `info` | `info`, `warning`, `critical` |
  | `data` | object | no | `{}` | Additional context data for the alert |

---

### 16. http_request
- **Type**: `http_request`
- **Category**: HTTP
- **Description**: Executes a generic HTTP request (GET/POST/PUT/DELETE).
- **Params**:
  | Param | Type | Required | Default | Description |
  |-------|------|----------|---------|-------------|
  | `url` | string | yes | — | Full request URL |
  | `method` | string | no | `GET` | HTTP method |
  | `headers` | object | no | `{}` | Custom headers |
  | `body` | any | no | — | Request body (for POST/PUT) |
  | `timeout` | number | no | `30` | Request timeout in seconds |
  | `response_mapping` | string | no | — | JSON path to extract from response into variable |

---

## Variable Access in Params

Any param value supports `{{mustache}}` variable interpolation. Available variables:

| Variable | Source |
|----------|--------|
| `{{trigger.type}}` | Current trigger type |
| `{{trigger.payload.*}}` | Trigger event payload |
| `{{trigger.params.*}}` | Trigger parameter values |
| `{{actions.<index>.result}}` | Previous action result |
| `{{recipe.id}}` | Current recipe ID |
| `{{recipe.name}}` | Current recipe name |
| `{{now}}` | Current timestamp |
| `{{uuid}}` | Random UUID |
| `{{vars.<name>}}` | User-defined variables |

# Env Drift Detection

## Purpose

The Env Drift Detector compares the currently loaded environment variables against a defined manifest of required, recommended, and optional variables. It detects missing variables, deprecated variables, dangerous flag configurations, and common typos. The detector is name-only — it never reads, logs, or exposes the values of any environment variable.

## Required Core Env Vars (10)

These variables must be present for the system to function. Absence of any required var is a critical finding.

| # | Variable Name | Purpose |
|---|---------------|---------|
| 1 | `TELEGRAM_BOT_TOKEN` | Telegram bot authentication |
| 2 | `GITHUB_TOKEN` | GitHub API authentication |
| 3 | `DATABASE_URL` | PostgreSQL connection string |
| 4 | `REDIS_URL` | Redis connection string |
| 5 | `RENDER_API_KEY` | Render deployment API key |
| 6 | `OPENAI_API_KEY` | OpenAI API key for model access |
| 7 | `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| 8 | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| 9 | `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| 10 | `SESSION_SECRET` | Dashboard session encryption key |

## Recommended Env Vars (15)

These variables are strongly recommended but not strictly required. Absence generates a warning.

| # | Variable Name | Purpose |
|---|---------------|---------|
| 1 | `TELEGRAM_DEV_BOT_TOKEN` | Development/staging bot token |
| 2 | `GITHUB_APP_ID` | GitHub App ID for fine-grained auth |
| 3 | `GITHUB_APP_PRIVATE_KEY` | GitHub App private key |
| 4 | `RENDER_DEPLOY_HOOK` | Render deploy hook URL |
| 5 | `GOOGLE_REFRESH_TOKEN` | Google OAuth refresh token |
| 6 | `GOOGLE_CALENDAR_ID` | Primary calendar ID |
| 7 | `CLOUDFLARE_ZONE_ID` | Cloudflare zone/DNS zone ID |
| 8 | `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel auth token |
| 9 | `SENTRY_DSN` | Error tracking DSN |
| 10 | `SLACK_WEBHOOK_URL` | Slack notification webhook |
| 11 | `LOG_LEVEL` | Logging verbosity (default: INFO) |
| 12 | `PORT` | HTTP server port (default: 8000) |
| 13 | `HOST` | HTTP server host (default: 0.0.0.0) |
| 14 | `BACKUP_DIR` | Backup storage directory path |
| 15 | `TZ` | Timezone (default: UTC) |

## Optional Integration Env Vars (25)

These variables enable specific integrations. Absence is informational only.

| # | Variable Name | Integration |
|---|---------------|-------------|
| 1 | `GMAIL_ADDRESS` | Gmail connector |
| 2 | `GMAIL_APP_PASSWORD` | Gmail app password |
| 3 | `GOOGLE_DRIVE_FOLDER_ID` | Google Drive connector |
| 4 | `GOOGLE_SHEETS_ID` | Google Sheets connector |
| 5 | `GOOGLE_DOCS_ID` | Google Docs connector |
| 6 | `NOTION_API_KEY` | Notion integration |
| 7 | `NOTION_DATABASE_ID` | Notion database target |
| 8 | `JIRA_URL` | Jira integration |
| 9 | `JIRA_API_TOKEN` | Jira API token |
| 10 | `JIRA_EMAIL` | Jira account email |
| 11 | `SLACK_BOT_TOKEN` | Slack bot integration |
| 12 | `SLACK_SIGNING_SECRET` | Slack request verification |
| 13 | `DISCORD_BOT_TOKEN` | Discord integration |
| 14 | `TWITTER_API_KEY` | Twitter/X API |
| 15 | `TWITTER_API_SECRET` | Twitter/X API secret |
| 16 | `POSTMARK_API_KEY` | Postmark email service |
| 17 | `POSTMARK_FROM_EMAIL` | Postmark sender address |
| 18 | `STRIPE_API_KEY` | Stripe payment integration |
| 19 | `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| 20 | `GITHUB_WEBHOOK_SECRET` | GitHub webhook verification |
| 21 | `GRAFANA_API_KEY` | Grafana observability |
| 22 | `PAGERDUTY_API_KEY` | PagerDuty alerting |
| 23 | `PAGERDUTY_SERVICE_ID` | PagerDuty service target |
| 24 | `AWS_ACCESS_KEY_ID` | AWS integration |
| 25 | `AWS_SECRET_ACCESS_KEY` | AWS integration |

## Dangerous Flag Detection

The detector scans for the following flags that override safety controls. Presence of any dangerous flag is a critical finding.

| Flag | Risk | Description |
|------|------|-------------|
| `AUTO_APPROVE=true` | critical | Bypasses all human approval gates |
| `AUTO_RUN=true` | critical | Automatically executes proposed actions |
| `SHELL_EXECUTOR=true` | critical | Enables arbitrary shell command execution |
| `DISABLE_GOVERNANCE=true` | critical | Disables the governance evaluation engine |
| `DISABLE_APPROVAL=true` | critical | Disables approval requirements for all actions |

## Common Typo Detection (10 Known Typos)

The detector checks for these common misspellings and suggests corrections:

| Typo | Correction |
|------|------------|
| `TELEGRAM_BOT_TOKE` | `TELEGRAM_BOT_TOKEN` |
| `TELEGRAM_BOT_TOKN` | `TELEGRAM_BOT_TOKEN` |
| `GITHUB_TOKE` | `GITHUB_TOKEN` |
| `DATABSE_URL` | `DATABASE_URL` |
| `DATBASE_URL` | `DATABASE_URL` |
| `OPENAI_KEY` | `OPENAI_API_KEY` |
| `OPENAI_APIKEY` | `OPENAI_API_KEY` |
| `GOOGLE_CLIENTID` | `GOOGLE_CLIENT_ID` |
| `GOOGLE_CLIENT_SECRET_KEY` | `GOOGLE_CLIENT_SECRET` |
| `CLOUDFLARE_TOKEN` | `CLOUDFLARE_API_TOKEN` |

If a typo is detected, the report lists the incorrect name, the correction, and a recommendation to rename or remove the misspelled variable.

## Safety Rules

1. **Show names only, never values.** The detector reads env var *names* via `os.environ.keys()` (or an equivalent safe method). It never accesses `os.environ.get()` or reads values. The report contains variable names, statuses, and recommendations — never values, even masked.
2. **No modification.** The detector is read-only. It does not create, modify, or delete environment variables or files.
3. **No execution order assumption.** The detector works with the currently loaded environment. It does not assume a specific order of env var loading or source.
4. **Typo detection is case-sensitive.** Environment variables are conventionally uppercase. Lowercase variants are reported separately as potential misconfigurations.
5. **Dangerous flags are reported regardless of value.** Even if a dangerous flag is set to `false` or `0`, its presence is reported as a finding because its mere existence indicates a risky configuration practice.

# Connector Catalog

## Overview

Connectors are the platform's integration adapters. Each connector implements a standardized interface (`IConnector`) for authentication, messaging, and lifecycle management. The catalog below lists all built-in connectors organized by category.

---

## Legend

| Icon | Category |
|------|----------|
| 🔌 | Protocol / Transport |
| 💬 | Messaging & Chat |
| 🛠 | Developer Tools |
| 📋 | Project Management |
| 📄 | Document & Knowledge |
| ☁️ | Cloud Storage |
| 📧 | Communication |
| 🌤 | Data & Utility APIs |

---

## Connector List

### 1. HTTP Webhook (🔌)
- **Type**: `http-webhook`
- **Auth**: HMAC signature, shared secret, or mutual TLS
- **Direction**: Inbound (receive) / Outbound (send)
- **Features**: Payload signing, retry with exponential backoff, rate limiting, custom headers
- **Use cases**: Generic webhook receiver, custom API integration

### 2. Slack (💬)
- **Type**: `slack`
- **Auth**: OAuth 2.0 (Bot Token + User Token)
- **Events**: messages, reactions, channels, files
- **Features**: Slash commands, block kit builder, thread replies, channel history
- **Scopes**: `channels:history`, `chat:write`, `reactions:read`

### 3. Discord (💬)
- **Type**: `discord`
- **Auth**: Bot Token
- **Events**: messages, guild members, reactions
- **Features**: Embed builder, slash commands, role-based routing
- **Scopes**: `bot`, `applications.commands`

### 4. GitHub (🛠)
- **Type**: `github`
- **Auth**: Personal Access Token (PAT) or GitHub App installation
- **Events**: push, pull_request, issues, releases, workflow_run
- **Features**: PR review automation, issue triage, release monitoring
- **Rate limit**: 5,000 req/hr (authenticated)

### 5. GitLab (🛠)
- **Type**: `gitlab`
- **Auth**: Personal Access Token or OAuth 2.0
- **Events**: push, merge_request, issues, pipeline, tags
- **Features**: MR approval workflows, pipeline status alerts, commit hooks
- **Rate limit**: 2,000 req/min (self-hosted configurable)

### 6. Jira (📋)
- **Type**: `jira`
- **Auth**: API Token (Basic Auth) or OAuth 2.0
- **Events**: issue_create, issue_update, sprint_change, comment
- **Features**: Issue transitions, custom field mapping, sprint reporting
- **Scopes**: `read:jira-work`, `write:jira-work`

### 7. Linear (📋)
- **Type**: `linear`
- **Auth**: Personal API Key or OAuth 2.0
- **Events**: issue_create, issue_update, comment, cycle_change
- **Features**: Issue sync, team cycles, label management
- **API**: GraphQL (rate limit: 1,000 req/min)

### 8. Notion (📄)
- **Type**: `notion`
- **Auth**: Internal Integration Token (OAuth 2.0)
- **Events**: page_update, database_update
- **Features**: Page CRUD, database queries, block manipulation
- **Scopes**: `read:page`, `write:page`, `read:database`

### 9. Confluence (📄)
- **Type**: `confluence`
- **Auth**: API Token (Basic Auth) or OAuth 2.0
- **Events**: page_create, page_update, comment, attachment
- **Features**: Page search, content tree traversal, label indexing
- **Scopes**: `read:confluence-content`, `write:confluence-content`

### 10. Google Drive (☁️)
- **Type**: `google-drive`
- **Auth**: OAuth 2.0 (service account or user consent)
- **Events**: file_create, file_update, file_trash
- **Features**: File upload/download, folder sync, permission management
- **Scopes**: `https://www.googleapis.com/auth/drive.readonly` or `.drive`

### 11. Dropbox (☁️)
- **Type**: `dropbox`
- **Auth**: OAuth 2.0
- **Events**: file_add, file_edit, file_delete, folder_create
- **Features**: File sync, sharing management, search
- **Rate limit**: 1,200 req/hr per app

### 12. SMTP Email (📧)
- **Type**: `smtp-email`
- **Auth**: SMTP username/password (STARTTLS); IMAP for inbound
- **Features**: Send HTML/text emails, inline attachments, template rendering
- **Inbound**: IMAP IDLE for real-time email reception
- **Security**: TLS required, SPF/DKIM/DMARC alignment validated

### 13. Telegram Bot (💬)
- **Type**: `telegram-bot`
- **Auth**: Bot Token (from BotFather)
- **Events**: message, callback_query, inline_query, command
- **Features**: Rich message formatting, inline keyboards, file upload, poll creation
- **Rate limit**: 30 msg/sec per chat

### 14. OpenWeather (🌤)
- **Type**: `openweather`
- **Auth**: API Key
- **Features**: Current weather, 5-day forecast, air pollution alerts
- **Plans**: Free tier (60 calls/min), paid (unlimited)
- **Data format**: JSON (One Call API 3.0)

### 15. SERP API (🌤)
- **Type**: `serp-api`
- **Auth**: API Key
- **Features**: Google Search results, image search, news, shopping
- **Providers**: Google, Bing, DuckDuckGo
- **Rate limit**: Varies by plan (free: 100 searches/month)

---

## Authentication Methods Summary

| Method | Connectors |
|--------|-----------|
| API Key / Token | GitHub, GitLab, OpenWeather, SERP, Telegram, Linear |
| OAuth 2.0 | Slack, Discord, Google Drive, Dropbox, Notion, Confluence |
| Basic Auth + API Token | Jira, Confluence, SMTP |
| HMAC / Shared Secret | HTTP Webhook |
| Mutual TLS | HTTP Webhook (optional) |

---

## Connection Management

- Each connector stores encrypted credentials in the secrets vault
- Health checks run every 60 seconds (configurable)
- Connection pool per connector type (max 5 concurrent connections)
- Automatic reconnection with backoff (3 retries, 30s/60s/120s intervals)
- Rate limit state tracked globally across plugin instances

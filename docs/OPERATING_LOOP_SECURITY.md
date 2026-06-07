# Operating Loop Security Model

## Core Principles

1. **No Secrets in Output**
   - All snapshot data passes through `deepMask()` and `maskSecret()` before storage or display
   - Secret patterns include: TELEGRAM_TOKEN, DATABASE_URL, GITHUB_TOKEN, GOOGLE_CLIENT_SECRET, CLOUDFLARE_API_TOKEN, REDIS_URL, DASHBOARD_ADMIN_TOKEN
   - API key patterns (sk-*, ghp_*, github_pat_*, gsk_*, tvly_*)
   - Connection strings (postgresql://, redis://)

2. **No Auto-Run**
   - `autoRun` and `autoApprove` are rejected at validation
   - All write/external/danger actions require: Evaluation v2 → executor proposal → approval → run
   - The loop system never executes actions directly

3. **Approval Boundary**
   - All proposals from loop findings require explicit approval
   - High and danger risk actions require owner-level approval
   - Evaluation gate must pass before any proposal is created

4. **Read-Only Default**
   - Loops default to `scheduled_readonly` mode
   - Only read actions (list, view, search, summarize, export, analyze, audit, monitor, inspect, review) are allowed in read-only mode
   - Blocked actions are enforced at the policy level

5. **Notification Spam Prevention**
   - Maximum 3 notifications per day per loop
   - Quiet hours (22:00-07:00) suppress non-urgent notifications
   - Rate limiting at the dashboard API level

## Security Boundaries

```
User/Telegram/Dashboard
        |
        v
  Operating Loop Registry  ← validates config, rejects autoRun/autoApprove
        |
        v
  System State Collector   ← gathers state (no secrets)
        |
        v
  Operating Snapshot       ← deepMask on all data
        |
        v
  Blocker Detector         ← R, no writes
        |
        v
  Next Action Synthesizer  ← recommends only (no execute)
        |
        v
  Evaluation Gate          ← safety check
        |
        v
  Report Generator         ← sanitized, secret-free output
```

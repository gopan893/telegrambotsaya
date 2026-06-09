# AI OS v1 Post-Release Monitoring

## Overview

Post-release monitoring starts after approved production deploy and tracks health across uptime, latency, Telegram response, dashboard availability, webhook status, DB/Redis health, and regressions.

## Health Windows

- Quick window: 30 minutes — verify basic app health
- Standard window: 2 hours — verify SLO compliance
- Observation: 24 hours — comprehensive reliability assessment

## Health Samples

Each health sample records:
- uptime (%)
- latency (ms)
- Telegram command success (boolean)
- Dashboard API success (boolean)
- Webhook status (up/down)
- DB/Redis status (up/down)
- Error count
- Incident count
- User-visible regressions
- Deploy status

## Regression Watchdog

Five regression domains monitored:
1. Dashboard — known tab routing, SW cache, fallback safety
2. Telegram — command registry, bot-to-bot loop prevention
3. Approval boundary — all dangerous actions proposal-only
4. Security/privacy — secret redaction, hard delete blocked, export safety
5. Deploy — deploy/rollback proposal-only

## SLO Monitoring

12 default SLOs:
- app_uptime (>= 99%)
- dashboard_availability (>= 99%)
- telegram_response_success (>= 98%)
- webhook_success (>= 98%)
- render_health (>= 99%)
- postgres_health (>= 99.5%)
- redis_health (>= 99%)
- deploy_success (100%)
- incident_response_time (within 60 min)
- approval_boundary_integrity (100%)
- secret_leak_zero (100%)
- dashboard_route_integrity (100%)

## Alerts

- Critical: immediate alert for P0-level issues
- Warning: summarized periodic alerts
- Rollback recommendation: critical alert with proposal-only rollback
- No spam: alerts suppressed within 5-minute window

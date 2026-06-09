# AI OS v1 Reliability SLO

## Service Level Objectives

| SLO | Target | Window | Severity | Module |
|-----|--------|--------|----------|--------|
| app_uptime | >= 99% | 24h | critical | core |
| dashboard_availability | >= 99% | 24h | high | dashboard |
| telegram_response_success | >= 98% | 24h | high | telegram |
| webhook_success | >= 98% | 24h | high | webhook |
| render_health | >= 99% | 24h | critical | deploy |
| postgres_health | >= 99.5% | 24h | critical | storage |
| redis_health | >= 99% | 24h | high | storage |
| deploy_success | 100% | 30d | critical | deploy |
| incident_response_time | within 60 min | 30d | high | incident |
| approval_boundary_integrity | 100% | 30d | critical | governance |
| secret_leak_zero | 100% | 30d | critical | security |
| dashboard_route_integrity | 100% | 30d | high | dashboard |

## Status Levels

- healthy: current value meets target
- warning: current value below target (within 5% threshold)
- violated: current value below target (more than 5% threshold)

## Reliability Scorecard

| Score | Level | Meaning |
|-------|-------|---------|
| 95-100 | production_stable | Ready for production |
| 85-94 | acceptable | Acceptable with warnings |
| 70-84 | needs_attention | Requires attention before next release |
| < 70 | block_next_release | Block next release until resolved |

## Dashboard SLO tab

The Reliability dashboard tab displays:
- Overall SLO status (healthy/warning/violated)
- Per-SLO current value vs target
- Burn rate for degrading SLOs
- Violation history

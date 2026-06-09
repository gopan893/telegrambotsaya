# AI OS v1 Security & Privacy Notes

## Security

### Approval Safety
- All write/external/danger actions require Evaluation v2 + executor approval
- AUTO_APPROVE_ENABLED must be false for production
- AUTO_RUN_ENABLED must be false for production
- SHELL_EXECUTOR_ENABLED must be false for production

### Secret Protection
- All secrets redacted in dashboard, audit logs, reports, Telegram output
- Secret surface scanner checks 10+ surfaces with 28 patterns
- Credential rotation is manual-checklist only

### Red-Team Safety
- Prompt injection tester detects 16+ injection patterns
- Red-team simulator tests 13 attack categories
- Bot-to-bot loop prevention active

### Env Security
- Env drift detector checks 50+ expected variables
- Dangerous flag detection for AUTO_APPROVE, AUTO_RUN, SHELL_EXECUTOR
- Typo detection for common env variable mistakes

## Privacy

### Data Inventory
- 24 data categories scanned across all modules
- Classification: public/internal/private/sensitive/secret_blocked

### Access Control
- Role-based access: owner/admin/user
- Life OS mood/energy data is owner-only
- Coding agents blocked from private Life OS data

### Retention
- Session data: 30 days
- Audit logs: 180 days
- Mood/energy: 90 days
- Archive preferred over delete

### Export Control
- Strict redaction: no raw tokens, secrets, API keys, or env values exported
- Export requests require proposal + approval

### Delete Safety
- Soft delete by default
- Hard delete requires owner + explicit approval
- Archive preferred over delete
- No direct hard delete from dashboard, Telegram, or API

## Security Scorecard

- Secret protection score
- Environment security score
- Permission security score
- Capability security score
- Approval safety score
- Red-team defense score

## Privacy Scorecard

- Data classification score
- Access control score
- Retention policy score
- Export redaction score
- Hard delete safety score
- Life OS privacy score

## Critical Security Findings (block release)

- AUTO_APPROVE_ENABLED=true
- AUTO_RUN_ENABLED=true
- SHELL_EXECUTOR_ENABLED=true
- Missing TELEGRAM_TOKEN
- Missing DASHBOARD_ADMIN_TOKEN
- Critical secret leakage

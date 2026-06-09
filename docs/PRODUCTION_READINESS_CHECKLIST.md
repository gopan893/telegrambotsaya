# Production Readiness Checklist

## Core Requirements

- [ ] NODE_ENV set to production
- [ ] PORT configured
- [ ] TELEGRAM_TOKEN configured
- [ ] OWNER_CHAT_ID configured
- [ ] ADMIN_IDS configured
- [ ] DASHBOARD_ADMIN_TOKEN configured
- [ ] STORAGE_DRIVER configured (postgres recommended)
- [ ] DATABASE_URL configured
- [ ] AI_PROVIDER configured with valid API key

## Security Gates

- [ ] AUTO_APPROVE_ENABLED is false
- [ ] AUTO_RUN_ENABLED is false
- [ ] SHELL_EXECUTOR_ENABLED is false
- [ ] No token typo in env (e.g., TELEGRAM_TOKEN_PLANNE)
- [ ] Secret scan passes with no critical findings
- [ ] Env drift check passes
- [ ] Security score >= 95

## Privacy Gates

- [ ] Privacy module loaded
- [ ] Retention policies configured
- [ ] Hard delete blocked (soft delete default)
- [ ] Export redaction working
- [ ] Privacy score >= 95

## Approval Boundary Gates

- [ ] Executor approval required
- [ ] External write approval required
- [ ] Integration eval gate required
- [ ] GitHub push approval required
- [ ] Deploy approval required
- [ ] Rollback approval required

## Dashboard Gates

- [ ] All known tabs load correctly
- [ ] No known tab falls back to System Overview
- [ ] Service worker does not cache /api/dashboard/*
- [ ] Dark form UI applied to all input/select/textarea
- [ ] Release Candidate tab functional

## Telegram Gates

- [ ] Bot responds to /start and /help
- [ ] Telegram Control Layer registered
- [ ] Bot-to-bot loop prevention active
- [ ] Rate limiting active
- [ ] Permission guard active

## Deploy Gates

- [ ] Render deploy gate passable
- [ ] Deploy plan generator functional
- [ ] Rollback plan generator functional
- [ ] Post-deploy monitor functional

## Integration Gates

- [ ] Integration evaluation gate active
- [ ] Integration proposal pipeline active
- [ ] Connector quality gates active

## Boot Gates

- [ ] node --check telebot.js passes
- [ ] All required modules import correctly
- [ ] Storage manager initializes
- [ ] Express app starts

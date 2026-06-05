# Deploy Security

## Principles
1. No direct deploy — always requires proposal + approval
2. No direct rollback — always requires proposal + approval
3. No auto-approve — explicit user approval required
4. No secret leakage — env names shown, values never
5. No shell executor — bot runtime never runs shell
6. No auto-run — approved proposal must be explicitly run

## Approval Chain
```
release gate → Evaluation v2 → executor proposal → user /approve → /runexec
```

## Secret Patterns
- TELEGRAM_TOKEN
- DATABASE_URL
- REDIS_URL
- GITHUB_TOKEN
- GOOGLE_CLIENT_SECRET
- CLOUDFLARE_API_TOKEN
- RENDER_DEPLOY_HOOK
- Any variable containing: token, secret, password, api_key

## Logging
- Env checks log names only
- Reports redact all secret patterns
- Audit log records deploy/rollback creation, not values

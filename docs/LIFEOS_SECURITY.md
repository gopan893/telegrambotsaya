# Life OS Security

Life OS handles personal productivity data, so the safety boundary is stricter than normal project planning.

## Secret Handling

Life OS rejects or redacts input matching:

```text
token, secret, password, api_key, Authorization, Bearer, DATABASE_URL, REDIS_URL,
postgresql://, rediss://, sk-, ghp_, github_pat_, gsk_, tvly_, TELEGRAM_TOKEN,
GITHUB_TOKEN, GOOGLE_CLIENT_SECRET, CLOUDFLARE_API_TOKEN, RENDER_DEPLOY_HOOK
```

Secret-like values must not be stored in personal notes, docs, reports, dashboard responses, audit logs, or Knowledge Graph.

## Personal Data

- Mood and energy notes are private by default.
- Crisis-like text is stored only as a redacted private summary.
- Life OS does not diagnose medical/mental health conditions.
- Shared context returns `[PRIVATE_LIFE_CONTEXT]` for private notes.

## External Action Boundary

Calendar, Gmail, routine scheduling, and other external/write actions are proposal-only.

No direct write may run from Telegram, dashboard, natural chat, or routine automation without Evaluation v2 and executor approval.

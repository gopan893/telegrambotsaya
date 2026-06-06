# Cost Module Security

## Secret Redaction

Usage store redacts the following patterns before storing:
- `token`, `secret`, `password`, `api_key`
- `Authorization`, `Bearer` headers
- `DATABASE_URL`, `REDIS_URL` connection strings
- `sk-` (OpenAI keys), `ghp_` (GitHub PAT), `gsk_` (Groq keys), `tvly_` (Tavily keys)
- `TELEGRAM_TOKEN`, `GITHUB_TOKEN`, `GOOGLE_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`
- `RENDER_DEPLOY_HOOK`
- `postgresql://`, `rediss://` URLs

## What Is Never Stored

- Full prompt content (only metadata about the request)
- API keys or tokens
- Full conversation history
- User secrets or credentials

## Dashboard API Protections

- All cost routes are auth-protected (same as other dashboard routes)
- No raw prompts exposed in API responses
- Model registry shows prices only (no credentials)
- Budget policy does not expose environment variables

## Prompt Compression Safety

- Safety markers are detected and preserved
- Approval boundary instructions are never removed
- Secret redaction patterns are kept intact
- User intent is preserved

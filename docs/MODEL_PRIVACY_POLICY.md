# Model Privacy Policy

## Core Rules
1. **Life OS data** (mood, energy, private notes): Local only by default. Cloud requires explicit owner approval.
2. **Secret-blocked data**: Never sent to any model in raw form.
3. **Coding tasks**: Can use cloud after secret redaction.
4. **Security findings**: Stay redacted.
5. **User preference**: Local preferred mode available.

## Privacy Levels
| Level | Description | Cloud Allowed |
|-------|-------------|---------------|
| `strict` | Private Life OS data | No |
| `local_preferred` | Prefer local over cloud | Yes with redaction |
| `local_only` | Force local only | No |
| `normal` | Default | Yes |
| `owner_allowed` | Owner explicitly allowed | Yes |

## Redaction
Before sending to cloud:
- API keys, tokens, passwords replaced with `[REDACTED]`
- `TELEGRAM_TOKEN`, `DATABASE_URL`, `REDIS_URL`, etc. redacted
- Secret patterns (sk-*, ghp_*, etc.) redacted

## Enforcement
- Privacy policy evaluated before every routing decision.
- Unsafe routes are blocked with explanation.
- Audit records privacy decisions without raw data.

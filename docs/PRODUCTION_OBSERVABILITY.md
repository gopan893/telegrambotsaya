# Production Observability

Phase 37 adds a lightweight Production Observability layer for Telegram AI OS.

## What It Checks

- Application runtime health.
- Dashboard status.
- Telegram webhook configuration.
- PostgreSQL/storage driver status.
- Redis cache status.
- Evaluation Harness v2 availability.
- Executor approval boundary availability.
- External integration gate availability.

All checks are read-only and sanitized. Missing optional modules return degraded status, not startup failure.

## Dashboard

Open:

```text
/dashboard#observability
```

The page shows production health cards, open production incidents, root cause hypothesis, timeline, response plans, and linked executor proposals.

## Telegram

```text
/prodhealth
/incidents
/incident <id>
```

Natural prompts:

```text
cek production health
ada incident apa?
kenapa deploy gagal?
```

## Safety

Observability never runs repair, rollback, deploy, shell, or external write actions directly.

# Webhook Connector

Connector `webhook` menyediakan payload preview dan proposal pengiriman webhook.

## Env

```env
EXTERNAL_WEBHOOK_URL=
WEBHOOK_SHARED_SECRET=
```

`WEBHOOK_SHARED_SECRET` optional dan tidak pernah dikembalikan sebagai value.

## Actions

Read-only:

- `webhook.status`
- `webhook.payload.validate`
- `webhook.payload.preview`

Proposal-only:

- `webhook.send`

`webhook.send` tidak melakukan POST saat propose/dry-run/evaluation. Run yang approved masuk safe boundary v1; handler write eksternal nyata belum diaktifkan.

## Telegram

- `/webhook_preview <json/text>`
- `/propose_webhook <json/text>`

Payload yang mengandung token, Authorization header, database URL, atau API key ditolak.

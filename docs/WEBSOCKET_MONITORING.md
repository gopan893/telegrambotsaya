# WebSocket Monitoring

Dashboard Phase 33 memiliki live monitoring melalui WebSocket di `/ws`.

## Auth

Client harus memakai `DASHBOARD_ADMIN_TOKEN`. Browser dashboard mengirim token melalui WebSocket subprotocol `dashboard-auth.<base64url-token>`, bukan melalui URL query.

## Topics

- `health`
- `dashboard`
- `agents`
- `executor`
- `integrations`
- `routines`
- `selfhealing`
- `cicd`
- `audit`
- `release_gate`

## Safety

Monitoring event selalu disanitasi. Payload tidak boleh memuat token, API key, connection string, atau Authorization header.

Jika WebSocket tidak tersedia, dashboard tetap memakai polling API `/api/dashboard/monitoring/snapshot`.

# AI OS v1 Known Limitations

## Runtime

- In-memory stores reset on restart (audit, sessions, rate-limit counters)
- No Postgres persistence for governance, security, privacy data (Phase 47-49 scope)
- Telegram Control Layer not yet wired to legacy-runtime.js message dispatch
- Security/privacy modules standalone; runtime wiring pending

## Export & Backup

- Export generates manifest/report only, not actual file artifacts
- Credential rotation is manual-checklist only; no automatic rotation

## Documentation

- Research/Docs Agent generates draft proposals only; no direct docs file write

## Integrations

- Life OS Gmail/Calendar/routine actions are proposal-only
- Operating Loop suggests next actions but cannot auto-release

## Dashboard

- Dashboard service worker must not cache /api/dashboard/* (enforced)
- Known tabs must not fallback to Overview (enforced)

## Release

- No automated GitHub release creation from runtime
- No automated Render deploy from runtime
- Release proposals require manual approval before execution

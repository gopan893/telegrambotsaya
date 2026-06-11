# Dashboard API Contract v3

Stable contract for dashboard API endpoints in registry v3.

### Contract
```json
{
  "id": "api_id",
  "method": "GET|POST",
  "path": "/api/dashboard/{id}",
  "tabId": "tab_id",
  "module": "source_module",
  "requiresAuth": true,
  "requiresOwner": false,
  "requiresAdmin": false,
  "riskLevel": "low|medium|high|critical",
  "actionType": "read|report|simulate|dry_run|proposal|internal_write|external_write|dangerous",
  "responseContract": { "ok": true, "data": {} },
  "errorContract": { "ok": false, "error": "ERROR" },
  "cachePolicy": "no-cache",
  "redactionPolicy": "secrets",
  "directRunAllowed": false,
  "enabled": true
}
```

### Rules
- `/api/dashboard/*` must require auth unless explicitly public health
- `/api/dashboard/*` must not be cached
- Response must be JSON object
- Error must be JSON object (no HTML error page)
- No raw stack trace in responses
- No env values in responses
- `external_write`/`dangerous` must be proposal-only
- `directRunAllowed: false` for dangerous APIs
- Missing modules return degraded/not_configured JSON
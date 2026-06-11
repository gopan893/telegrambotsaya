# Dashboard Renderer Contract v3

Stable contract for dashboard renderer files in registry v3.

### Contract
```json
{
  "id": "renderer_id",
  "tabId": "tab_id",
  "rendererName": "renderer.js",
  "file": "/dashboard/renderer.js",
  "loadOrder": 999,
  "usesApi": true,
  "apiRouteIds": ["api_id"],
  "expectedTitle": "Tab Title",
  "expectedContentKeywords": ["keyword1"],
  "supportsLoadingState": true,
  "supportsEmptyState": true,
  "supportsDegradedState": true,
  "supportsErrorState": true,
  "supportsMobile": true,
  "supportsDarkMode": true,
  "noSecrets": true,
  "enabled": true
}
```

### Rules
- Renderer must not call `Api.fetch` before api-client loaded
- `Api.fetch` compatibility must be guaranteed
- Renderer must handle degraded API responses
- Renderer must not throw on missing optional modules
- Renderer must not show raw JSON/stack trace
- Renderer must not leak secrets
- Renderer must not render Overview for known tabs
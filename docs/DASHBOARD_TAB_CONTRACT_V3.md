# Dashboard Tab Contract v3

Stable contract for dashboard tabs in registry v3.

### Contract
```json
{
  "id": "tab_id",
  "canonicalId": "dashboard_tab:tab_id",
  "title": "Tab Title",
  "description": "Description",
  "group": "Category",
  "dataTab": "tab_id",
  "href": "#tab_id",
  "rendererId": "tab_id-renderer",
  "apiRouteId": "tab_id-api",
  "aliases": [],
  "stable": true,
  "publicVisible": true,
  "mobileVisible": true,
  "ownerOnly": false,
  "requiresAuth": true,
  "expectedContent": ["keyword1"],
  "emptyState": "No data",
  "degradedState": "Feature not configured",
  "errorState": "Failed to load",
  "loadingState": "Loading...",
  "fallbackPolicy": "degraded",
  "enabled": true
}
```

### Rules
- `dataTab` must match `id`
- `href` must be `#<id>`
- Known tabs must never fallback to Overview
- `fallbackPolicy` must be safe placeholder/degraded
- `expectedContent` must exist for stable tabs
- `mobileVisible: true` for important control tabs
- Owner-only private tabs require `requiresOwner` or `requiresAdmin`

### Stable Tabs Represented
overview, agents, executor, integrations, coding, routines, selfhealing, monitoring, cicd, githubops, deploy, observability, cost, operator, portfolio, knowledge, lifeos, telegram-control, operating-loop, improvement, governance, security, privacy, release-candidate, production-release, reliability, research, docs-intel, model-router, plugins, knowledge-search, recipes, mobile, disaster-recovery, consolidation, stabilization, v2-planning, registry-v2, boundary, performance, v2-release, v2-stabilization, v2-production, post-v2, plugin-hardening, rag-quality, agent-runtime, devices, workflow-studio, long-term-planning, v3-planning, v3-blueprint, registry-v3
# Knowledge Dashboard

## Tab

`Knowledge` — `data-tab="knowledge"`, `href="#knowledge"`.

Aliases:

- `memory-graph`
- `knowledge-graph`
- `project-memory`
- `decisions`
- `long-memory`

Icon: 🕸️.

## Sections

1. **Graph Overview** — total nodes, active, edges, decisions, risks, incidents.
2. **Search** — text search across nodes and edges.
3. **Knowledge Nodes** — filterable table (type, source).
4. **Decision Memory** — table of decisions with sensitivity badges.
5. **Context Pack Preview** — built on demand.
6. **Memory Safety Check** — paste a candidate, run the gate.
7. **Stale / Duplicate Review** — archive candidates.
8. **Documentation Intelligence** — gap findings.
9. **Ingest Form** — type, title, summary, tags, sensitivity.
10. **Full Report** — JSON dump of governance state.

## API

Mounted by `src/dashboard/knowledge-routes.js` under `/api/dashboard/knowledge`.

| Method | Path |
|---|---|
| GET  | `/api/dashboard/knowledge` |
| GET  | `/api/dashboard/knowledge/search?q=...` |
| GET  | `/api/dashboard/knowledge/nodes` |
| GET  | `/api/dashboard/knowledge/nodes/:id` |
| GET  | `/api/dashboard/knowledge/nodes/:id/graph?depth=1` |
| GET  | `/api/dashboard/knowledge/decisions` |
| POST | `/api/dashboard/knowledge/ingest` |
| POST | `/api/dashboard/knowledge/context-pack` |
| POST | `/api/dashboard/knowledge/safety-check` |
| GET  | `/api/dashboard/knowledge/duplicates?candidate={...}` |
| GET  | `/api/dashboard/knowledge/stale` |
| POST | `/api/dashboard/knowledge/archive` |
| GET  | `/api/dashboard/knowledge/docs-status` |
| GET  | `/api/dashboard/knowledge/report` |

All routes are protected, sanitized, and never echo raw secret values.

## Mobile

The tab uses the existing responsive grid. Forms use the dark input class
(per AGENTS.md dashboard rules). No long tables overflow on small screens.

## Service Worker

`/api/dashboard/knowledge/*` is **not cached** by `public/dashboard/service-worker.js`
(per the global rule that `/api/dashboard/*` must not be cached).

## Failure Modes

- Module unavailable → 503 `KNOWLEDGE_MODULE_UNAVAILABLE`.
- Secret detected → 400 with `safeSummary: "A secret was provided and redacted."`.
- Protected decision archive → 400 `PROTECTED_DECISION`.
- Empty ids for archive → 400 `IDS_REQUIRED`.

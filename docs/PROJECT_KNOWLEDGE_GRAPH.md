# Project Knowledge Graph

## Purpose

Phase 42 introduces a **Project Knowledge Graph** that lets the Telegram AI OS
remember, link, and reason about projects, phases, decisions, incidents,
deploys, proposals, agents, files, docs, and risks.

The graph is **in-memory**, **archive-only** (no hard delete), **secret-safe**,
and **proposal-driven** for any mutation that could leak or break.

## Modules

| Module | Role |
|---|---|
| `src/knowledge/knowledge-utils.js` | Validators, secret patterns, fingerprinting. |
| `src/knowledge/knowledge-graph-store.js` | Node/edge store (create/update/list/archive/search/graph-walk). |
| `src/knowledge/knowledge-node-manager.js` | Thin manager with project/phase linking helpers. |
| `src/knowledge/knowledge-edge-manager.js` | Edge helpers, relation maps, safe connect. |
| `src/knowledge/project-knowledge-ingestor.js` | Typed ingestors (goal/plan/task/incident/deploy/proposal/phase/manual). |
| `src/knowledge/decision-memory-manager.js` | Record/search decision memory + 15 core decisions. |
| `src/knowledge/memory-governance-policy.js` | Classify, scope, sensitivity, retention decisions. |
| `src/knowledge/memory-safety-gate.js` | Secret detection, redaction, block, safety report. |
| `src/knowledge/memory-deduplicator.js` | Duplicate finder, conflict detection, safe merge. |
| `src/knowledge/memory-staleness-reviewer.js` | Stale detection, archive plan, no hard delete. |
| `src/knowledge/context-retrieval-engine.js` | Build context pack for projects/phases/incidents/decisions. |
| `src/knowledge/documentation-intelligence.js` | Doc gap scanner (AGENTS.md, ARCHITECTURE_MAP.md, etc.). |
| `src/knowledge/knowledge-report-generator.js` | Project/phase/decision/incident/governance reports. |
| `src/knowledge/index.js` | Re-export. |

## Node Model

```js
{
  id, workspaceId, type, title, summary, tags, source, sourceId,
  sensitivity, confidence, status: 'active'|'archived'|'stale'|'blocked',
  createdAt, updatedAt
}
```

Node types: `project, phase, task, decision, incident, deploy, rollback,
proposal, agent, file, doc, environment, command, risk, test, bug, feature,
integration, cost, memory`.

## Edge Model

```js
{ id, workspaceId, fromNodeId, toNodeId, relation, confidence, source, createdAt }
```

Relations: `depends_on, caused_by, fixed_by, relates_to, supersedes,
blocked_by, approved_by, proposed_by, implemented_in, documented_in,
tested_by, owned_by, affects, requires, conflicts_with`.

## Safety Rules

1. No node may have `sensitivity: 'secret'`.
2. Any candidate whose text matches secret patterns is rejected.
3. A blocked candidate returns a safe summary: `A secret was provided and redacted.`
4. Protected decisions (e.g. *Use Node.js 20*) cannot be archived or renamed.
5. Memory is archived, never hard-deleted.

## Main Flows

### Ingest

`projectKnowledgeIngestor.ingestX(input)` →
1. Run memory safety gate.
2. Build deduplication report.
3. Create node if not duplicate.
4. Link related project/phase nodes.

### Decision Memory

`decisionMemoryManager.recordDecisionMemory(input)` →
1. Sanitize text.
2. Run safety gate.
3. Deduplicate by fingerprint.
4. Create `decision` node.

### Context Pack

`contextRetrievalEngine.buildContextPack(query)` returns:
- selectedNodes (top 30)
- selectedEdges (top 100)
- decisions, risks, constraints
- confidence
- missingContext

### Staleness Review

`memoryStalenessReviewer.createMemoryCleanupPlan()` →
- archive plan (never hard delete)
- requireApproval=true
- noHardDelete=true

## Dashboard API

`/api/dashboard/knowledge` (mounted by `src/dashboard/knowledge-routes.js`):

| Method | Path | Purpose |
|---|---|---|
| GET  | `/` | Graph overview + first 50 nodes + decision report |
| GET  | `/search` | Text search over nodes and edges |
| GET  | `/nodes` | Filtered node list |
| GET  | `/nodes/:id` | Single node |
| GET  | `/nodes/:id/graph` | Graph walk (depth 1–3) |
| GET  | `/decisions` | Decision memory list/search |
| POST | `/ingest` | Ingest a typed memory candidate |
| POST | `/context-pack` | Build context pack |
| POST | `/safety-check` | Run safety gate against candidate |
| GET  | `/duplicates` | Dedup report for candidate |
| GET  | `/stale` | Staleness archive plan |
| POST | `/archive` | Archive-only (no hard delete) |
| GET  | `/docs-status` | Documentation intelligence |
| GET  | `/report` | Full governance report |

## Integration Points

- Operator (`src/operator/*`): `ingestProjectGoal`, `ingestOperatorPlan`, `ingestTask`.
- Observability: `ingestIncident` from incident store.
- Deploy: `ingestDeployReport`, `ingestRollbackPlan`.
- Executor: `ingestExecutorProposal` for proposal-level decisions.
- Cost: cost events can be ingested as `cost` nodes.
- Dev Governance: `documentationIntelligence` reports findings.
- Agent router: uses `contextRetrievalEngine` for context-aware routing.

## Limits

- In-memory only (no persistent store; per Phase 42 scope).
- No vector DB dependency.
- No autonomous repo mutation.
- No direct GitHub push.
- No direct deploy/rollback.

## Next Phase Hooks

Phase 43 candidate work: persistent Postgres-backed graph, semantic search,
graph-driven prompt composer, multi-graph federation.

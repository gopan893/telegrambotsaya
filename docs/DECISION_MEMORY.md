# Decision Memory

## Purpose

The Decision Memory Manager preserves the **why** behind every major
architectural, security, deployment, and workflow choice. It is read by:

- Agent router (to keep responses consistent with project decisions)
- Coder agent (to avoid suggesting deprecated stacks)
- Planner/Operator (to respect constraints)
- Critic/Security (to enforce policy)
- Documentation Intelligence (to detect stale or missing rationale)

## Core Decisions (Seeded)

These 15 decisions are seeded automatically by `seedCoreDecisions()`:

1. Use Node.js 20
2. Use CommonJS only
3. Use vanilla dashboard, no React/Next/Vue
4. No TypeScript
5. No React/Next/Vue (extended)
6. Approval required for write/external/danger
7. GitHub push requires proposal and approval
8. Render deploy/rollback requires proposal and approval
9. Gmail send disabled unless strict approval
10. Optional env must not crash app
11. Dashboard known tabs must not fallback to Overview
12. Secrets must not be logged or stored
13. No shell executor
14. No autonomous repo mutation
15. No hard delete memory without archive

These are **protected**: they cannot be renamed, archived, or replaced
silently. A user-supplied decision with the same fingerprint will be
deduplicated, not duplicated.

## API

```js
const dm = require('./src/knowledge/decision-memory-manager');

dm.recordDecisionMemory({
  title: 'Use Postgres advisory locks for queue dedup',
  summary: 'Avoids duplicate job pickup when worker restarts.',
  tags: ['queue', 'reliability'],
  source: 'operator_proposal',
  sourceId: 'proposal-123'
});

dm.searchDecisionMemory('react');
dm.linkDecisionToProject(decisionId, projectId);
dm.linkDecisionToPhase(decisionId, phaseId);
dm.summarizeDecisionHistory();
```

## Dashboard

`GET /api/dashboard/knowledge/decisions?q=react` returns matching decisions.
The Knowledge tab renders them in a table with type, sensitivity, status,
and confidence.

## Telegram

The natural chat layer matches phrases like:

- *"apa keputusan penting project ini?"* → `searchDecisionMemory("keputusan")`
- *"kenapa kita tidak pakai React?"* → `searchDecisionMemory("react")`
- *"ingat ini sebagai keputusan project: ..."* → `recordDecisionMemory` (after safety gate)

Commands: `/decision_memory`, `/remember_project`.

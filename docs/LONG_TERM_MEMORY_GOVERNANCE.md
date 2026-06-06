# Long-Term Memory Governance

## Purpose

Phase 42 adds **Long-Term Memory Governance** so the AI OS can:

1. Classify memory candidates by category.
2. Decide scope, sensitivity, and retention.
3. Block secrets before they are stored.
4. Detect duplicates and conflicts.
5. Archive stale knowledge safely.

## Governance Pipeline

```
candidate (object)
   │
   ▼
memoryGovernancePolicy.buildMemoryGovernanceDecision
   │  classification: project | decision | incident | deployment | agent | doc | risk | cost | general
   │  scope: temporary_chat | project_memory | agent_memory | decision_memory |
   │         incident_memory | deployment_memory | portfolio_memory | documentation_memory
   │  sensitivity: public | internal | confidential | secret
   │  retention:   ignore | temporary | active | archive | blocked
   ▼
memorySafetyGate.runMemorySafetyGate
   │  detect secret patterns
   │  redact or block
   ▼
memoryDeduplicator.buildDeduplicationReport
   │  exact duplicate → merge
   │  conflict → flag (do not silently overwrite)
   ▼
knowledgeGraphStore.createKnowledgeNode
```

## Scopes

| Scope | Use |
|---|---|
| `temporary_chat` | Ephemeral chat, not stored beyond session. |
| `project_memory` | Project goals, plans, phase summaries. |
| `agent_memory` | Agent profile, preferences, history. |
| `decision_memory` | Long-term decisions and rationale. |
| `incident_memory` | Production incidents and root cause. |
| `deployment_memory` | Deploy and rollback history. |
| `portfolio_memory` | Portfolio snapshots and risk. |
| `documentation_memory` | Doc gaps and doc intelligence findings. |

## Retention

| Retention | Meaning |
|---|---|
| `ignore` | Do not store. |
| `temporary` | Store briefly, then archive. |
| `active` | Store, surface in retrieval. |
| `archive` | Soft-deleted, retrievable for review. |
| `blocked` | Reject immediately. |

## Safety Gate

`memorySafetyGate.runMemorySafetyGate(candidate)` returns:

- `ok: true` → safe to store.
- `ok: false, blocked: true` → reject, return `safeSummary: "A secret was provided and redacted."`.

Detected secret patterns:

```
token, secret, password, api_key, Authorization, Bearer,
DATABASE_URL, REDIS_URL, postgresql://, rediss://,
sk-, ghp_, github_pat_, gsk_, tvly_,
TELEGRAM_TOKEN, GITHUB_TOKEN, GOOGLE_CLIENT_SECRET,
CLOUDFLARE_API_TOKEN, RENDER_DEPLOY_HOOK
```

## Protected Decisions

`memoryStalenessReviewer` and the graph store will refuse to archive or
rename decisions whose title is in the protected list:

- Use Node.js 20
- Use CommonJS only
- Use vanilla dashboard, no React/Next/Vue
- Approval required for write/external/danger
- GitHub push requires proposal and approval
- Render deploy/rollback requires proposal and approval
- Gmail send disabled unless strict approval
- Optional env must not crash app
- Dashboard known tabs must not fallback to Overview
- Secrets must not be logged or stored
- No shell executor
- No autonomous repo mutation
- No hard delete memory without archive

## Audit

Every safety event, decision, dedup hit, archive, and doc gap scan is recorded
in the knowledge audit log (capped at 1000 entries, then trimmed to 500).

## Failure Modes

- Module not loaded → API returns 503 with `KNOWLEDGE_MODULE_UNAVAILABLE`.
- Secret detected → store refused, safe summary returned.
- Hard delete request → not supported; archive only.
- Sensitive metadata → keys named `token|secret|password|...` are redacted.

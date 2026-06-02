# Decision History

Decision History menyimpan ringkasan keputusan agar user bisa meninjau keputusan lama tanpa menyimpan secret atau prompt mentah berlebihan.

## Storage

Storage key:

- `agent_decisions`
- `agent_decision_history`
- `agent_decision_summaries`

Semua record user/workspace-scoped. Item di-archive, bukan hard delete.

## Field Penting

- `question`
- `options`
- `criteria`
- `risk`
- `confidence`
- `recommendation`
- `status`
- `linkedGoalId`
- `linkedPlanId`
- `createdAt`
- `updatedAt`

## Status

- `draft`
- `recommended`
- `accepted`
- `rejected`
- `deferred`
- `archived`

## Command

```text
/decisions
/decisionhistory
/decisionstatus <decisionId> | <accepted|rejected|deferred>
```

## Dashboard

Endpoint dashboard protected:

```text
GET  /api/dashboard/decisions
GET  /api/dashboard/decisions/:decisionId
POST /api/dashboard/decisions/analyze
POST /api/dashboard/decisions/:decisionId/status
POST /api/dashboard/decisions/:decisionId/archive
```

Dashboard tidak menampilkan secret, token, atau connection string.

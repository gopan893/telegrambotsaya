# Incident Response Center

The Incident Response Center tracks production incidents and creates safe response plans.

## Incident Model

```js
{
  id,
  workspaceId,
  title,
  summary,
  severity,
  status,
  source,
  affectedSystems,
  firstSeenAt,
  lastSeenAt,
  timeline,
  rootCauseHypothesis,
  responsePlanId,
  proposalIds,
  createdAt,
  updatedAt
}
```

Severity values: `info`, `low`, `medium`, `high`, `critical`.

Status values: `open`, `investigating`, `mitigating`, `resolved`, `closed`.

## Response Flow

1. Health check detects a problem.
2. Incident is created or deduped.
3. Severity and affected systems are classified.
4. Timeline events are appended.
5. Root cause hypothesis is generated from safe signals.
6. Response plan is created.
7. Repair/rollback becomes an executor proposal.
8. Human approves with `/approve <proposalId>`.
9. Human runs with `/runexec <proposalId>`.

No repair or rollback is executed during detection, analysis, or proposal creation.

## Commands

```text
/analyze_incident <id>
/incident_timeline <id>
/responseplan <id>
/propose_incident_repair <id>
/propose_incident_rollback <id>
/close_incident <id>
```

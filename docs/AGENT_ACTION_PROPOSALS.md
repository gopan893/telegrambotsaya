# Agent Action Proposals

Action proposal adalah jembatan antara rekomendasi agent dan executor.

## Action Plan

```json
{
  "id": "action_plan_xxx",
  "workspaceId": "default",
  "userId": "123",
  "source": "natural_chat",
  "sourceId": "",
  "createdByAgentId": "executor",
  "title": "Backup workspace",
  "description": "jalankan backup sekarang",
  "actions": [],
  "riskLevel": "medium",
  "approvalRequired": true,
  "securityReviewRequired": false,
  "status": "draft",
  "executorProposalId": ""
}
```

Action plan tidak mengeksekusi apa pun. Ia hanya bisa diubah menjadi proposal executor.

## Supported Actions

- `backup.create`
- `backup.validate`
- `recovery.check`
- `integrity.check`
- `ops.diagnostics.run`
- `ops.benchmark.light`
- `planner.task.mark_done`
- `planner.task.mark_blocked`
- `workflow.step.add`
- `workflow.step.done`
- `goal.progress.update`
- `memory.suggest_archive`
- `report.health.export`
- `report.user_summary.export`
- `tool.preview`
- `tool.run_safe_readonly`

Restricted/danger:

- `restore.run`
- `import.run`

Restore/import proposal tetap tidak menjalankan restore/import langsung dari agent executor. Gunakan dashboard validation, restore plan, dan confirmation text `RESTORE`.

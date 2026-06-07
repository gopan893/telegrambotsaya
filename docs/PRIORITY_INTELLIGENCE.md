# Priority Intelligence

Priority Intelligence adalah aturan Phase 41 untuk memilih project yang paling layak dilanjutkan.

## Input Signal

- User priority dari goal.
- Health score project.
- Blocked/stale tasks.
- Pending executor approvals.
- Open incidents.
- Deploy gate status.
- GitHubOps status.
- Cost/token warning.
- Progress dan release readiness.

## Priority Modes

- `balanced`: campuran safety, urgency, progress, dan effort.
- `speed`: mendahulukan task kecil yang cepat memberi progress.
- `stability`: mendahulukan incident, blocker, deploy gate, dan risk.
- `cost_saving`: mendahulukan cleanup dan token/cost reduction.
- `quality`: mendahulukan test gate, regression, release readiness.
- `manual`: reserved untuk override manusia.

## Output

`project-priority-engine` menghasilkan:

```json
{
  "goalId": "goal_123",
  "priorityScore": 82,
  "priorityLabel": "high",
  "mode": "balanced",
  "recommendation": "Prioritaskan unblock/stabilization project ini.",
  "explanation": "Project tinggi karena health turun dan ada blocker."
}
```

## Safety

Priority recommendation bersifat read-only. Jika rekomendasi butuh aksi write/external/danger, Phase 41 membuat action plan dan executor proposal saja.

Tidak ada direct push, direct deploy, direct rollback, shell executor, atau auto-run.

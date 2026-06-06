# Budget Policy

## Model

```json
{
  "id": "budget_default_workspace_user",
  "workspaceId": "default",
  "userId": "default",
  "dailyTokenLimit": 1000000,
  "weeklyTokenLimit": 5000000,
  "monthlyTokenLimit": 20000000,
  "dailyCostLimit": 5.00,
  "weeklyCostLimit": 25.00,
  "monthlyCostLimit": 100.00,
  "warningThresholdPercent": 80,
  "hardLimitEnabled": false,
  "allowedOverageWithApproval": true,
  "councilRestriction": false
}
```

## Default Behavior

- Permissive but alerting: warning at 80% threshold
- Hard block disabled by default (non-destructive)
- Council/evaluation restrictions opt-in
- Overage with approval allowed by default

## Guard Behavior

1. Small/cheap requests pass through without checks
2. Budget warning shown when approaching limits
3. High-cost council/evaluation requires approval if daily cost >50%
4. If hard limit enabled and exceeded, request blocked with alternative suggestion
5. Quality mode warns if daily cost >30% for non-critical tasks

# Goal-to-Delivery Workflow

## Flow Diagram

```
User Goal → Analyze → Plan → Tasks → Agent Assign → Progress
                                                         ↓
                                              Evaluation Gate
                                                         ↓
                                              Risk Review
                                                         ↓
                                              Cost Guard
                                                         ↓
                                              Proposal Bridge
                                                         ↓
                                              Executor Proposal
                                                         ↓
                                              User Approval
                                                         ↓
                                              Action Executed
                                                         ↓
                                              Observability
```

## Key Phases

| Phase | Module | Description |
|---|---|---|
| Goal Analysis | project-goal-analyzer | Classify, extract criteria, detect risk |
| Planning | operator-planner | Create roadmap, milestones, phases |
| Task Breakdown | operator-task-breakdown | Create granular tasks from plan |
| Agent Coordination | operator-agent-coordinator | Select agents per task role |
| Progress Tracking | operator-progress-tracker | Monitor completion, detect blockers |
| Decision Engine | operator-decision-engine | Recommend next action/agent |
| Risk Review | operator-risk-review | Check compatibility/approval/deploy risk |
| Cost Guard | operator-cost-guard | Estimate cost, warn/block if exceeded |
| Evaluation Gate | operator-evaluation-gate | Verify safety before proposal |
| Proposal Bridge | operator-proposal-bridge | Create executor proposals |
| Report Generator | operator-report-generator | Status, release readiness, executive summary |

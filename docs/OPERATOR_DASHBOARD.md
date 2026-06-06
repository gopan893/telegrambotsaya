# Operator Dashboard

## Tab: Project Operator

Access via sidebar: **🤖 Project Operator**

### Aliases
- project-operator, operator, delivery, ai-operator, project-manager

### Features
- List all goals with status/category/priority
- Create new goal with description
- View goal details with linked plans and tasks
- Analyze goal (classify, risk detection)
- Create delivery plan (milestones, phases)
- Generate tasks from plan
- Run risk review on tasks
- Run evaluation gate on tasks
- Create executor proposals for tasks
- View progress (percent complete, task breakdown)
- Get next action recommendation
- Generate project reports

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/dashboard/operator | List operator overview |
| GET | /api/dashboard/operator/goals | List goals |
| POST | /api/dashboard/operator/goals | Create goal |
| GET | /api/dashboard/operator/goals/:id | Get goal with plans/tasks |
| POST | /api/dashboard/operator/goals/:id/analyze | Analyze goal |
| POST | /api/dashboard/operator/goals/:id/plan | Create plan |
| POST | /api/dashboard/operator/plans/:id/tasks | Generate tasks |
| GET | /api/dashboard/operator/tasks | List tasks |
| POST | /api/dashboard/operator/tasks/:id/run-review | Run risk review |
| POST | /api/dashboard/operator/tasks/:id/evaluate | Run evaluation gate |
| POST | /api/dashboard/operator/tasks/:id/create-proposal | Create executor proposal |
| GET | /api/dashboard/operator/goals/:id/progress | Get progress |
| GET | /api/dashboard/operator/goals/:id/report | Get report |
| GET | /api/dashboard/operator/goals/:id/next-action | Get next action |

### Mobile Friendly
Responsive layout works on mobile devices. Cards stack vertically on small screens.

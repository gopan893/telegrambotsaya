# Operating Loop Dashboard

## Tab: `#operating-loop`

Accessible from the sidebar as **🔄 Operating Loop**.

## Sections

### System Health Cards
- **System Health**: Current snapshot health status (🟢 healthy, 🟡 degraded, 🔴 critical)
- **Loops**: Total loop count and enabled count
- **Blockers**: Number of active blockers
- **Pending Proposals**: Proposals awaiting approval

### Recommended Next Action
Shows the highest-priority next action synthesized from current system state.

### Reports
- **Daily AI OS Report** — generates and displays daily operating summary
- **Weekly AI OS Report** — generates and displays weekly operating summary

### Operating Loops Table
All registered loops displayed with:
- ID, Name, Mode, Status badge, Cadence, Last run time
- Action buttons: **Run** (▶), **Enable** (▶), **Disable** (⏸)

### Current Blockers
Table of active blockers with severity, module, title, description.

### Pending Proposals
List of proposals awaiting approval from operating loop findings.

### Run History
Table of past loop runs with loop ID, status, and timestamp.

## API Endpoints

All under `/api/dashboard/operating-loop/`:

| Endpoint | Method | Description |
|---|---|---|
| `/status` | GET | Loop system status |
| `/loops` | GET | List all loops |
| `/loops/:id` | GET | Get specific loop |
| `/loops/:id/enable` | POST | Enable a loop |
| `/loops/:id/disable` | POST | Disable a loop |
| `/loops/:id/run` | POST | Run a loop manually |
| `/snapshot` | GET | Get latest snapshot |
| `/blockers` | GET | Get current blockers |
| `/next-action` | GET | Get next action |
| `/reports/daily` | GET | Daily AI OS report |
| `/reports/weekly` | GET | Weekly AI OS report |
| `/runs` | GET | List runs |
| `/runs/:id` | GET | Get specific run |
| `/pending-proposals` | GET | Pending proposals |

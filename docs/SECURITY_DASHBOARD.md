# Security Dashboard

## Purpose

The Security Dashboard provides a centralized, real-time view of the system's security posture. It aggregates findings from all Phase 48 security modules into a single FastAPI-based UI tab. Operators use the dashboard to review security scores, investigate findings, generate rotation plans, run red-team audits, and track remediation progress. The dashboard is read-only for security data — it displays findings but never exposes secrets or executes actions.

## Security Tab Registration

The security tab is registered with the following properties:

```
TabRegistration:
  tab_id: "security"
  aliases: ["security-dashboard", "sec", "security-center"]
  nav_item:
    label: "Security"
    icon: "shield"            # uses dashboard icon library
    route: "/security"
    order: 3                  # position in navigation bar
  allowed_roles: ["admin", "operator"]
  parent_tab: null            # top-level tab
  default_route: "/security/scorecard"
```

The tab loads its content from the `security_dashboard.py` FastAPI router, which mounts at `/api/v1/security/`. The UI is rendered via the dashboard's standard component framework (htmx + server-side templates).

## API Endpoints Reference

The security dashboard exposes 14 RESTful endpoints under `/api/v1/security/`:

| # | Method | Path | Description |
|---|--------|------|-------------|
| 1 | GET | `/scorecard` | Current overall security score and per-category breakdown |
| 2 | GET | `/scorecard/history` | Score history over time (daily snapshots) |
| 3 | GET | `/secrets/findings` | Secret scan findings (names and locations, never values) |
| 4 | POST | `/secrets/scan` | Trigger a new secret scan |
| 5 | GET | `/env/drift` | Current env drift detection report |
| 6 | POST | `/env/scan` | Trigger a new env drift scan |
| 7 | GET | `/permissions/audit` | Current permission audit report |
| 8 | POST | `/permissions/audit` | Trigger a new permission audit |
| 9 | GET | `/capabilities/risk` | Capability risk assessment |
| 10 | GET | `/approval/bypass` | Current approval bypass audit report |
| 11 | POST | `/approval/audit` | Trigger a new approval bypass audit |
| 12 | GET | `/redteam/report` | Current red-team audit report |
| 13 | POST | `/redteam/run` | Run a new red-team audit (all 13 cases) |
| 14 | GET | `/rotation/plans` | List all generated rotation plans |

All GET endpoints support `?refresh=true` to force a fresh scan before returning results.

## Dashboard Features

### Scorecard
Displays the overall security score (0–100) as a large gauge widget. Below the gauge, six category scores are shown as horizontal bars: Red Team, Secret Findings, Env Drift, Permission Audit, Approval Bypass, and Capability Risk. Each category shows the score, trend arrow (up/down/flat), and the number of findings. A history chart (7-day, 30-day) is available via the `/scorecard/history` endpoint.

### Secret Findings
Lists all secrets found during the last scan. Each row shows the finding type (hardcoded, env leak, git history), the file path or location, the secret name (if identifiable), and severity. Secret values are never displayed — the "Value" column shows `"****"` for all findings. A "Dismiss" button allows operators to mark false positives.

### Env Drift
Shows three tables: Missing Required (red), Missing Recommended (yellow), and Dangerous Flags (red highlight). Each table lists the variable name and status. Typo-detected variables are shown in a separate section with the typo and suggested correction. Variable values are never displayed.

### Permission Audit
Lists all files and directories with their current permissions, owner, and group. Flags files with world-writable permissions, setuid/setgid bits, or unexpected ownership. Shows a diff of permissions changed since the last audit.

### Capability Risk
A table of all registered capabilities with their risk level (low/medium/high/critical), blast radius description, and whether they require approval. High and critical risk capabilities are highlighted in red with a warning icon.

### Bypass Audit
Shows the results of the approval bypass audit as a pass/fail per path. Each path row contains the status badge, evidence citation (file:line), and a recommend remediation button if the path is bypassed. The overall status is shown at the top as either "All Paths Blocked" (green) or "Bypass Detected" (red).

### Red-Team
Displays the red-team audit summary with the overall score and a table of all 13 test cases. Each case row shows the status badge (pass/fail/n/a), severity, and a link to detailed evidence. Cases that failed are sorted to the top with a prominent warning.

### Rotation Plans
Lists all generated rotation plans with their creation date, credential name, credential type, and status (pending/completed/cancelled/expired). Each plan can be viewed in detail or exported as JSON/YAML. The UI never exposes the rotation steps that involve secret handling in detail — it shows only the plan metadata and verification steps.

## UI Components

The security dashboard uses the following dashboard-native UI components:

- **Gauge** — circular progress indicator for the overall score (color-coded: green ≥ 80, yellow ≥ 60, red < 60).
- **ScoreBar** — horizontal bar for category scores with label, value, and trend indicator.
- **FindingsTable** — sortable, filterable table with status badges, severity icons, and action buttons.
- **StatusBadge** — colored badge: pass (green), fail (red), warning (yellow), info (blue).
- **SeverityIcon** — icon + label: critical (red octagon), high (orange triangle), medium (yellow diamond), low (gray circle).
- **HistoryChart** — line chart using the dashboard's Chart.js integration, with date range selector.
- **ActionButton** — triggers POST endpoints (scan, audit, run) with loading state and confirmation dialog.
- **DetailPanel** — slide-out panel for viewing finding details, evidence, and recommendations.
- **ExportButton** — exports rotation plans as JSON or YAML.

All components respect the dashboard's existing dark/light theme and mobile breakpoints.

## Security Rules

1. **No secrets displayed.** All API responses that could contain secret values are masked before reaching the UI layer. Masking occurs in the router layer (`security_dashboard.py`), not in the UI.
2. **No direct rotation.** The dashboard displays rotation plans but offers no button to execute them. Plans must be executed manually by an operator.
3. **No destructive actions.** POST endpoints trigger scans, audits, and evaluations — never writes, deletes, or mutations of system state.
4. **Rate-limited.** POST endpoints are rate-limited to 1 request per 30 seconds per user to prevent abuse or accidental load.
5. **Audit-logged.** Every POST request is logged to the audit trail with user, timestamp, and action type.

## Mobile Compatibility

The security dashboard is fully responsive and tested on the following viewport widths:
- **Desktop** (≥ 1024px) — full layout with side-by-side panels and expanded tables.
- **Tablet** (768–1023px) — stacked layout with collapsible sections and horizontal scroll on wide tables.
- **Mobile** (< 768px) — single-column layout with all tables converted to card lists. The gauge is resized to fit the viewport. Score bars are stacked vertically. Action buttons are full-width.

On mobile, the HistoryChart uses a simplified render with fewer data points to improve performance. Detail panels slide up from the bottom instead of from the side.

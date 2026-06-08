# Governance Dashboard

## Overview

The Governance tab in the dashboard provides a centralized view of the Unified Governance Policy Engine, capability registry, policy simulator, and audit.

## Features

### 1. Capability Registry Table
- View all registered capabilities
- Filter by module and risk level
- Shows action type, risk level, external system, requirements (eval, approval, secret scan)
- Click capability ID for detailed view with contract

### 2. Policies View
- Governance policy rules (read-only display)
- Approval flow visualization
- Capability contracts table with all requirements and restrictions

### 3. Action Policy Simulator
- Input any action/command name
- Optional context JSON
- Runs simulation against governance policy
- Shows outcome, risk, permission, approval requirements, evaluation requirements, secret scan results
- **Simulation never executes the action**

### 4. Secret Guard Scanner
- Paste any text payload
- Scans for secrets, tokens, API keys, database URLs, etc.
- Shows matched patterns (labels only, no raw values)
- Shows redacted version of the payload
- **No data is stored**

### 5. Governance Audit
- Recent governance decisions
- Filterable by module, risk level, decision
- Shows summary statistics (total, allowed, blocked, proposals)
- Actor IDs are sanitized

### 6. Blocked Actions
- List of recently blocked actions
- Shows action ID, risk level, reasons, and timestamp

## Dashboard API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/dashboard/governance | Governance status |
| GET | /api/dashboard/governance/capabilities | List capabilities (filterable) |
| GET | /api/dashboard/governance/capabilities/:id | Capability detail |
| POST | /api/dashboard/governance/simulate | Policy simulation |
| POST | /api/dashboard/governance/secret-scan | Secret scan |
| GET | /api/dashboard/governance/policies | Governance policies |
| GET | /api/dashboard/governance/audit | Governance audit |
| GET | /api/dashboard/governance/blocked | Blocked actions |
| POST | /api/dashboard/governance/validate | Validate action |

## Route Registration

Routes are registered via `registerGovernanceRoutes(app, services)` in `src/dashboard/governance-routes.js`.

## Frontend

The Governance tab UI is in `public/dashboard/governance.js` and uses the existing dashboard framework (Api, Utils, etc.).

## Tab Registration

The governance tab is registered in `state.js` as:
- Tab ID: `governance`
- Aliases: `policy`, `policies`, `safety`, `capability`, `capability-center`, `control-policy`
- Renderer: `renderGovernance`

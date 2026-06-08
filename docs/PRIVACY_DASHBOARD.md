# Privacy Dashboard

## Purpose

The Privacy Dashboard provides a centralized interface for all privacy operations: scanning data inventory, managing classification policies, configuring retention rules, creating export/archive/delete requests, and auditing privacy events.

## Privacy Tab Registration

The privacy tab is defined for registration in `public/dashboard/state.js` with:

- **Tab ID**: `privacy`
- **Aliases**: `privacy-center`, `data-privacy`, `privasi`
- **Nav Item**: Visible in sidebar under a privacy icon
- **Renderer**: `renderPrivacy` (defined in `public/dashboard/privacy.js`)
- **Status**: Tab config is prepared; routes exist server-side in `src/dashboard/privacy-routes.js`

The routes are registered via `registerPrivacyRoutes(router, services)` which mounts all endpoints under `/api/dashboard/privacy`.

## API Endpoints Reference (18 endpoints)

All endpoints are defined in `src/dashboard/privacy-routes.js`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard/privacy` | Privacy overview report |
| POST | `/api/dashboard/privacy/inventory-scan` | Trigger full inventory scan |
| GET | `/api/dashboard/privacy/inventory` | Get current inventory categories |
| POST | `/api/dashboard/privacy/classify` | Run classification on all categories |
| GET | `/api/dashboard/privacy/policies` | List all privacy access policies |
| POST | `/api/dashboard/privacy/policies` | Update a privacy policy |
| GET | `/api/dashboard/privacy/retention` | List retention policies (9 tracked categories) |
| POST | `/api/dashboard/privacy/retention` | Update a retention policy |
| GET | `/api/dashboard/privacy/retention-candidates` | Find retention candidates and action plan |
| POST | `/api/dashboard/privacy/export-request` | Create an export request |
| GET | `/api/dashboard/privacy/export-requests` | List export requests (with optional status filter) |
| GET | `/api/dashboard/privacy/export-requests/:id/manifest` | Get export manifest |
| POST | `/api/dashboard/privacy/archive-plan` | Create an archive/cleanup plan |
| GET | `/api/dashboard/privacy/archive-plans` | List archive plans (with optional status filter) |
| POST | `/api/dashboard/privacy/delete-request` | Create a delete request |
| GET | `/api/dashboard/privacy/delete-requests` | List delete requests (with optional status filter) |
| GET | `/api/dashboard/privacy/report` | Generate privacy overview report |
| GET | `/api/dashboard/privacy/audit` | List privacy audit events with summary |

All routes require dashboard authentication via `dashboardAuth`.

## Dashboard Features

- **Inventory**: View all 24 data categories with source, sensitivity, export/archive/delete flags
- **Classification**: Run bulk classification, view sensitivity distribution
- **Policies**: View and edit per-category privacy access policies
- **Retention**: View and edit retention policy defaults (retention/archive/delete days)
- **Export**: Create export requests, select categories, trigger privacy review
- **Archive**: Create archive plans, find stale candidates
- **Delete**: Create soft/hard delete requests
- **Audit**: Browse privacy audit events with type/user filters and summary

## UI Components

The privacy dashboard UI (`public/dashboard/privacy.js`) includes:

- Overview cards showing total categories, sensitive count, exportable count
- Inventory table with sensitivity badges and action flags
- Policy editor panel per category
- Retention policy configuration grid
- Export request form with category multi-select and redaction mode picker
- Archive plan creator with candidate preview
- Delete request form with hard delete warning
- Audit log viewer with timestamp/type/user/action columns

## Security/Privacy Rules

- No secret values are displayed in any inventory, classification, or audit view
- Records classified `secret_blocked` are shown as redacted placeholders only
- No direct hard delete button is available in the UI - hard delete must be explicitly requested and approved through the proposal flow
- Export requests with sensitive data show a warning and require approval badge
- Life OS mood/energy data is hidden from all dashboard views (not displayed per `allowDashboardAccess: false` policy)
- All privacy dashboard API responses are wrapped in `guards.safeDashboardResponse()` for consistent error handling

# Export Control

## Purpose

The export control system enables safe data export from Telegram AI OS with mandatory redaction. All exports must pass privacy review, secret pattern detection, and role-based approval before release.

## Export Request Model

Created via `exportControlManager.createExportRequest(input)` in `src/privacy/export-control-manager.js`. Fields:

- `id` - SHA-1 hex identifier (16 chars)
- `workspaceId`, `userId` - scope identifiers
- `categories` - array of data categories to include
- `format` - output format (`json`, `markdown`)
- `includeSensitive` - whether sensitive data is requested (triggers approval)
- `includePrivate` - whether private data is requested
- `redactionMode` - strict | balanced | none_disallowed
- `status` - draft → reviewing → export_ready
- `requiresApproval` - auto-set when sensitive/private included or >3 categories
- `proposalId` - linked evaluation proposal if approval required

## Redaction Modes

- **strict** (default) - All records matching `NEVER_EXPORT_PATTERNS` are excluded entirely. Sensitive category records are redacted (replaced with a `{ redacted: true }` placeholder).
- **balanced** - Secret patterns are still blocked, but private/internal records pass through. Available for admin-level export requests.
- **none_disallowed** - Rejected by validation if sensitive categories are included. Only allowed for purely internal/public data exports.

## Exportable Categories (14 categories)

Defined in `export-package-builder.js:3`:

`project_goals`, `operator_plans`, `portfolio_snapshots`, `knowledge_graph`, `decision_memory`, `lessons_learned`, `incident_reports`, `deploy_reports`, `cost_usage`, `lifeos_tasks`, `lifeos_habits`, `personal_goals`, `improvement_feedback`

Categories explicitly excluded from export: `telegram_messages`, `telegram_session_context`, `lifeos_mood_energy`, `executor_proposals`, `audit_logs`, `security_findings`, `backups_metadata`, `dashboard_settings`.

## Never-Export Patterns

Defined in `src/privacy/export-package-builder.js:4`. Any record whose JSON string matches any of these patterns is **excluded entirely** from the export package:

- `/token/i` - any token-like string
- `/secret/i` - any mention of secrets
- `/password/i` - password fields
- `/api[_-]?key/i` - API keys
- `DATABASE_URL`, `REDIS_URL`, `postgresql://`, `rediss?://` - connection strings
- `Authorization`, `Bearer` patterns
- `sk-` prefixed strings (OpenAI keys)
- `ghp_`, `github_pat_` prefixed strings (GitHub tokens)

## Approval Requirements

- Export requests with `includeSensitive: true` or `includePrivate: true` require approval
- Requests with >3 categories require approval
- Sensitive exports require owner role for approval
- Approval flow: `exportControlManager.createExportProposal(requestId)` → Evaluation v2 → executor proposal → approval → `markExportReady()` → download

## Export Manifest Format

Built by `exportControlManager.buildExportManifest()` and `exportPackageBuilder.buildZipManifest()`. Contains:

```
Export ID: <sha1-id>
Categories: project_goals, cost_usage, ...
Redaction: strict
Generated: <ISO 8601 timestamp>
Files: 1 (report only)
```

JSON export packages include a `redacted` count and `totalRecords` count alongside the records array.

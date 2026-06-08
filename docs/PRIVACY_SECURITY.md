# Privacy & Security Integration

## Purpose

The privacy-security integration ensures that secret data is detected, classified, and blocked from export, display, and unauthorized access. It enforces strict separation between owner-private data (Life OS mood/energy) and agent-accessible data.

## Secret Pattern Detection in Records

The `dataClassificationEngine` in `src/privacy/data-classification-engine.js:5` defines 14 regex patterns that trigger `secret_blocked` classification:

- `/token/i`, `/secret/i`, `/password/i`, `/api[_-]?key/i`
- `/Authorization/i`, `/Bearer\s+\S+/`
- `DATABASE_URL`, `REDIS_URL`
- `postgresql://`, `rediss?://`
- `sk-` (OpenAI keys), `ghp_` (GitHub PAT), `github_pat_`, `gsk_` (Groq keys), `tvly_` (Tavily keys)

These patterns are checked by `classifyRecordSensitivity(record)` which serializes the record to JSON and tests every pattern. If any pattern matches, the record is classified `secret_blocked`.

## Secret_Blocked Classification

The `classifyDataCategory(category)` function returns the sensitivity from the `CATEGORIES` constant. Dynamic record-level classification overrides this:

- `detectSecretBlockedData(record)` - returns `true` if any secret pattern matches
- `detectSensitivePersonalData(record)` - returns `true` for mood/energy/emotion/feeling/private keywords
- `buildClassificationSummary(results)` - aggregates counts across `{ public, internal, private, sensitive, secret_blocked }`

## Never Export Secret Data

- `exportControlManager.runExportPrivacyReview()` blocks any export request that includes `secret_blocked` categories
- `exportPackageBuilder.redactExportRecord()` excludes records matching `NEVER_EXPORT_PATTERNS` (a superset of `SECRET_PATTERNS`)
- The audit module (`privacy-audit.js:8`) redacts event details if they contain token/secret/password/api_key patterns - `{ redacted: true }` is stored instead of the raw detail object

## Hard Delete Blocked for Audit/Security Data

- `deleteRequestManager.blockUnsafeHardDelete(request)` blocks hard delete if categories include `audit_logs` or `security_findings`
- Returns `{ blocked: true, reason: 'Hard delete blocked for audit/security data' }`
- This is enforced regardless of user role - even owner cannot hard delete audit or security data

## Access Guard Rules

`privacyAccessGuard` defines three roles:

- **owner** - Full access to all data including owner-only and sensitive categories. Hard delete permitted.
- **admin** - Access to non-owner-only data. Soft delete permitted but hard delete denied.
- **user** - Access only to categories where `allowedRoles` includes `'user'` (fallback/default categories).

- `checkExportAccess()` - sensitive/owner-only export requires owner role
- `checkArchiveAccess()` - requires admin or owner
- `checkDeleteAccess()` - hard delete requires owner; admin can soft delete

## Life OS Privacy (Mood/Energy = Owner-Only)

The `lifeos_mood_energy` category has special restrictions:

- `ownerOnly: true` in the data inventory - only owner role can access
- Privacy policy (`privacy-policy-engine.js:10`): `allowedRoles: ['owner']`, `allowAgentAccess: false`, `allowCodingAgentAccess: false`, `allowDashboardAccess: false`, `allowTelegramSummary: false`, `allowExport: false`
- Coding agents are explicitly blocked from accessing mood/energy data
- The `allowCodingAgentAccess` flag across all Life OS categories is set to `false` - coding agents cannot read any Life OS data
- `detectSensitivePersonalData()` catches mood/energy/emotion fields for additional classification
- The Life OS privacy report (`generateLifeOSPrivacyReport()`) lists `lifeos_mood_energy` as the only owner-only category

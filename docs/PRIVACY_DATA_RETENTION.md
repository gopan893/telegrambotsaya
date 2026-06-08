# Privacy & Data Retention Architecture

## Purpose

The privacy and data retention system governs how Telegram AI OS handles user data across all modules. It enforces classification, access control, retention limits, export redaction, archive plans, and delete request workflows. No hard delete is permitted by default; all bulk actions require proposals and approval.

## Architecture Overview - Phase 49 Modules

The system comprises 13 core modules under `src/privacy/`:

| Module | File | Responsibility |
|--------|------|---------------|
| privacy-store | `privacy-store.js` | Lightweight in-memory KV store for privacy data |
| data-inventory-scanner | `data-inventory-scanner.js` | Scans 24 data categories, builds inventory reports |
| data-classification-engine | `data-classification-engine.js` | Classifies records as public/internal/private/sensitive/secret_blocked |
| privacy-policy-engine | `privacy-policy-engine.js` | Evaluates access policies per category and role |
| retention-policy-manager | `retention-policy-manager.js` | Defines retention days, archive/delete triggers |
| privacy-access-guard | `privacy-access-guard.js` | Role-based access checks (owner/admin/user) |
| export-control-manager | `export-control-manager.js` | Creates/validates export requests, privacy review |
| export-package-builder | `export-package-builder.js` | Builds redacted export packages (JSON/MD/ZIP) |
| archive-cleanup-planner | `archive-cleanup-planner.js` | Creates archive plans, finds stale candidates |
| delete-request-manager | `delete-request-manager.js` | Manages soft/hard delete requests |
| privacy-audit | `privacy-audit.js` | Records and queries privacy audit events |
| privacy-report-generator | `privacy-report-generator.js` | Generates overview/inventory/retention/export reports |
| privacy-utils | `privacy-utils.js` | Shared utilities (ID generation) |

All modules are registered in `src/privacy/index.js` and exported as a single bundle.

## Data Inventory Scanning Flow

1. `dataInventoryScanner.scanDataInventory(workspaceId, services)` iterates `CATEGORIES`
2. For each category, a manifest entry is created with sensitivity, exportability, archive/deletion flags
3. `buildDataInventoryReport(inventory)` aggregates by source module and sensitivity level
4. `dataInventoryScanner.estimateDataCounts()` provides approximate row counts
5. Missing modules are skipped silently; no raw values are read during scanning

## Privacy Policy Enforcement Flow

1. `privacyPolicyEngine.getPrivacyPolicy(category)` returns defaults unless overridden
2. `evaluatePrivacyAccess({ actor, dataCategory, action })` checks role, owner-only flag, action permission
3. `privacyAccessGuard.checkPrivacyAccess(actor, dataRequest)` enforces role hierarchy
4. Access decisions are recorded in the privacy audit log

## Export / Archive / Delete Request Flow

- **Export**: `exportControlManager.createExportRequest()` → validate → privacy review → build manifest → optional proposal
- **Archive**: `archiveCleanupPlanner.createArchiveCleanupPlan()` → find candidates → dry-run first → proposal if bulk
- **Delete**: `deleteRequestManager.createDeleteRequest()` → validate → block unsafe hard delete → proposal → approve → soft delete

## Key Design Decisions

- **No hard delete by default**: All delete requests default to soft delete. Hard delete requires explicit flag and special approval.
- **Strict redaction**: Export records matching secret patterns (`token`, `secret`, `api_key`, `DATABASE_URL`, etc.) are excluded from export entirely.
- **Proposal-only for bulk actions**: Archive plans with >2 categories and any export with sensitive/private data require Evaluation v2 + executor approval.
- **Audit/security data protection**: Hard delete is blocked for `audit_logs` and `security_findings` categories.
- **In-memory storage**: Phase 49 uses in-memory arrays for policies, plans, and requests. Postgres persistence is deferred.

## Phase 50 Roadmap

- Persist privacy policies, retention policies, and audit events to PostgreSQL
- Implement actual data source enumeration (not just category metadata)
- Add per-record classification with pattern-based scanning
- Support multi-workspace privacy boundaries
- Integrate with backup system for permanent deletion confirmation
- Add automated retention enforcement cron
- Build privacy-focused dashboard tab with full UI

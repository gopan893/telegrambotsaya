# Archive & Cleanup Policy

## Purpose

The archive and cleanup policy system safely manages stale or old data. It prefers archiving over deletion, requires dry-run first for bulk operations, and mandates proposals before any bulk action executes.

## Retention Policy Defaults

Defined in `retention-policy-manager.js:6`:

| Category | Retention (days) | Archive After | Delete After | Default Action |
|----------|-----------------|---------------|--------------|----------------|
| telegram_session_context | 30 | 7 | 30 | archive |
| audit_logs | 180 | 90 | 365 | keep |
| security_findings | 365 | 180 | 0 | keep |
| incident_reports | 365 | 180 | 0 | keep |
| deploy_reports | 365 | 180 | 730 | archive |
| cost_usage | 365 | 180 | 0 | keep |
| lifeos_mood_energy | 90 | 30 | 180 | archive |
| lessons_learned | 730 | 365 | 0 | keep |
| improvement_feedback | 180 | 90 | 365 | archive |

Categories not listed default to 90 days retention, 30 days archive, 180 days delete.

## Archive Plan Model

Created by `archiveCleanupPlanner.createArchiveCleanupPlan(input)` in `src/privacy/archive-cleanup-planner.js`. Fields:

- `id` - SHA-1 hex identifier (16 chars)
- `workspaceId` - scope
- `categories` - list of categories to process
- `candidateCount` - number of stale items found
- `actions` - per-category action plan (archive/count)
- `riskLevel` - low (<3 categories), medium (>3 categories)
- `requiresApproval` - true when >2 categories included
- `proposalId` - linked proposal for approval
- `status` - draft → proposal_created → approved → done

## Dry-Run First, Archive Preferred Over Delete

- `findArchiveCandidates(category)` reports estimated stale count without modifying data
- `findExpiredSessionContext()` and `findStaleTemporaryData()` provide scanning utilities
- Retention action plans created by `retentionPolicyManager.createRetentionActionPlan()` default the action to the policy's `defaultAction` field
- The default action is `archive` for session, deploy, mood/energy, and feedback data
- For audit/security/incident/lessons, the default is `keep` - no automatic action taken

## Proposal Required for Bulk Archive

- Any archive plan covering more than 2 categories requires approval
- Flow: create plan → `archiveCleanupPlanner.createArchiveProposal(planId)` → Evaluation v2 → approval → `executeApprovedArchivePlan(planId)`
- Without approval, `executeApprovedArchivePlan()` returns `{ executed: false, reason: 'Plan not approved' }`
- `findDuplicatePrivateData()` detection is available but not auto-executed

## No Hard Delete by Default

- Hard delete is **explicitly disallowed** for all retention policies (`hardDeleteAllowed: false`)
- `requiresApprovalForDelete` is always `true`
- `retentionPolicyManager.validateRetentionPolicy()` enforces: if `hardDeleteAllowed` is ever set, `requiresApprovalForDelete` must remain `true`
- Actual data deletion is handled separately via `deleteRequestManager` - never triggered by retention policy directly
- Retention policies only influence archive planning; delete requests require separate user-initiated workflow

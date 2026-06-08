# Data Inventory

## Purpose

The data inventory system catalogs all stored data categories across the Telegram AI OS. It provides a single registry of what data exists, where it comes from, its sensitivity level, and whether it can be exported, archived, or deleted.

## 24 Data Categories with Sources

| Category | Source | Sensitivity | Exportable | Archiveable | Deletable | Owner Only |
|----------|--------|-------------|------------|-------------|-----------|------------|
| telegram_messages | telegram | private | no | yes | yes | no |
| telegram_session_context | telegram | private | no | yes | yes | no |
| agent_memory | memory | private | yes | yes | yes | no |
| knowledge_graph | knowledge | internal | yes | yes | no | no |
| decision_memory | knowledge | internal | yes | yes | no | no |
| lifeos_tasks | lifeos | private | yes | yes | yes | no |
| lifeos_habits | lifeos | private | yes | yes | yes | no |
| lifeos_mood_energy | lifeos | sensitive | no | yes | yes | yes |
| personal_goals | lifeos | private | yes | yes | yes | no |
| project_goals | goals | internal | yes | yes | no | no |
| operator_plans | operator | internal | yes | yes | no | no |
| portfolio_snapshots | portfolio | internal | yes | yes | no | no |
| executor_proposals | executor | sensitive | no | yes | no | no |
| audit_logs | audit | sensitive | no | yes | no | no |
| security_findings | security | sensitive | no | yes | no | no |
| incident_reports | observability | sensitive | yes | yes | no | no |
| deploy_reports | deploy | internal | yes | yes | no | no |
| githubops_reports | githubops | internal | yes | yes | no | no |
| cost_usage | cost | private | yes | yes | no | no |
| improvement_feedback | improvement | internal | yes | yes | yes | no |
| lessons_learned | improvement | internal | yes | yes | no | no |
| routines | routines | internal | yes | yes | no | no |
| backups_metadata | backup | internal | no | no | no | no |
| dashboard_settings | dashboard | sensitive | no | no | yes | no |

The inventory is defined as a constant `CATEGORIES` in `data-inventory-scanner.js:6`.

## Sensitivity Classification

Five-tier classification used across the system:

- **public** - No restrictions (currently unused, reserved for future public data)
- **internal** - Visible to owner, admin, and user roles; exportable by default
- **private** - Agent-accessible; exportable unless explicitly flagged; not owner-only
- **sensitive** - Restricted access; not exportable without owner approval; includes mood/energy, executor proposals, audit, security, incident data, dashboard settings
- **secret_blocked** - Dynamic classification applied when records match secret patterns; never exportable; triggers access denial

## Scan Rules

- Scanning is **read-only** - the scanner enumerates category metadata, not actual record values
- If a source module is missing or unavailable, its categories are **skipped silently**
- No raw values are returned in inventory reports - only category names, counts, and metadata flags
- The `estimateDataCounts()` function returns approximate counts; actual enumeration is deferred to Phase 50

## Integration with Governance and Security Modules

- `dataClassificationEngine.classifyRecordSensitivity()` is used by the Unified Governance Policy Engine for access decisions
- Secret pattern detection (`SECRET_PATTERNS` in `data-classification-engine.js:5`) cross-references with the Phase 48 security secret surface scanner
- Privacy audit events are recorded via `privacyAudit.recordPrivacyAudit()` and surfaced in the governance dashboard
- `buildDataInventoryReport()` feeds sensitivity summaries to the security scorecard module

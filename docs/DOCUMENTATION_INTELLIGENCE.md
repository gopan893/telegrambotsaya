# Documentation Intelligence

## Overview
Automated docs scanning, gap detection, freshness review, and update planning for the Telegram AI OS documentation suite.

## Modules

| Module | Role |
|--------|------|
| `docs-inventory-scanner.js` | Scan project docs existence and size |
| `docs-gap-detector.js` | Detect command/docs/architecture/env/testing gaps |
| `docs-freshness-reviewer.js` | Review docs freshness for phase/env/dashboard/release |
| `command-docs-checker.js` | Check command documentation coverage |
| `architecture-docs-checker.js` | Check ARCHITECTURE_MAP.md coverage |
| `docs-update-plan-generator.js` | Generate update plans, prompts, proposals |
| `docs-report-generator.js` | Generate combined docs intelligence report |

## Dashboard
- Tab: `#docs-intel`
- Aliases: `docs`, `documentation`, `docs-intel`, `docscheck`
- API base: `/api/dashboard/docs-intel`

## Security
- No file write from runtime.
- Plans and prompts are proposal-only.
- No secrets in any output.

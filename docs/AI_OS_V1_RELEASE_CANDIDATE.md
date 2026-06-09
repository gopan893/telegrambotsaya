# Stable AI OS v1 Release Candidate

## Overview

This document describes the Stable AI OS v1 Release Candidate (v1.0.0-rc.1).

The release candidate freezes new major features and runs production readiness gates across all modules before the final v1.0.0 release.

## Release Process

1. Create Release Candidate (v1.0.0-rc.1)
2. Start Release Freeze
3. Run Module Readiness Check
4. Run Production Readiness Gate
5. Run Compatibility Verification
6. Review Release Risks
7. Generate Release Notes & Changelog
8. Generate Environment Checklist
9. Generate Operator Guide
10. Generate Release Report
11. Create Release Proposals (GitHub tag/release, deploy)
12. Approval and execution

## Key Commands

Telegram:
- `/releasecandidate` - Release candidate status
- `/rc` - Alias for release candidate
- `/v1status` - v1 release status
- `/releasefreeze` - Release freeze status
- `/readiness` - Module readiness summary
- `/productionready` - Production readiness gate
- `/releaseblockers` - Blocker summary
- `/releaserisks` - Risk summary
- `/releasenotes` - Release notes preview
- `/changelog` - Changelog summary
- `/envchecklist` - Environment names only
- `/operatorguide` - Operation guide
- `/propose_release` - GitHub release proposal
- `/propose_release_deploy` - Deploy proposal

Dashboard:
- Release Candidate tab with full management UI
- Module readiness, production readiness, compatibility, risk review
- Release notes, changelog, env checklist, operator guide
- Proposal creation (proposal-only, no direct execution)

## Safety Rules

- All write/external/danger actions require proposal + approval
- No direct GitHub tag/release/deploy from runtime
- No auto-approve, no auto-run, no shell executor
- Secrets redacted in all outputs
- Hard delete blocked by default

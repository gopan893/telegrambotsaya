# Registry v3 Contract Freeze

## Phase 76 - AI OS v3 Implementation Planning

### Status
- Phase: 76 (Registry Contract Freeze + Route Generation Plan)
- Date: 2026-06-11
- Registry v3 Contract Version: 3.0.0
- Status: Planning/Freeze Stage

### Overview
Registry v3 Contract Freeze is the first phase of AI OS v3 implementation. It establishes a frozen contract for the registry v3 structure that dashboard tabs, API routes, renderers, Telegram commands, capabilities, and aliases must conform to going forward.

### Registry v3 Item Contract

```json
{
  "id": "unique_item_id",
  "version": "3.0.0",
  "type": "dashboard_tab|dashboard_api|dashboard_renderer|telegram_command|capability|alias|module",
  "module": "source_module",
  "title": "Human-readable title",
  "description": "Item description",
  "canonicalId": "type:id",
  "aliases": ["alias1", "alias2"],
  "status": "draft|active|deprecated|blocked|unknown",
  "visibility": "public|admin|owner|internal|hidden",
  "riskLevel": "low|medium|high|critical",
  "requiresAuth": true,
  "requiresOwner": false,
  "requiresAdmin": false,
  "requiresApproval": false,
  "requiresEvaluation": false,
  "directRunAllowed": false,
  "ownerOnly": false,
  "enabled": true,
  "compatibility": {},
  "docs": "path/to/doc",
  "tests": "path/to/test",
  "createdAt": "ISO-timestamp",
  "updatedAt": "ISO-timestamp"
}
```

### Freeze Rules
1. After freeze, contract shape cannot change without version bump
2. Adding new fields requires minor version bump
3. Removing fields requires major version proposal + approval
4. Changing `directRunAllowed` for dangerous actions to true is blocked
5. Registry freeze does not replace registry v2 automatically

### Versioning
- **Patch**: docs/tests/description only
- **Minor**: additive fields/aliases/non-breaking tab additions
- **Major**: breaking field removal/contract behavior change (requires approval)

### Safety Boundaries
- Shell executor capabilities are permanently blocked
- Auto-approve capabilities are blocked
- Credential access capabilities are blocked
- External write/danger actions require approval
- Dangerous capabilities must have `directRunAllowed: false`
- Active critical items must have docs and tests

### Compatibility Bridge
- Registry v2 callers continue to work
- Old dashboard tabs continue to open
- Old command aliases preserved (or show safe deprecation warning)
- No forced replacement of registry v2

### Migration Blockers
- Unstable dashboard tabs
- Missing renderer contracts
- Missing API contracts
- Dangerous `directRunAllowed: true`
- Secret leaks in registry
- Missing compatibility strategy
- No rollback plan

### Files Created
- src/registry-v3/ (10 modules)
- src/route-generation/ (16 modules)
- src/dashboard/registry-v3-routes.js
- public/dashboard/registry-v3.js
- scratch/ (20 test files)

### Tests
See scratch/test-phase76-registry-route-generation-regression.js for full regression suite.

### Next Phase
Phase 77: Dashboard Shell Generation (from frozen registry v3 contract)
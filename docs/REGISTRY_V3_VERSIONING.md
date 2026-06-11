# Registry v3 Versioning

Registry v3 uses semantic-like versioning for contract changes.

### Version Model
```json
{
  "contractVersion": "3.0.0",
  "status": "draft|frozen",
  "changes": ["list of changes"],
  "compatibilityNotes": "notes",
  "migrationNotes": "migration steps",
  "createdAt": "ISO timestamp"
}
```

### Change Types
| Type | Trigger | Approval |
|------|---------|----------|
| Patch | docs/tests/description only | Auto |
| Minor | Additive fields/aliases/tabs | Auto |
| Major | Breaking field/contract change | Required |

### Major Change Rules
- Cannot happen automatically
- Requires migration plan
- Requires approval
- Old compatibility aliases preserved

### Version History
Managed by `registry-v3-version-manager.js`:
- `getCurrentRegistryV3Version(services)`
- `proposeRegistryV3VersionBump(change, services)`
- `classifyRegistryV3VersionChange(change, services)`
- `buildRegistryV3VersionReport(services)`
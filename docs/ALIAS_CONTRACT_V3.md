# Alias Contract v3

Stable contract for aliases in registry v3.

### Contract
```json
{
  "alias": "alias_name",
  "canonicalId": "type:canonical_id",
  "type": "dashboard_tab|telegram_command|capability|module",
  "module": "source_module",
  "sourceVersion": "v2|v3",
  "status": "active|deprecated|blocked",
  "conflictStatus": "none|potential|resolved|active",
  "deprecationStatus": "none|warned|deprecated|blocked",
  "migrationNotes": null,
  "enabled": true
}
```

### Rules
- No silent alias removal
- Conflicts must be reported
- Deprecation requires migration notes
- Old aliases preserved until migration approved
- Blocked aliases must have migration notes explaining why
- Active alias conflicts must have migration notes
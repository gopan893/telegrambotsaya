# Capability Contract v3

Stable contract for system capabilities in registry v3.

### Contract
```json
{
  "id": "cap_id",
  "module": "source_module",
  "action": "action_name",
  "actionType": "read|report|simulate|dry_run|proposal|internal_write|external_write|dangerous",
  "riskLevel": "low|medium|high|critical",
  "externalSystem": null,
  "dataSensitivity": "low|medium|high",
  "requiresApproval": false,
  "requiresEvaluation": false,
  "requiresSecretScan": false,
  "requiresCostGuard": false,
  "requiresPrivacyGuard": false,
  "directRunAllowed": false,
  "ownerOnly": false,
  "enabled": true
}
```

### Blocked Capabilities
- Shell executor
- Credential/secret access
- Auto-approve
- Auto-run

### Safety Rules
- external_write/dangerous: `directRunAllowed` must be false
- Deploy/rollback/push/release/restore: requires approval + evaluation
- Shell executor: permanently blocked
- Credential access: permanently blocked
- Private data requires privacy guard
- External systems require approval
# Telegram Command Contract v3

Stable contract for Telegram bot commands in registry v3.

### Contract
```json
{
  "id": "cmd_id",
  "command": "/command",
  "canonicalCommand": "/command",
  "aliases": ["/alias"],
  "module": "source_module",
  "description": "Description",
  "handlerName": "handleCommand",
  "riskLevel": "low|medium|high|critical",
  "actionType": "read|report|simulate|dry_run|proposal|internal_write|external_write|dangerous",
  "requiresOwner": false,
  "requiresAdmin": false,
  "requiresApproval": false,
  "requiresEvaluation": false,
  "directRunAllowed": false,
  "privateDataAllowed": false,
  "docs": "doc_path",
  "tests": "test_path",
  "enabled": true
}
```

### Safety Rules
- Old commands preserved or aliased
- Dangerous commands proposal-only
- Shell command permanently blocked
- Auto-approve permanently blocked
- Unknown commands get safe help response
- Bot-to-bot loops blocked
- External write requires approval
- Private data access requires privacy guard
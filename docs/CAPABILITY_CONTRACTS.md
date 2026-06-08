# Capability Contracts

## Overview

Every capability in the system has a contract defining its risk level, requirements, and restrictions.

## Contract Model

```json
{
  "capabilityId": "githubops.push.propose",
  "module": "githubops",
  "name": "push.propose",
  "actionType": "external_write",
  "riskLevel": "high",
  "externalSystem": "github",
  "enabled": true,
  "requires": {
    "owner": false,
    "admin": false,
    "evaluation": true,
    "executorApproval": true,
    "secretScan": true,
    "costGuard": true
  },
  "restrictions": ["proposal_only", "evaluation_required", "approval_required", "no_direct_push"]
}
```

## Standard Contracts

### GitHub
- `github.status.read` → read (allowed)
- `github.push.propose` → external_write (proposal only, eval+approval)
- `github.workflow.propose` → external_write (proposal only, eval+approval)
- `github.issue.propose` → external_write (proposal only, eval+approval)
- `github.pr.propose` → external_write (proposal only, eval+approval)

### Deploy (Render)
- `render.deploy.propose` → external_write (proposal only, owner+eval+approval)
- `render.rollback.propose` → dangerous (proposal only, owner+eval+approval)
- `render.env.read` → read (admin)

### Gmail
- `gmail.draft.propose` → external_write (proposal only, eval+approval)
- `gmail.send` → external_write (disabled by default, strict proposal only)

### Calendar
- `calendar.events.read` → external_read (allowed)
- `calendar.event.propose` → external_write (proposal only, eval+approval)

### Webhook
- `webhook.preview` → dry_run (allowed)
- `webhook.post.propose` → external_write (proposal only, eval+approval, secret scan)

### Backup
- `backup.create.propose` → proposal (medium, eval)
- `backup.restore.propose` → dangerous (owner+eval+approval)

### Memory/Knowledge
- `memory.write.safe` → internal_write (secret gate)
- `memory.delete` → internal_write (disabled by default)
- `memory.archive` → internal_write (guarded)
- `knowledge.write.safe` → internal_write (secret gate)

### Operating Loop
- `loop.readonly.run` → read (allowed)
- `loop.proposal.create` → proposal (allowed)
- `loop.external.run` → external_write (disabled by default)

### Improvement
- `improvement.plan.create` → plan (allowed)
- `improvement.prompt.generate` → report (allowed)
- `improvement.code.patch` → external_write (disabled by default, blocked from runtime)

## Risk Matrix

| Risk Level | Eval | Approval | Cost Guard | Secret Scan |
|------------|------|----------|------------|-------------|
| read_only  | ❌   | ❌       | ❌         | ❌          |
| low        | ❌   | ❌       | ❌         | ❌          |
| medium     | ✅   | ❌       | ❌         | ❌          |
| high       | ✅   | ✅       | ✅         | ✅          |
| danger     | ✅   | ✅       | ✅         | ✅          |
| blocked    | ✅   | ✅       | ✅         | ✅          |

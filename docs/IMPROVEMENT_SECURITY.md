# Improvement Engine Security

## No Secret Storage

The improvement engine **never stores** secrets, API keys, tokens, or passwords:
- Feedback is redacted before storage
- Lesson content is sanitized of credentials
- Proposals do not contain secrets
- All secret handling is delegated to existing secret management (env vars, vault)

## Feedback Redaction

Before any feedback enters the pipeline:
1. Regex patterns detect potential secrets (API keys, tokens, JWTs, URLs with credentials)
2. Matched values replaced with `[REDACTED]`
3. Original raw feedback is discarded (never persisted)
4. Only redacted version enters the improvement pipeline

## No Direct Code Mutation

The improvement engine **never directly modifies** source code:
- All code changes are generated as proposals (text/Chat)
- Proposals must pass through the evaluation gate
- Approved proposals are applied by the executor which:
  - Creates a branch in the workspace
  - Applies the change
  - Runs lint/tests
  - Reports success/failure
  - Does NOT push — that requires deploy pipeline

## No Direct GitHub Push

The improvement executor:
- Works exclusively in the local workspace
- Never calls `git push`
- Never calls GitHub API for write operations
- Creates local changes only
- GitHub writes go through the deploy pipeline with human approval

## Evaluation Gate Checks

Every proposal must pass these checks before execution:

| Check | What it validates |
|-------|-------------------|
| Syntax | Generated code is syntactically valid |
| Lint | Code passes linting rules |
| Tests | Existing tests still pass |
| Security scan | No secrets, no dangerous patterns |
| Cost impact | Token cost impact is estimated |
| Governance | Respects governance rules |

## Approval Boundary

```
Proposal created
    │
    ▼
Evaluation Gate ──fail──→ Rejected (logged)
    │ pass
    ▼
Human Approval ──reject──→ Rejected (logged)
    │ approve
    ▼
Improvement Executor
    │
    ▼
Audit Logged
```

- Low severity: auto-approve after evaluation gate pass
- Medium severity: human approval required
- High/critical severity: human approval + second reviewer

## Audit Logging

Every improvement action is logged:

| Event | Fields |
|-------|--------|
| Feedback received | id, source, timestamp |
| Lesson created | id, category, source |
| Proposal created | id, plan, changes |
| Evaluation passed | proposal id, checks |
| Evaluation failed | proposal id, failure reason |
| Approved | proposal id, approver |
| Rejected | proposal id, reason |
| Executed | proposal id, result |
| Executed failed | proposal id, error |

Logs are immutable (append-only) and stored in PostgreSQL.

## Prompt Safety

When `NextAgentPromptGenerator` injects lessons into agent prompts:
1. Lessons are formatted as structured instructions (not free text)
2. Instructions are bounded (max N lessons per agent)
3. Conflicting lessons are detected and flagged
4. Prompt versioning allows rollback

## Comparison with Previous Phases' Security Rules

| Aspect | Previous Phases | Phase 46 |
|--------|----------------|----------|
| Code changes | Direct agent edits | Proposals only |
| GitHub write | Via GitHub connector | Never from improvement engine |
| Secret handling | Env vars only | Plus feedback redaction |
| Approval | Per-action | Gate + tiered approval |
| Audit | Basic logging | Full immutable audit trail |
| Prompt changes | Direct agent prompt edit | Structured lesson injection |
| Rollback | Manual | Prompt versioning |

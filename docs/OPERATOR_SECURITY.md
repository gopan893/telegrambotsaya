# Operator Security

## Prohibited Actions

The operator module MUST NEVER:
- Execute GitHub push directly
- Execute deploy/rollback directly
- Run shell commands
- Auto-approve executor proposals
- Auto-run write/external/danger actions
- Expose API keys, tokens, secrets, or environment variables

## Evaluation Gate Checks

Before any proposal is created, the evaluation gate verifies:
1. No direct external write (git push, deploy, rollback keywords)
2. Approval boundary intact (high-risk items require approval)
3. Operator safety validated

## Report Sanitization

All reports and logs are sanitized:
- Secret patterns (token, password, api_key, Authorization, Bearer) are redacted
- Connection strings (DATABASE_URL, REDIS_URL, postgresql://, rediss://) are redacted
- API keys (sk-, ghp_, gsk_, tvly_) are redacted

## Audit Trail

The operator creates audit log entries for:
- Goal created
- Plan created
- Tasks created
- Risk review run
- Evaluation gate run
- Proposal created
- Progress updated

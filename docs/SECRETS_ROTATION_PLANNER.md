# Secrets Rotation Planner

## Purpose

The Rotation Planner generates structured, human-readable credential rotation plans. It is a planning-only subsystem — it never executes rotation, never touches secret values, and never calls external APIs. Its output is a JSON/YAML document that a human operator follows step by step. This eliminates the risk of automated lockout, mis-rotation, or partial credential updates that leave the system in an inconsistent state.

## Rotation Plan Model Structure

Each rotation plan is a Pydantic model with the following fields:

```
RotationPlan:
  plan_id: UUID (auto-generated)
  created_at: datetime
  credential_name: str         # e.g. "TELEGRAM_BOT_TOKEN"
  credential_type: CredentialType
  target_service: str           # e.g. "telegram_bot"
  current_key_id: str | None    # reference hint, never the value
  proposed_key_id: str | None
  rotation_steps: list[RotationStep]
  verification_steps: list[VerificationStep]
  rollback_steps: list[RollbackStep]
  risk_assessment: str          # "low" | "medium" | "high" | "critical"
  estimated_duration_minutes: int
  requires_downtime: bool
  created_by: str               # always "ai_assistant" or "human"

RotationStep:
  step_number: int
  action: str                   # e.g. "generate_new_token", "update_env_var"
  target: str                   # e.g. "local .env file"
  details: str
  expected_outcome: str

VerificationStep:
  step_number: int
  check_description: str        # e.g. "Send test message via bot"
  expected_result: str
  fallback_on_failure: str

RollbackStep:
  step_number: int
  action: str                   # e.g. "restore previous token"
  details: str
  verification: str             # how to confirm rollback succeeded
```

## Supported Credential Types

| Type | Enum Value | Examples |
|------|-----------|---------|
| Telegram | `telegram_bot_token` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEV_BOT_TOKEN` |
| GitHub | `github_token` | `GITHUB_TOKEN`, `GH_PAT` |
| Database | `database_url` | `DATABASE_URL`, `POSTGRES_URL` |
| Render | `render_api_key` | `RENDER_API_KEY`, `RENDER_DEPLOY_HOOK` |
| Google | `google_oauth` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |
| Cloudflare | `cloudflare_token` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` |
| Generic | `generic_secret` | Any custom credential |

## Manual vs Automatic (Why Manual Only)

The system does not support automatic rotation for the following reasons:

1. **Irreversible lockout risk.** An automated bug could revoke the active credential before the new one is verified, locking the system out of Telegram, GitHub, or Render with no recovery path.
2. **Multi-step coordination.** Many credentials require coordinated updates across services. For example, rotating a Telegram bot token requires updating it in the bot code and in any webhook URLs simultaneously.
3. **Human verification required.** Some verification steps require human judgment — e.g., "send a test message and confirm the bot responds correctly" cannot be automated without a test user.
4. **Rollback complexity.** If a rotation fails, the rollback sequence may require human intervention to restore service. An automated rollback could compound the failure.
5. **Audit trail requirement.** Security best practices dictate that credential rotation should be a human-approved, logged, and auditable event. Full automation blurs the accountability chain.

## Verification Steps Pattern

Every rotation plan includes verification steps that follow a consistent pattern:

1. **Pre-rotation verification** — confirm the current credential is working before making any changes.
2. **Post-rotation smoke test** — confirm the new credential works for basic operations (e.g., API call, message send).
3. **Integration test** — confirm dependent systems still work (e.g., webhook delivery, database connection).
4. **Rollback readiness check** — confirm the old credential is backed up and accessible before considering the rotation complete.
5. **Final verification** — run the same test as step 1 with the new credential and confirm identical results.

Each verification step includes a `fallback_on_failure` field describing exactly what to do if the check fails.

## Rollback Considerations

Rollback steps are generated based on the credential type:

- **Telegram tokens:** Revoke the new token via BotFather, re-activate the old token. Update env var to previous value.
- **GitHub tokens:** Delete the new fine-grained token, re-enable or re-create the old token. Validate with `gh auth status`.
- **Database URLs:** Restore the previous `DATABASE_URL` from backup env file. Run `pg_isready` to confirm connectivity.
- **Render API keys:** Generate a new API key in the Render dashboard, update env, verify deploy hook still works.
- **Google OAuth:** Re-activate the previous client secret in Google Cloud Console. Wait 5 minutes for propagation.
- **Cloudflare tokens:** Re-activate the previous API token in Cloudflare dashboard. Verify DNS and tunnel connectivity.

All rollback plans include a verification step to confirm the rollback succeeded.

## Safety Rules

1. **Never execute a rotation.** The planner generates a document. It never calls `os.environ.__setitem__`, `subprocess`, or any credential API.
2. **Never display secret values.** The `current_key_id` field stores a truncated hint (e.g., `"tok_****"`) or `None`, never the full credential.
3. **Never store plans with secrets.** The `RotationPlan` model explicitly excludes any field that could hold a secret value.
4. **One credential per plan.** Each plan addresses exactly one credential. Multi-credential rotations require separate plans to reduce blast radius.
5. **Plans expire.** A generated plan is considered stale after 72 hours and should be regenerated if not executed.
6. **Require human confirmation.** The system must never offer to execute a plan. The output is always "present the plan to an operator."

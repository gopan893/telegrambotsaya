# Approval Bypass Audit

## Purpose

The Approval Bypass Audit systematically examines every action path in the system that could cause irreversible or impactful side effects. Each path is checked against the governance evaluation policy to confirm that human approval is enforced before execution. The audit answers one question: *Can any action reach its external effect without passing through an approval gate?*

## All Risky Paths Audited

The following 9 action paths are audited for approval enforcement:

| # | Path | Description | Expected Behavior |
|---|------|-------------|-------------------|
| 1 | GitHub Push | `git push` to any remote (main or branch) | Blocked unless explicitly approved via proposal flow |
| 2 | Workflow Dispatch | `gh workflow run` triggering GitHub Actions | Blocked; only proposal generated |
| 3 | Render Deploy | Triggering deploy via Render API or deploy hook | Blocked; only proposal generated |
| 4 | Rollback | Restoring a previous backup or deployment | Blocked; requires explicit human confirmation |
| 5 | Backup Restore | Executing a backup restoration (database, files) | Blocked; requires explicit human confirmation |
| 6 | Webhook POST | Sending outbound webhook with payload | Blocked unless approval gate is passed |
| 7 | Gmail Send | Sending email via Gmail API | Blocked; only proposal with draft content generated |
| 8 | Calendar Write | Creating/modifying/deleting calendar events | Blocked; only proposal with event details generated |
| 9 | Operating Loop External Action | Any external API call from the operating loop that mutates state | Blocked; approval required per governance policy |

## Expected Behavior for All Paths

All 9 paths must follow the same approval pattern:

1. **Action is requested** by the AI (via tool call or capability invocation).
2. **Governance evaluation** intercepts the action and checks its approval requirement.
3. **If approval is required:** the action is converted to a proposal. A structured proposal document is created with the action details, arguments, effects, and risk assessment.
4. **Proposal is presented** to the human operator via the dashboard or Telegram.
5. **Human reviews** the proposal and either approves, rejects, or modifies it.
6. **Only on explicit approval** does the action execute. The execution uses the approved parameters, not the original request.

Any deviation from this pattern — direct execution, silent execution, or execution with auto-approval — is flagged as an approval bypass vulnerability of critical severity.

## Audit Report Format

The audit produces a structured report:

```
ApprovalBypassAuditReport:
  generated_at: datetime
  overall_status: str            # "all_blocked" | "bypass_found"
  bypass_count: int
  total_paths_audited: int
  findings: list[PathFinding]

PathFinding:
  path_id: str                   # e.g. "github_push"
  description: str
  status: str                    # "blocked" | "bypass_detected" | "not_found"
  approval_enforced: bool
  enforcement_point: str | None  # e.g. "GovernanceEvaluation.evaluate()"
  evidence: str                  # code location or config showing enforcement
  risk_level: str                # "critical" | "high"
  recommendation: str            # how to fix if bypass detected
```

If any path has status `"bypass_detected"`, the overall status is `"bypass_found"` and the scorecard is penalized by 30 points.

## Integration with Governance Evaluation Policy

The bypass audit does not define its own approval rules. Instead, it queries the **Governance Evaluation Policy** (`src/security/governance_evaluation.py`) for each path:

```
governance_evaluation.is_action_approved(
    action_type=action_type,
    capability=capability_name,
    args=action_args,
    context=execution_context
)
```

The governance evaluation returns one of:
- `Approved` — action may proceed (requires explicit prior approval config).
- `RequiresApproval` — action must be converted to proposal.
- `Denied` — action is permanently blocked by policy.

The bypass audit checks that no path receives `Approved` unless the human has explicitly configured an exception in the governance policy. Default behavior for all 9 risky paths must be `RequiresApproval`.

The integration also cross-checks the **capability risk registry** (`capability_risk.py`). Any capability with risk level `"high"` or `"critical"` must automatically require approval. The audit verifies this mapping is consistent and that no high-risk capability bypasses the approval gate.

## Safety Rules

1. **Assume bypass until proven blocked.** The auditor starts with the assumption that every path is vulnerable and requires positive evidence of enforcement.
2. **Evidence must be concrete.** A finding of `"blocked"` must cite a specific code location (file and line number) where enforcement occurs.
3. **Configuration is not enforcement.** If a path relies on configuration (e.g., an env var) rather than code-level enforcement, the audit flags it as a bypass.
4. **No false negatives.** The audit errs on the side of reporting a bypass. If the enforcement mechanism is unclear, it is reported as a finding.
5. **Re-audit after every capability change.** Adding or modifying a capability triggers an automatic re-audit of all paths that the new capability could affect.

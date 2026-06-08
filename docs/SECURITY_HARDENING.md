# Security Hardening — Phase 48

## Purpose

Phase 48 implements defense-in-depth security hardening for the Telegram AI OS. The goal is to eliminate entire classes of vulnerabilities — prompt injection, secret exfiltration, approval bypass, credential drift, and env misconfiguration — through layered architectural controls rather than point fixes. Every module in `src/security/` is designed with the principle that the AI operates under adversarial conditions and must be resilient by construction.

## Architecture Overview

Phase 48 introduces 14 core security modules under `src/security/`:

| # | Module | Responsibility |
|---|--------|----------------|
| 1 | `rotation_planner.py` | Generates rotation plans for credentials; never rotates directly |
| 2 | `red_team_audit.py` | Runs red-team cases against the running system to detect vulnerabilities |
| 3 | `approval_bypass_audit.py` | Audits every risky action path for proper approval enforcement |
| 4 | `env_drift_detector.py` | Detects missing, deprecated, or dangerous env var configurations |
| 5 | `security_scorecard.py` | Aggregates all security signals into a unified 0–100 score |
| 6 | `security_policy.py` | Defines the security policy model (rules, thresholds, exclusions) |
| 7 | `secret_finder.py` | Scans files, env, and git history for leaked secrets |
| 8 | `permission_audit.py` | Audits file permissions, ownership, and access control lists |
| 9 | `capability_risk.py` | Assigns risk scores to each capability based on blast radius |
| 10 | `governance_evaluation.py` | Evaluates governance policy compliance across all actions |
| 11 | `security_models.py` | Pydantic models for all security entities |
| 12 | `security_dashboard.py` | FastAPI router exposing security endpoints |
| 13 | `security_tab.py` | Dashboard tab registration and UI binding |
| 14 | `security_scan.py` | Orchestrator that runs all security checks on demand or schedule |

## Security Audit Flow Diagram

```
[Trigger: manual request / schedule / pre-deploy hook]
                    │
                    ▼
          ┌─────────────────┐
          │ security_scan   │
          │ orchestrator    │
          └────┬────────────┘
               │
       ┌───────┼───────────────┬──────────────────┐
       ▼       ▼               ▼                  ▼
  ┌────────┐ ┌──────┐ ┌────────────┐ ┌──────────────┐
  │secret  │ │env   │ │permission  │ │capability    │
  │finder  │ │drift │ │audit       │ │risk          │
  └────────┘ └──────┘ └────────────┘ └──────────────┘
       │         │            │               │
       ▼         ▼            ▼               ▼
  ┌──────────────────────────────────────────────┐
  │         security_scorecard                   │
  │  aggregates findings → score 0–100           │
  └──────────────────┬───────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────┐
  │         security_dashboard                   │
  │  FastAPI /api/v1/security/* endpoints        │
  └──────────────────┬───────────────────────────┘
                     │
                     ▼
  ┌──────────────────────────────────────────────┐
  │         security_tab                         │
  │  Registered as "security" in dashboard nav   │
  └──────────────────────────────────────────────┘
```

## Module Dependency Map

```
security_models.py (foundation, no deps on other security modules)
       │
       ├── security_policy.py
       ├── secret_finder.py
       ├── env_drift_detector.py
       ├── permission_audit.py
       ├── capability_risk.py
       │
       ├── rotation_planner.py (depends on: security_policy, security_models)
       ├── red_team_audit.py (depends on: security_models, security_policy)
       ├── approval_bypass_audit.py (depends on: security_models, governance_evaluation)
       ├── governance_evaluation.py (depends on: security_models, security_policy)
       │
       ├── security_scorecard.py (depends on: all auditors, secret_finder, env_drift, etc.)
       ├── security_scan.py (depends on: security_scorecard, all auditors)
       ├── security_dashboard.py (depends on: security_scan, security_models)
       └── security_tab.py (depends on: security_dashboard)
```

No circular dependencies. `security_models.py` is the leaf dependency. The dashboard layer depends on the scan layer, which depends on the audit layer, which depends on the model/policy layer.

## Secret Protection Rules

1. **Never log secrets.** All secret values must be redacted before entering logs, exceptions, or dashboard responses.
2. **Never return secrets in API responses.** The security dashboard endpoints mask all secret values as `"****"`.
3. **Secrets are ephemeral references.** The system stores credential names and IDs only. Actual values live in environment variables or the OS keychain.
4. **No secret caching.** Secret values are read from env at point of use and never stored in memory beyond the immediate operation.
5. **Rotation is planning-only.** The rotation planner generates a structured plan with verification steps and rollback procedures. It never touches a credential value or invokes an API call.
6. **Secret finder is read-only.** It scans files, git log, and environment variable names — never values — and reports findings without modifying anything.
7. **Git history scanning is opt-in.** Scanning git history for secrets requires explicit flag (`--scan-git-history`) and warns about performance impact on large repos.

## Key Design Decisions

1. **No auto-rotate.** Credential rotation is always manual. The system plans, documents, and verifies — but never executes rotation. This prevents catastrophic lockout from an automated bug.
2. **No shell executor.** No security module invokes `subprocess`, `os.system`, `exec`, or `eval`. All operations use pure Python or safe API calls via established connectors.
3. **No direct credential access.** Security modules see credential *names* (e.g., `TELEGRAM_BOT_TOKEN`) and metadata, never values. The dashboard masks all secret values.
4. **Scorecard is advisory.** The security score (0–100) informs human decision-making. No automated action (deploy, push, restart) gates on the score.
5. **Default-deny for approval bypass audit.** Every action path is assumed unapproved until proven otherwise. The audit flags any path where approval is not enforced.
6. **Red-team cases never execute payloads.** All 13 default cases are analyzed statically. The auditor checks whether the system *would* be vulnerable, not by attempting exploitation.
7. **Env drift detector validates names only.** It never reads or exposes env values. Detection is based on defined-required vs defined-present comparison.

## Phase 49 Roadmap

| Feature | Status | Priority |
|---------|--------|----------|
| Scheduled recurring security scans | Planned | High |
| Slack/Telegram alert integration for score drops | Planned | High |
| SBOM generation | Planned | Medium |
| Dependency vulnerability scanning (pip audit) | Planned | Medium |
| Network egress audit (unexpected outbound connections) | Planned | Medium |
| Container image signing verification | Planned | Low |
| Hardware-backed key storage (TPM/enclave) | Planned | Low |
| FIPS 140-2 compliance mode | Future | Low |
| Zero-trust network policy generator | Future | Low |

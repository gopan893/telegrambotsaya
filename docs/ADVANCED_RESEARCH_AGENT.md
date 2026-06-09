# Advanced Research Agent

## Overview
Research Agent for the Telegram AI OS that safely researches technical topics, summarizes findings, compares options, generates implementation plans, and creates next-agent prompts.

## Flows

### Flow A — Research
1. User asks research question.
2. Research agent classifies topic (api_research, ai_model_research, cost_comparison, etc.).
3. System checks sensitivity/privacy.
4. Sources gathered from allowed read-only sources.
5. Research notes summarized with facts, unknowns, gaps.
6. Comparison/risk/cost review generated.
7. Implementation plan created.
8. Next-agent prompt generated.
9. Proposal created only for risky follow-up actions.

### Flow B — Documentation
1. User requests docs check.
2. System scans docs and command registry.
3. Detects outdated/missing docs.
4. Generates docs gap report.
5. Creates docs update plan.
6. Generates Codex/OpenCode prompt for docs update.
7. Proposal only if write/change needed.

## Modules

| Module | Role |
|--------|------|
| `research-task-manager.js` | Create, update, list research tasks |
| `research-intent-classifier.js` | Classify intent, sensitivity, external needs |
| `source-registry.js` | Register, validate, list research sources |
| `source-quality-scorer.js` | Score source quality, freshness, authority, relevance |
| `research-note-builder.js` | Build notes, extract facts, questions, constraints |
| `research-summarizer.js` | Generate summaries with evidence |
| `comparison-matrix-generator.js` | Compare API/model/deployment options |
| `implementation-note-generator.js` | Generate architecture impact, risk, test, rollout plans |
| `research-risk-reviewer.js` | Review research risk, external source risk, implementation risk |
| `research-prompt-generator.js` | Generate Codex/OpenCode/Hermes prompts |
| `research-proposal-bridge.js` | Create action plans and executor proposals |

## Constraints
- No external write from runtime.
- No secrets in research notes or reports.
- Read-only sources preferred.
- Proposal-only for write/danger follow-ups.

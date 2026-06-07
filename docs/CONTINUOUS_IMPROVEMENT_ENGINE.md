# Continuous Improvement Engine

## Purpose

The Continuous Improvement Engine (CIE) is a self-learning subsystem that collects feedback, detects weaknesses, generates lessons, and proposes improvements. It enables the AI OS to autonomously improve its behavior over time without manual intervention.

## Architecture

The engine implements a closed-loop pipeline:

```
User Feedback / Outcome Data
         │
         ▼
┌─────────────────┐
│  1. Collect      │  ← Telegram, Dashboard, Implicit signals
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. Classify     │  ← Quality classifier (good/bad/neutral)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. Detect       │  ← Weakness detector (pattern matcher)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. Analyze      │  ← Root cause analysis
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. Learn        │  ← Lesson creator
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  6. Plan         │  ← Improvement planner
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  7. Propose      │  ← Proposal generator
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  8. Approve      │  ← Evaluation gate + human approval
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  9. Run          │  ← Apply approved improvement
└─────────────────┘
```

## Components

| # | Module | Description |
|---|--------|-------------|
| 1 | FeedbackCollector | Ingests feedback from Telegram, Dashboard, and implicit signals |
| 2 | OutcomeCapture | Records outcomes of agent actions (success/failure/cost) |
| 3 | QualityClassifier | Classifies feedback and outcomes into quality signals |
| 4 | WeaknessDetector | Identifies recurring patterns that indicate weaknesses |
| 5 | RootCauseAnalyzer | Analyzes weaknesses to find underlying causes |
| 6 | LessonCreator | Generates structured lessons from analysis |
| 7 | LessonStore | Stores and manages lessons (active/archived/superseded) |
| 8 | ImprovementPlanner | Creates improvement plans from lessons |
| 9 | ProposalGenerator | Generates actionable improvement proposals |
| 10 | EvaluationGate | Evaluates proposals against quality criteria |
| 11 | ImprovementExecutor | Applies approved improvements |
| 12 | RegressionCaseGenerator | Creates regression test cases from weaknesses |
| 13 | NextAgentPromptGenerator | Updates agent prompts with lessons learned |
| 14 | AuditLogger | Logs all improvement actions for traceability |

## Data Flow Diagram

```
                         ┌──────────────┐
                         │  Telegram     │
                         │  Dashboard    │
                         │  Implicit     │
                         └──────┬───────┘
                                │ feedback
                                ▼
┌──────────────────────────────────────────────────┐
│                 FeedbackCollector                │
└──────────────────────┬───────────────────────────┘
                       │ classified feedback
                       ▼
┌──────────────────────────────────────────────────┐
│                 QualityClassifier                │
└────┬─────────────────────────────┬───────────────┘
     │ positive/neutral            │ negative
     ▼                             ▼
  (archive)              ┌─────────────────────┐
                         │  WeaknessDetector    │
                         └──────────┬──────────┘
                                    │ weakness
                                    ▼
                         ┌─────────────────────┐
                         │ RootCauseAnalyzer    │
                         └──────────┬──────────┘
                                    │ root cause
                                    ▼
                         ┌─────────────────────┐
                         │   LessonCreator      │
                         └──────────┬──────────┘
                                    │ lesson
                                    ▼
                         ┌─────────────────────┐
                         │   LessonStore        │
                         └──────────┬──────────┘
                                    │ lesson
                                    ▼
                         ┌─────────────────────┐
                         │ ImprovementPlanner   │
                         └──────────┬──────────┘
                                    │ plan
                                    ▼
                         ┌─────────────────────┐
                         │ ProposalGenerator    │
                         └──────────┬──────────┘
                                    │ proposal
                                    ▼
                         ┌─────────────────────┐
                         │   EvaluationGate     │
                         └──────────┬──────────┘
                                    │ approved?
                                    ▼
                         ┌─────────────────────┐
                         │ ImprovementExecutor  │
                         └─────────────────────┘
```

## Integration Points

| Integration | Description |
|-------------|-------------|
| Telegram | Receive user feedback via `/feedback`, `/report` commands |
| Dashboard | Improvement tab for monitoring and manual trigger |
| Operating Loop | Lessons influence agent routing and behavior |
| Knowledge Graph | Lessons stored as nodes with relationships |
| Evaluation Harness | Proposals verified against evaluation suite |
| Observability | Metrics on improvement effectiveness |
| Deploy | Approved improvements trigger re-deploy |
| GitHub Ops | Proposals create PRs (not direct pushes) |
| Cost | Improvement proposals include token cost impact |
| Dev Governance | Proposals reviewed against governance rules |

## Security Constraints

- All feedback is **redacted** of secrets/PII before storage
- The engine **never stores** API keys or tokens
- No direct code mutation — all changes go through proposals
- No direct GitHub push — proposals create PRs for review
- All improvement actions are **audit logged**
- Approvals require **evaluation gate pass** + optional human sign-off
- Lessons are **read-only** after creation (archived, never deleted)
- Proposals are **immutable** once approved

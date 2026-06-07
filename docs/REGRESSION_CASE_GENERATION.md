# Regression Case Generation

## How Regression Cases are Generated

### From Weaknesses
When a weakness is detected and confirmed by root cause analysis, the `RegressionCaseGenerator` creates a test case:
1. Extract the input/query that caused the failure
2. Record the expected correct behavior
3. Define pass/fail criteria
4. Store as a regression case linked to the lesson

### From Incidents
Production incidents (errors, downtime, misroutes) automatically generate regression cases:
1. Incident captured by observability
2. Incident analyzed for root cause
3. Regression case created to prevent recurrence
4. Linked to incident report

### From Feedback
Explicit negative feedback can generate regression cases:
1. User reports issue
2. Issue classified as weakness
3. If severity ≥ medium → regression case created
4. Test manually run to verify fix

## Regression Case Model

```json
{
  "id": "regression-<uuid>",
  "title": "Descriptive title",
  "description": "Steps to reproduce",
  "input": "The input/query that triggered the issue",
  "expectedOutput": "What should happen",
  "actualOutput": "What actually happened (historical)",
  "criteria": "Pass/fail conditions",
  "riskLevel": "low|medium|high|critical",
  "source": "weakness|incident|feedback",
  "sourceId": "<source-uuid>",
  "lessonId": "lesson-<uuid> | null",
  "status": "active|resolved|obsolete",
  "lastRun": null,
  "lastResult": null,
  "createdAt": "<timestamp>"
}
```

## When to Generate

| Trigger | Auto-generate? | Condition |
|---------|---------------|-----------|
| Weakness detected | Yes | Severity ≥ medium |
| Incident captured | Yes | All incidents |
| Negative feedback | Yes | Frequency ≥ 3 or severity ≥ high |
| Lesson created | Yes | If lesson has concrete input/output |
| Manual | No | Admin triggered via Dashboard |

## Why We Do NOT Auto-Create Test Files from Runtime

Regression cases are stored as database records, NOT as automated test files:

- **Runtime variability** — agent responses are non-deterministic; exact-match assertions would be flaky
- **Maintenance burden** — auto-generated test files would need constant updates as behavior evolves
- **False failures** — LLM output drift would cause false positives in CI
- **Human judgment needed** — evaluating LLM response quality requires semantic evaluation, not exact matching

Instead, regression cases are:
1. Stored as structured data
2. Used as manual test checklists
3. Reviewed periodically by operators
4. Converted to automated tests only when deterministic behavior exists

## Manual Test Steps

For each regression case, the tester:
1. Reads the case input
2. Submits the input to the system
3. Observes the actual behavior
4. Compares against expected output
5. Records pass/fail with notes
6. If fail → flags for improvement review

## Risk Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| Critical | System crash, data loss, security breach | Immediate fix, block deploy |
| High | Major feature broken, wrong agent, wrong answer | Fix before next deploy |
| Medium | Minor issue, incorrect but not harmful | Fix within 1 week |
| Low | Cosmetic, nice-to-have improvement | Fix when convenient |

## Examples

### Routing regression case
```json
{
  "id": "regression-r1",
  "title": "Router sends 'buat aplikasi' to wrong agent",
  "input": "buat aplikasi",
  "expectedOutput": "Router selects Coding Agent",
  "actualOutput": "Router selected Researcher Agent",
  "criteria": "Router selects Coding Agent for 'buat' intent",
  "riskLevel": "high",
  "source": "feedback"
}
```

### Cost regression case
```json
{
  "id": "regression-c1",
  "title": "Explorer agent exceeds token budget on ls",
  "input": "list files in /tmp",
  "expectedOutput": "Response under 2000 tokens",
  "actualOutput": "Response used 45K tokens",
  "criteria": "Explorer agent response ≤ 2000 tokens for simple listing",
  "riskLevel": "medium",
  "source": "weakness"
}
```

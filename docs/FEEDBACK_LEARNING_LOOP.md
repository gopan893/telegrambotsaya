# Feedback Learning Loop

## How Feedback is Collected

### Telegram
- `/feedback <message>` — explicit user feedback
- `/report <issue>` — structured issue reports
- Natural chat sentiment analysis — implicit signal extraction
- Reaction emoji tracking (thumbs up/down)

### Dashboard
- Improvement tab feedback form
- Outcome rating after each action
- Session satisfaction survey

### Implicit
- Agent retry counts — frequent retries signal confusion
- Token overuse — excessive cost per task flags inefficiency
- Route corrections — user manually re-routing indicates wrong agent selection
- Abandoned sessions — user quits mid-flow

## How Outcomes are Captured

Every agent action records an outcome:
- **Action ID** — unique identifier
- **Agent** — which agent executed
- **Intent** — what was requested
- **Result** — success / partial / failure
- **Tokens used** — cost tracking
- **Duration** — execution time
- **User rating** — optional explicit rating

## How Quality Signals are Classified

The `QualityClassifier` categorizes each feedback/outcome:

| Signal | Criteria |
|--------|----------|
| Good | Explicit positive, success outcome, low cost |
| Bad | Explicit negative, failure outcome, high cost |
| Neutral | No clear signal, partial success |

Classification uses keyword matching + sentiment analysis + cost thresholds.

## How Weaknesses are Detected

The `WeaknessDetector` scans classified signals for recurring patterns:

- **Frequency threshold** — same issue occurs N+ times
- **Temporal clustering** — multiple related signals in time window
- **Cross-user correlation** — same issue reported by different users
- **Cost outlier** — token usage > 3σ above mean

Detected weaknesses are stored with:
- Pattern signature (normalized description hash)
- Occurrence count
- First/last seen timestamps
- Linked feedback IDs

## How Patterns are Analyzed

`RootCauseAnalyzer` processes each weakness:

1. Group by pattern signature
2. Inspect linked feedback/outcomes
3. Identify common factors (agent, time, input type, model)
4. Generate root cause hypothesis
5. Assign confidence score

## How Lessons are Created and Stored

`LessonCreator` produces a structured lesson:

```
{
  "id": "lesson-<uuid>",
  "title": "Short description",
  "category": "routing|prompt|evaluation|deploy|cost|general",
  "rootCause": "Analysis summary",
  "recommendation": "What to do differently",
  "severity": "low|medium|high|critical",
  "status": "active|archived|superseded",
  "source": "feedback|outcome|weakness",
  "sourceIds": ["feedback-<id>", ...],
  "createdAt": "<timestamp>",
  "appliedAt": null
}
```

Lessons are stored in `LessonStore` (PostgreSQL).

## How Improvement Plans are Generated

`ImprovementPlanner` groups active lessons into plans:

1. Cluster related lessons
2. Prioritize by severity × frequency
3. Define improvement actions (prompt update, config change, code change)
4. Estimate token cost impact
5. Create plan with acceptance criteria

## How Next-Agent Prompts are Created

`NextAgentPromptGenerator`:
1. Selects lessons relevant to each agent
2. Formats lessons as "lessons learned" section
3. Injects into agent system prompt on next cycle
4. Logs prompt version for traceability

## Full Loop Cycle

```
1. User interacts with AI OS
2. Outcome recorded (success/failure/cost)
3. Optional explicit feedback collected
4. QualityClassifier categorizes signal
5. If negative → WeaknessDetector checks pattern
6. If pattern exists → RootCauseAnalyzer examines
7. LessonCreator produces lesson
8. LessonStore saves lesson
9. ImprovementPlanner reviews all active lessons
10. Improvement plan generated (if threshold met)
11. ProposalGenerator creates actionable proposals
12. EvaluationGate validates proposals
13. Human approves/rejects
14. ImprovementExecutor applies change
15. NextAgentPromptGenerator updates prompts
16. Loop resets — next interaction reflects improvement
```

## Examples

### "jawaban tadi salah"
- Signal: Bad (explicit negative)
- Weakness: Agent gave incorrect answer → pattern detected for this agent on similar queries
- Root cause: Agent lacks domain knowledge in topic X
- Lesson: "Agent needs updated knowledge on topic X"
- Plan: Add knowledge source for topic X

### "bot salah pilih agent"
- Signal: Bad
- Weakness: Router misrouted intent → pattern with specific intent phrase
- Root cause: Router classifier missing training example
- Lesson: "Add training example for intent Y to router"
- Plan: Update router classification rules

### "dashboard error lagi"
- Signal: Bad (explicit + repeated)
- Weakness: Dashboard error recurring → frequency threshold met
- Root cause: PWA cache serving stale service worker
- Lesson: "PWA cache invalidation needed on deploy"
- Plan: Add cache-busting to deploy pipeline

### "terlalu boros token"
- Signal: Bad (cost outlier)
- Weakness: Token overuse on certain prompt patterns
- Root cause: Agent not using structured output, generating verbose responses
- Lesson: "Add token budget instruction to agent prompts"
- Plan: Update agent prompt with token efficiency guidelines

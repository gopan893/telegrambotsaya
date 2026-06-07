# Lessons Learned System

## Lesson Model

```json
{
  "id": "lesson-<uuid>",
  "title": "Short description",
  "description": "Detailed explanation",
  "category": "routing|prompt|evaluation|deploy|cost|security|general",
  "rootCause": "Root cause analysis summary",
  "recommendation": "Actionable recommendation",
  "severity": "low|medium|high|critical",
  "status": "active|archived|superseded",
  "supersededBy": "lesson-<uuid> | null",
  "source": "feedback|outcome|weakness|manual",
  "sourceIds": ["<source-id>", ...],
  "frequency": 1,
  "createdAt": "<timestamp>",
  "updatedAt": "<timestamp>",
  "appliedAt": null
}
```

## Lesson Categories

| Category | Description |
|----------|-------------|
| routing | Agent selection or intent routing issues |
| prompt | Agent prompt quality or instruction clarity |
| evaluation | Evaluation harness gaps or false passes |
| deploy | Deployment pipeline or configuration issues |
| cost | Token waste or budget overruns |
| security | Safety or access control issues |
| general | Miscellaneous improvements |

## How Lessons are Created

### From Feedback
Explicit user feedback (negative) → quality classifier → weakness detector → lesson creator → lesson

### From Outcome
Failed or high-cost outcomes → weakness detector (if pattern exists) → lesson creator → lesson

### From Weakness
Recurring pattern detected across multiple signals → root cause analysis → lesson creator → lesson

### Manual
Admins can create lessons directly via Dashboard.

## Lesson Lifecycle

```
Created (active)
    │
    ├──→ Archived (manually or after N days inactive)
    │
    └──→ Superseded (replaced by better lesson)
              │
              └──→ Archived (when superseding lesson applied)
```

- **active** — lesson is in use, influences prompts and plans
- **archived** — lesson is historical, no longer active
- **superseded** — lesson replaced by a more specific/correct lesson

Archived lessons are never deleted — they remain for audit.

## Important Seeded Lessons

| Title | Category | Reason |
|-------|----------|--------|
| PWA cache must be invalidated on deploy | deploy | Prevent stale dashboard after deploy |
| Dashboard tabs must match route definitions | routing | Prevent 404 on tab navigation |
| Routes must be registered before first render | deploy | Prevent blank page on initial load |
| Evaluation must pass before deploy to production | evaluation | Prevent deploying broken features |
| Token budget must be enforced per agent | cost | Prevent cost overruns |

## Knowledge Graph Integration

Lessons are stored as Knowledge Graph nodes with relationships:

- `LESSON_CREATED_FROM` → feedback/outcome/weakness node
- `LESSON_APPLIED_TO` → agent/deploy/config node
- `LESSON_SUPERSEDES` → superseded lesson node
- `LESSON_RELATES_TO` → related lesson nodes

This enables graph traversal queries like "show all lessons for agent X" or "what lessons were created from feedback about routing".

## Searching and Listing Lessons

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/improvement/lessons` | List lessons (paginated, filterable) |
| GET | `/api/improvement/lessons/:id` | Get lesson detail |
| POST | `/api/improvement/lessons` | Create lesson (admin) |
| PATCH | `/api/improvement/lessons/:id` | Update lesson status |
| GET | `/api/improvement/lessons/search?q=` | Search lessons |

### Filters
- `?status=active` — filter by status
- `?category=routing` — filter by category
- `?severity=high` — filter by severity
- `?source=feedback` — filter by source
- `?from=2026-01-01&to=2026-06-01` — date range

## Examples

### Lesson from routing misclassification
```json
{
  "id": "lesson-a1b2c3",
  "title": "Improve router handling of 'buat' intent",
  "description": "When user says 'buat aplikasi', router sends to Researcher instead of Coding Agent",
  "category": "routing",
  "rootCause": "Router keyword matching prefers 'research' over 'build' for 'buat'",
  "recommendation": "Update router weights: 'buat' → Coding Agent (0.8), Researcher (0.2)",
  "severity": "high",
  "status": "active",
  "frequency": 5
}
```

### Lesson from cost overrun
```json
{
  "id": "lesson-d4e5f6",
  "title": "Enforce token limit on Explorer agent",
  "description": "Explorer agent used 45K tokens on a simple directory listing",
  "category": "cost",
  "rootCause": "Explorer agent lacks max_tokens parameter in system prompt",
  "recommendation": "Add max_tokens=2000 instruction to Explorer agent prompt",
  "severity": "medium",
  "status": "active",
  "frequency": 3
}
```

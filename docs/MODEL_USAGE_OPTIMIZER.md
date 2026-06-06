# Model Usage Optimizer

## Purpose

Select the most cost-effective model for each request without degrading quality where it matters.

## Selection Modes

| Mode | Behavior |
|---|---|
| economy | Always pick cheapest enabled model meeting min quality |
| balanced | Default. Balances cost and quality |
| quality | Prioritize high-quality models |
| local_first | Prefer local models when available |
| manual | Use explicit agent/model overrides |

## Selection Rules

- Simple chat / command → economy (e.g., groq/llama-3.1-8b, openai/gpt-4o-mini)
- Personal/support chat → balanced low-cost
- Coding/debug → stronger model if complexity high
- Council/deep debate → quality only if justified by complexity
- Evaluation suite → economy unless high-risk/security
- Secret/security/risk review → reliable model
- External write/deploy/rollback → reliable model + approval

## Prompt Compression

- Long prompts are compressed by truncating verbose lines >200 chars
- Safety instructions are preserved (approval boundary, secret redaction, safety rules)
- Context can be reduced by selecting only most relevant memories up to a token budget

## Workflow Cost Recommendation

- Detects expensive models in workflows
- Recommends cheaper alternatives (e.g., gpt-4o → gpt-4o-mini)
- Estimates savings

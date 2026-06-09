# Model Cost Policy

## Cost Tiers
| Tier | Examples | Relative Cost |
|------|----------|---------------|
| `low` | Local models, Groq | 1x |
| `medium` | Mistral, Gemini | 3x |
| `high` | OpenAI GPT-4 | 7x |

## Routing by Cost
- **Economy mode**: Prefers low-cost providers.
- **Quality mode**: Allows high-cost providers for complex tasks.
- **Budget check**: Warns if budget remaining is low.
- **Approval**: High-cost routes (>=7/10) require approval.

## Cost Estimation
Cost = tier_base × (0.7 + 0.3 × token_factor)
- token_factor = min(1, estimated_tokens / 4000)

## Notes
- Integrates with Phase 38 cost governance if available.
- Falls back to economy mode if budget is low.
- No autonomous paid API usage without budget guard.

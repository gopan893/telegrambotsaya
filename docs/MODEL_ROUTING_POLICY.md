# Model Routing Policy

## Route Selection
- **Local preferred**: Private tasks, Life OS data, simple chat, offline mode.
- **Cloud allowed**: Coding, research, evaluation, vision (after redaction).
- **Economy mode**: Cheap/fast models for cost-sensitive tasks.
- **Quality mode**: Expensive/powerful models for heavy tasks.

## Fallback Chain
1. Local coding model → Cloud coding model (if privacy allows)
2. Cloud budget exceeded → Local/economy summary
3. Private Life OS blocked from cloud → Local or ask user
4. Vision model unavailable → Explain limitation

## Cost Guard
- Simple tasks: cheap/local/economy.
- Heavy coding/research: quality cloud if budget permits.
- Deep council/evaluation: budget check required.
- Fallback to cheaper mode if budget warning.

## Approval Required
- High-cost routes (> cost tier 7/10) require approval.
- All external write/danger actions require Evaluation v2 + executor approval.

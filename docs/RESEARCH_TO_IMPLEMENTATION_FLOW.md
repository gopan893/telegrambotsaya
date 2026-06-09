# Research to Implementation Flow

1. **Research Request** → User asks research question.
2. **Intent Classification** → Category, sensitivity, external needs detected.
3. **Source Collection** → Sources registered from docs, knowledge, or manual.
4. **Quality Scoring** → Source trust, freshness, relevance evaluated.
5. **Note Building** → Key facts, open questions, constraints extracted.
6. **Summarization** → Evidence-grounded summary with pros/cons.
7. **Comparison** → Options compared across quality, cost, privacy, latency.
8. **Risk Review** → Research risk, external source risk assessed.
9. **Implementation Note** → Architecture impact, risk mitigation, test plan, rollout plan.
10. **Prompt Generation** → Codex/OpenCode/Hermes prompts for next agent.
11. **Proposal Bridge** → Action plan and executor proposal for write/danger actions.

## Rules
- All research is read-only.
- All write/danger actions require Evaluation v2 + executor approval.
- No secrets stored in any research artifact.

# Codex ↔ OpenCode Handoff Guide

## Handoff Protocol

### When Codex completes a task:
1. Update AGENT_HANDOFF.md with:
   - Completed items
   - Unfinished items
   - Tests run/failed/skipped
   - Remaining risks
   - Next agent task prompt

2. Run:
   - `node --check telebot.js`
   - Related scratch tests
   - Dashboard route validation

3. Generate next-agent prompt via:
   - Dashboard Dev Governance tab → Next-Agent Prompt → Codex/OpenCode
   - Telegram: `/nextcodex` or `/nextopencode`

### When OpenCode starts:
1. Read AGENTS.md for contract rules
2. Read AGENT_HANDOFF.md for current state
3. Read ARCHITECTURE_MAP.md for system overview
4. Check git status/diff
5. Validate dashboard routes
6. Continue unfinished work

### Recovery (token expired mid-task):
1. Check git diff → recovery handoff auto-generated
2. Manual audit required before continuing
3. Run collision check and dashboard route validation
4. Do NOT start new features before audit is complete

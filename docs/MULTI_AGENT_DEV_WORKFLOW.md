# Multi-Agent Development Workflow

## Workflow

1. Agent starts → reads AGENTS.md + AGENT_HANDOFF.md + ARCHITECTURE_MAP.md
2. Checks git diff/status for current state
3. Creates or updates patch plan
4. Validates integration contract
5. Runs related tests
6. Updates handoff file
7. Creates next-agent prompt
8. CI/CD validates on push

## Switching Agents

### Codex → OpenCode
1. Codex updates AGENT_HANDOFF.md with completion status
2. OpenCode reads the handoff and continues
3. Run `/handoff` to check state
4. Run `/nextopencode` to generate prompt

### Token Expiry Recovery
1. Run `/handoff` — if empty, recovery handoff auto-generated
2. Run `/archmap` to check architecture state
3. Run `/collisioncheck` to detect conflicts
4. Run `/nextcodex` or `/nextopencode` for safe continuation

## Preventing Duplicate Modules
- Always search src/ before creating new files
- Run `/collisioncheck` after creating modules
- Check ARCHITECTURE_MAP.md for existing module groups
- Integration contract validator enforces no-duplicate rules

## Dashboard Integration Contract
New tabs require:
1. Menu item in index.html (data-tab)
2. Registry entry in state.js (DASHBOARD_TABS)
3. Renderer function in ui.js
4. Backend API route (optional but recommended)
5. Test file

## CI/CD Governance Gate
On push, the dev-governance.yml workflow checks:
- AGENTS.md exists
- AGENT_HANDOFF.md exists
- ARCHITECTURE_MAP.md exists
- telebot.js syntax valid
- devgovernance tab registered
- renderDevGovernance function exists

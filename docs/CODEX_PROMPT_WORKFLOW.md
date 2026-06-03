# Codex Prompt Workflow

## Overview

The Coding Workspace generates Codex-ready prompts from code change plans. These prompts are designed to be copied and pasted into Codex, Claude Code, or similar AI coding tools.

## Prompt Types

### Default Prompt
Full-featured prompt with all sections: constraints, task, affected areas, files, steps, compatibility, tests, risk review.

### Hotfix Prompt
Streamlined prompt for bug fixes. Focuses on minimal change and rollback.

### Phase Prompt
Comprehensive prompt for new phases. Includes full project constraints and compatibility checklist.

### Compact Prompt
Short prompt for quick tasks. Minimal token usage.

## Prompt Structure

```
[PROJECT CONSTRAINTS]
- Runtime, module system, framework, etc.

[TASK]
Title and request summary

[AFFECTED AREAS]
List of affected code areas

[FILES TO MODIFY]
Specific files to change

[IMPLEMENTATION STEPS]
Numbered steps

[COMPATIBILITY CHECKLIST]
Items to verify

[TESTS]
Commands to run

[RISK REVIEW]
Agent review summary (if available)

RULES:
1. Follow constraints
2. CommonJS only
3. No frameworks
4. Preserve commands
5. Include rollback
6. Provide commit message
```

## Usage

1. User sends coding request via Telegram
2. Bot classifies and creates change plan
3. Bot generates Codex prompt
4. User copies prompt to Codex/Claude Code
5. AI coding tool implements the change
6. User tests and deploys

## Secret Handling

All prompts automatically redact:
- API keys, tokens, secrets
- DATABASE_URL, REDIS_URL
- Passwords
- Any pattern matching secret regex

## Example

User: "buat prompt phase 30"

Bot generates a phase prompt with:
- Full project constraints
- Phase description
- Affected areas
- Implementation steps
- Compatibility checklist
- Test plan
- Risk review

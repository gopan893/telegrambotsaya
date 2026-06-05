# Natural Dev Workflow Router

## Overview

The Natural Dev Workflow Router detects developer workflow intents from normal conversational prompts — no special commands required.

Instead of typing `/nextcodex` or `/handoff`, just say what you want naturally:

- "token Codex habis, lanjut OpenCode"
- "OpenCode selesai, balik ke Codex"
- "dashboard menu masuk Overview"
- "lanjut phase 35"

## Supported Intents

| Intent | Example Prompt | Mode | Agent |
|--------|---------------|------|-------|
| `codex_to_opencode_recovery` | "token Codex habis, lanjut OpenCode" | recovery | OpenCode |
| `opencode_to_codex_continue` | "OpenCode selesai, balik ke Codex" | implementation | Codex |
| `post_codex_review` | "review hasil Codex" | review | OpenCode |
| `post_opencode_review` | "cek patch OpenCode" | review | Codex |
| `p0_recovery` | "dashboard menu masuk Overview" | p0_patch | OpenCode |
| `phase_planning` | "lanjut phase 35" | planning | Hermes |
| `implementation_patch` | "perbaiki bug dashboard" | implementation | Codex |
| `audit_only` | "audit dulu jangan edit" | audit | OpenCode |

## Detection Rules

- Token exhausted → always recovery mode, never continue blindly
- P0 detected (error/rusak/overview) → block feature work, force P0 recovery
- External action (github/push/deploy) → require Evaluation v2 + executor approval
- Ambiguous prompt → default to audit/plan, not implementation

## Recommended Agent

- Implementation/fix clear bug → Codex
- Audit/recovery/integration review → OpenCode
- Roadmap/large phase planning → Hermes
- P0 dashboard/integration repair → OpenCode first, Codex second if implementation needed
- Token exhausted → next available agent with recovery mode

## Dashboard

Access in Dev Governance tab → "Natural Workflow Detector" panel:
1. Type prompt in textarea
2. Click "Detect Workflow"
3. View detected intent, confidence, mode, recommended agent
4. View allowed/blocked actions
5. Copy generated prompt or report

## Telegram

Natural chat triggers workflow detection automatically.
Commands still available but not required.

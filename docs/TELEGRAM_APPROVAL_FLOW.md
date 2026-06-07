# Telegram Approval Flow

## Overview

High-risk and dangerous actions require a multi-step approval flow before execution. No action is ever auto-approved or auto-executed. The flow separates proposal creation, evaluation, approval, and execution into distinct manual steps.

## Flow Diagram

```
User sends natural or slash command
         │
         ▼
┌──────────────────────┐
│  Risk Classification  │  telegram-risk-classifier.js
│  (medium / high /    │
│   danger)            │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Duplicate Detection  │  findDuplicateProposal()
│  (same cmd + action  │
│   + chat = skip)     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│  Create Executor Proposal     │  createTelegramExecutorProposal()
│  ┌──────────────────────────┐ │
│  │ id:        prop_xxx      │ │
│  │ command:   propose_deploy│ │
│  │ riskLevel: high          │ │
│  │ status:    pending       │ │
│  │ approved:  false         │ │
│  │ executed:  false         │ │
│  │ evaluationPassed: null   │ │
│  └──────────────────────────┘ │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────┐
│  Evaluation v2 Gate   │  (Only for high/danger)
│  - Context relevance  │
│  - Risk validation    │
│  - Duplicate check    │
│  - Action validation  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Proposal Display     │  formatProposalForTelegram()
│  ┌──────────────────┐ │
│  │ 📋 Proposal:      │ │
│  │   prop_xxx        │ │
│  │   /propose_deploy │ │
│  │   Risk: 🟠 high   │ │
│  │   Status: pending │ │
│  │                   │ │
│  │ /approve prop_xxx │ │
│  │ /reject prop_xxx  │ │
│  └──────────────────┘ │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  /approve <id>        │  Only owner
│  → status: approved   │
│  → approvedAt: set    │
│  → approved: true     │
│                      │
│  NOTE: /approve does  │
│  NOT execute action   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  /reject <id>         │  Optional
│  → status: rejected  │
└──────────────────────┘
       │
       ▼
┌──────────────────────┐
│  /runexec <id>        │  Only owner, only if approved
│  → status: executing │
│  → executed: true     │
│  → executedAt: set    │
│  → result: {...}      │
└──────────────────────┘
```

## Commands

| Command | Role | Risk | Owner Only |
|---------|------|------|------------|
| `/pending` | List all pending proposals | 📖 | No |
| `/approve <id>` | Approve a proposal | 🟠 | Yes |
| `/reject <id>` | Reject a proposal | 🟡 | Yes |
| `/runexec <id>` | Execute an approved proposal | 🔴 | Yes |
| `/cancel_exec <id>` | Cancel a pending execution | 🟡 | Yes |
| `/executions` | List recent and pending executions | 📖 | No |

## How Proposals Are Created

Proposals can originate from:

### 1. Natural Language → Proposal
```
User: "deploy ke render"
  → intent_classifier matches propose_deploy
  → risk_classifier: high
  → natural_router builds action plan
  → proposal_router creates proposal
  → "Use /approve <id> to approve"
```

### 2. Slash Command → Proposal
```
User: /propose_deploy
  → matches built-in command (riskLevel: high)
  → proposal_router creates proposal
  → "Use /approve <id> to approve"
```

### 3. Explicit Proposal Creation
```
User: /propose <action> <details>
  → creates a generic proposal
  → Available for admin users
```

## Proposal Lifecycle

Each proposal has these fields:

```js
{
  id: 'prop_abc123',
  type: 'telegram_control',
  command: 'propose_deploy',
  action: 'deploy',
  riskLevel: 'high',
  args: { raw: '...', matched: '...' },
  source: 'telegram',
  chatId: 12345,
  userId: 67890,
  status: 'pending',        // pending | approved | rejected | executing | executed | failed
  approved: false,
  executed: false,
  createdAt: '2026-06-07T...',
  updatedAt: '2026-06-07T...',
  approvedAt: null,
  executedAt: null,
  evaluationPassed: null,   // null | true | false
  result: null
}
```

### Transitions

```
pending
  ├── /approve → approved
  ├── /reject  → rejected
  └── (stale)  → (auto-expired after 24h, system cleanup)

approved
  └── /runexec → executing → executed (or failed)

rejected
  └── (terminal)
```

## Duplicate Prevention

`findDuplicateProposal()` checks for existing pending proposals with the same `command + action + chatId`. If found, the duplicate is rejected with a message: "A similar proposal is already pending. Use /approve to approve it or /reject to reject it."

## Evaluation v2 Gate

For high/danger proposals, the Evaluation v2 gate runs before the proposal is presented for approval. It validates:

1. **Context relevance** — Is this action relevant to the current context?
2. **Risk validation** — Does the action match the classified risk?
3. **Action validation** — Is this action supported and properly formed?
4. **Security check** — Does the action involve secrets or blocked patterns?

The gate result is stored in `evaluationPassed`. If it fails, the proposal is marked with an explanation and not eligible for approval.

## Execution

`/runexec` executes the approved proposal via the executor system. The execution result (success/failure, output) is stored in the proposal's `result` field. After execution, the proposal status moves to `executed`.

## Rules & Constraints

1. **No auto-approve**: `/approve` only sets `approved: true`, nothing else
2. **No auto-run**: `/runexec` requires proposal to be in `approved` state
3. **Owner only**: `/approve`, `/reject`, `/runexec`, `/cancel_exec` require owner
4. **No shell executor**: The executor system does not support arbitrary shell commands
5. **No direct execution**: Natural language cannot bypass the proposal pipeline for high/danger actions
6. **Life OS exception**: Low-risk Life OS actions (`/taskdone`, `/mood`, `/energy`, `/habitcheck`) execute immediately without proposals
7. **Dashboard parity**: The same proposal pipeline is used from the Dashboard — no bypass exists through any interface

## Example Session

```
User: /propose_deploy
Bot: 📋 Proposal: prop_a1b2c3
     Command: /propose_deploy
     Risk Level: 🟠 high
     Status: pending
     Use /approve prop_a1b2c3 to approve.
     Use /reject prop_a1b2c3 to reject.

User: /approve prop_a1b2c3
Bot: ✅ Proposal prop_a1b2c3 approved.
     Use /runexec prop_a1b2c3 to execute.

User: /runexec prop_a1b2c3
Bot: ✅ Proposal prop_a1b2c3 executed.
     Result: Deploy initiated to Render.
     Check /deploy for status.
```

# Auto-Healing System

## Overview
The auto-healing system is a sub-system of self-healing (Phase 32) that performs automated recovery actions at safe levels (L0-L2).

## Levels
- **L0**: Observe only — no action taken
- **L1**: Safe auto-run — low-risk actions run automatically
- **L2**: Proposal only — creates a proposal via the executor system
- **L3**: Blocked — cannot be executed

## Architecture
- `autoheal-registry.js`: Defines all available actions with risk levels
- `autoheal-policy.js`: Classifies actions and enforces cooldown/rate limits
- `autoheal-store.js`: Persistent storage for actions, runs, and proposals
- `autoheal-actions.js`: Handler implementations for each action
- `autoheal-runner.js`: Dispatch engine that runs actions through policy gate
- `autoheal-proposal-bridge.js`: Bridges L2 actions to executor proposals

## Key Design Decisions
- All L1 actions are read-only (stale cache markers, lock clearing, etc.)
- L2 actions require evaluation v2 gate approval
- Cooldown and rate limits are enforced per-action

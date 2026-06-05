# Dev Governance — Phase 34

## Overview

Multi-Agent Development Governance system for safe parallel/serial coding by Codex, OpenCode, and Hermes agents.

## Components

### Agent Contract Manager
- Ensures AGENTS.md exists with all required sections
- Validates contract rules (no TS, no React, no shell executor, etc.)
- Appends missing sections automatically

### Handoff Orchestrator
- Reads/writes AGENT_HANDOFF.md
- Generates recovery handoff from git diff when agent terminates unexpectedly
- Tracks files changed, tests run, remaining risks

### Architecture Map Generator
- Scans entry points, dashboard tabs, backend routes, module groups
- Writes ARCHITECTURE_MAP.md automatically

### Integration Contract Validator
- Validates new tabs have menu + registry + renderer
- Validates new routes have auth protection
- Validates module usage (exports exist)

### Collision Detector
- Detects duplicate module names across directories
- Detects duplicate API routes
- Detects tabs in registry but not in sidebar menu
- Detects unused new files
- Detects frontend API calls missing backend routes

### Dashboard Route Consistency
- Validates all known tabs exist in registry
- Validates all tabs have renderers
- Validates service worker cache rules
- Reports tab misconfigurations

### Backend/Frontend Linker
- Scans frontend API calls
- Scans backend routes
- Matches calls to routes
- Reports missing/unused routes

### Test Matrix Generator
- Generates test matrix based on changed file areas
- Provides required test lists per area
- Summarizes test results

### Next-Agent Prompt Generator
- Generates prompts for Codex, OpenCode, Recovery, P0, Review
- Prompts include current state, constraints, and expected output

## Telegram Commands
- `/devgov` — governance status summary
- `/handoff` — view current handoff
- `/handoff_update` — update handoff task/goal
- `/archmap` — architecture map status
- `/contractcheck` — validate agent contract
- `/collisioncheck` — detect collisions
- `/dashboardroutes` — check dashboard route consistency
- `/nextcodex` — generate next Codex prompt
- `/nextopencode` — generate next OpenCode prompt
- `/p0prompt` — generate P0 patch prompt

## Dashboard Tab
Access: Dev Governance tab in sidebar.
Features: contract status, handoff viewer, architecture scan, collision check, route check, linker check, test matrix, prompt generator.

## Quality Gates
- devGovernanceScore >= 90
- integrationContractScore >= 90
- No duplicate critical modules
- No known tab fallback to Overview
- No executor bypass
- No secret leakage

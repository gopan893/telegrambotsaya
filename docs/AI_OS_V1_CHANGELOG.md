# AI OS v1.0.0-rc.1 Changelog

## Stable AI OS v1.0.0-rc.1

This is the first Release Candidate for Stable AI OS v1. It includes all features from Phase 1 through Phase 50 with production readiness gates.

### Phases

**Phase 1-18:** Foundation, core bot, basic memory, dashboard, agents, executor
**Phase 19:** Backup & Recovery, PWA support, export/import
**Phase 20-28:** Multi-bot, agent council, debate, delegation, decision system
**Phase 29-32:** Coding Workspace, regression testing, research agent
**Phase 33-35:** Self-healing, monitoring, CI/CD, Dev Governance
**Phase 36:** Deploy/Release Manager, Render deploy gate, rollback
**Phase 37:** Production Observability, Incident Response Center
**Phase 38:** Cost/Token/Budget Governance
**Phase 39-40:** Operator Agent, Semi-Autonomous Project Operator
**Phase 41:** Multi-Project Portfolio Manager
**Phase 42:** Knowledge Graph, Decision Memory
**Phase 43:** Research/Docs Agent
**Phase 44:** Personal Life OS
**Phase 44.5:** Universal Telegram Control Layer
**Phase 45:** Stable Autonomous Operating Loop
**Phase 46:** Continuous Improvement & Learning Engine
**Phase 47:** Unified Governance Policy Engine & Capability Control Center
**Phase 48:** Security Hardening & Red-Team Safety Audit
**Phase 49:** Privacy, Data Retention & Export Control
**Phase 50:** Stable AI OS v1 Release Candidate — freeze, readiness gates, release docs

### Key Safety Features

- All write/external/danger actions require Evaluation v2 + executor approval
- No auto-approve, no auto-run, no shell executor
- Secrets redacted in all outputs
- Hard delete blocked by default
- Bot-to-bot loop prevention
- Dashboard known tabs never fallback to Overview
- Service worker never caches /api/dashboard/*

# Natural Agent Router (Phase T3)

## Goal
Router yang memahami maksud user secara natural dan routing ke domain/agent yang tepat.

## Domain
- normal_chat, coding, project, ops, deploy, security, privacy, memory, rag, workflow, device, approval, research, cost, model_strategy, troubleshooting, dashboard

## Flow
1. Text → Intent Classifier → domain + confidence
2. Risk Detector → dangerous action check
3. Privacy Filter → block private data in wrong context
4. Agent Selector → pilih agent sesuai domain
5. Domain Router → route ke handler yang tepat
6. Context Builder → build context pack sesuai domain

## Safety
- Dangerous action (deploy, rollback, push, restart, auto-approve) → proposal only
- Secret/token → auto redacted
- Private data in group → blocked
- Auto-approve → blocked

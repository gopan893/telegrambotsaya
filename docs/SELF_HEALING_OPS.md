# Self-Healing Ops System

## Overview
Self-Healing Ops adalah sistem monitoring dan regression guard untuk Telegram AI OS Dashboard. Sistem ini mendeteksi regresi pada dashboard routing, natural chat, executor safety, integration gates, dan coding workspace, lalu menghasilkan repair plan dan prompt perbaikan secara aman (read-only).

## What It Does
- Menjalankan health check suite terhadap 11 kategori guard
- Mendeteksi dashboard tab yang rusak/tidak terdaftar
- Mendeteksi routing leakage pada natural chat
- Mendeteksi executor approval bypass
- Mendeteksi integration Evaluation v2 gate bypass
- Mendeteksi personal advice masuk ke coding workspace
- Membuat repair plan dari guard failure
- Membuat Codex/Hermes repair prompt
- Membuat executor proposal (tidak auto-run)

## What It Does NOT Do
- Tidak auto-repair
- Tidak auto-execute
- Tidak shell/SSH executor
- Tidak direct git/GitHub write
- Tidak bypass approval
- Tidak expose secrets

## Guard Categories
- boot – modul startup
- dashboard – tab registry, renderer, CSS, SW
- natural_chat – routing classifier
- multibot – multi-bot reply safety
- executor – approval flow safety
- integration – Evaluation v2 gate
- coding_workspace – personal/school advice filter
- evaluation – Evaluation Harness availability
- storage – Redis connection
- security – secret exposure
- pwa – PWA assets

## Guard Model
```
{ id, name, category, severity, enabled, checkType, expectedState, failureMessage, suggestedRepair }
```

## Repair Plan Flow
1. Guard failure detected → health check suite
2. Repair plan created (draft)
3. Codex/Hermes prompt generated (prompt_ready)
4. Executor proposal dibuat dengan Evaluation v2 gate (proposal_ready)
5. Menunggu approval → executed atau rejected

## Dashboard Tab
Dashboard tersedia di tab "Self-Healing" atau via URL `#selfhealing`.

## Telegram Commands
- `/selfheal` – Jalankan self-healing check
- `/healthcheck` – Status health check
- `/dashboardcheck` – Dashboard route guard check
- `/repairplans` – Daftar repair plan
- `/repairplan <id>` – Detail repair plan
- `/repairprompt <id>` – Generate repair prompt
- `/propose_repair <id>` – Buat executor proposal

## Security
- Read-only checks
- No secrets in output
- Sanitized responses
- Rate-limited guard runs
- Evaluation v2 gate before external proposals

## Phase 33 Recommendation
- Add auto-healing with human approval loop
- Dashboard real-time health monitoring with WebSocket
- CI/CD integration for regression guard in GitHub Actions
- Automated test generation for new guards

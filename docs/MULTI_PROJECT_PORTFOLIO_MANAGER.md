# Multi-Project Portfolio Manager

Phase 41 menambahkan lapisan portfolio agar Telegram AI OS bisa melihat banyak goal/project aktif sebagai satu sistem prioritas, bukan daftar task terpisah.

## Tujuan

- Scan goal, planner task, executor proposal, incident, deploy status, GitHubOps status, dan cost signal.
- Hitung health project dan prioritas lintas project.
- Deteksi project stale, blocked, atau terlalu lama tanpa progress.
- Rekomendasikan project dan next action yang paling aman dilanjutkan.
- Buat action plan/executor proposal hanya jika action perlu approval.

## Modul

- `src/portfolio/portfolio-scanner.js`: membangun snapshot active goals, tasks, approvals, incidents, deploy, GitHubOps, dan cost.
- `src/portfolio/project-health-scorer.js`: memberi score 0-100 dan status `healthy`, `warning`, `blocked`, atau `critical`.
- `src/portfolio/project-priority-engine.js`: ranking project dengan mode `balanced`, `speed`, `stability`, `cost_saving`, `quality`, dan `manual`.
- `src/portfolio/project-dependency-detector.js`: mendeteksi dependency aman seperti test gate, secret scan, deploy gate, dan approval.
- `src/portfolio/project-staleness-detector.js`: mendeteksi stale task/project.
- `src/portfolio/portfolio-strategy-planner.js`: membuat weekly/monthly/stabilization/cost/quality plan read-only.
- `src/portfolio/portfolio-proposal-bridge.js`: membuat action plan lalu executor proposal, tanpa menjalankan aksi.

## Telegram Commands

- `/portfolio`
- `/projects`
- `/projecthealth [goalId]`
- `/nextproject`
- `/portfolio_next`
- `/weeklyplan`
- `/monthlyplan`
- `/staleprojects`
- `/projectrisks`
- `/portfolioreport`
- `/portfolio_proposal`

## Natural Chat

Contoh yang diarahkan ke Portfolio Manager:

- `project mana yang harus saya lanjutkan?`
- `apa prioritas minggu ini?`
- `mana yang paling berisiko?`
- `kenapa project ini macet?`
- `Codex atau OpenCode untuk project ini?`
- `push dan deploy project paling penting`

Request push/deploy/write/external tidak dijalankan langsung. Bot hanya membuat proposal setelah Evaluation v2 gate, lalu user tetap harus `/approve` dan `/runexec`.

## Compatibility

Jika Project Operator Phase 40 atau Cost Guard Phase 38 belum tersedia, Portfolio tetap berjalan dengan fallback aman. Cost signal memakai `opsSystem.costOptimizer` jika tersedia.

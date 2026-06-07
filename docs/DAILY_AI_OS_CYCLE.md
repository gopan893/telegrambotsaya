# Daily AI OS Cycle

## Flow

1. **Trigger** — Scheduled or manual via `/runloop daily_ai_os_briefing` or dashboard
2. **Collect State** — `system-state-collector` gathers data from all subsystems (health, cost, incidents, pending approvals, etc.)
3. **Build Snapshot** — `operating-snapshot-builder` creates a health snapshot with module summaries
4. **Detect Blockers** — `blocker-detector` scans for safety, deploy, cost, executor, integration, and stale-task blockers
5. **Synthesize Actions** — `next-action-synthesizer` recommends prioritized next actions
6. **Generate Report** — `operating-loop-report-generator` produces a daily AI OS report with summary, blockers, pending approvals, and cost status
7. **Store Run** — Run result is persisted with snapshot, blockers, and actions
8. **Notify** — Rate-limited notification to configured channels (if enabled)

## Weekly Cycle

Same flow but produces a weekly report with broader scope (portfolio, strategy, knowledge health).

## Safety Checks

- All write/external/danger actions discovered during the cycle are **never executed automatically**
- Any proposed action from the cycle goes through: dry-run → Evaluation v2 → executor proposal → approval → run
- Secrets are redacted before storage or display
- Notifications are rate-limited to prevent spam

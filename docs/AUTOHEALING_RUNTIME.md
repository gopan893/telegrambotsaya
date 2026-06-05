# Safe Auto-Healing Runtime

Phase 33 menambahkan runtime auto-healing yang hanya boleh menjalankan aksi aman.

## Level

- `L0`: observe only.
- `L1`: safe auto-heal, rate-limited, non-destructive.
- `L2`: proposal required melalui Evaluation v2 dan executor approval.
- `L3`: blocked.

## Aksi L1

- Mark dashboard cache stale.
- Clear expired routine locks.
- Disconnect stale monitoring clients.
- Degrade connector to read-only.
- Suppress bot loop temporarily.
- Rerun read-only health check.
- Set PWA cache warning.

## Batasan

Runtime ini tidak menjalankan shell, tidak mengubah source code, tidak push GitHub, tidak deploy, dan tidak bisa approve/run executor.

## Telegram

- `/autoheal`
- `/autoheal_runs`
- `/autoheal_run <actionId>`

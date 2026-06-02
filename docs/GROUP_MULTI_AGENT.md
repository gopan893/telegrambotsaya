# Group Multi-Agent Usage

Multi-agent mode dirancang untuk grup Telegram tanpa membuat semua bot bicara bersamaan.

## Mode Grup

| Mode | Perilaku |
| --- | --- |
| `natural_smart` | Default smart routing. Agent relevan dipilih otomatis. |
| `quiet` | Hanya Orchestrator menjawab. |
| `manual` | Gunakan command/mention untuk override. |
| `council` | Council ringan untuk diskusi terarah. |

Command:

```text
/quiet
/smart
/router
/council <topic>
/debate <topic>
/proscons <topic>
/allagents <topic>
/askagents <topic>
/riskreview <topic>
/councilstatus
/councilrecent
```

`/allagents` admin/owner only agar grup tidak spam.

Council internal otomatis bisa aktif pada topik planning/decision/risk, tetapi normal chat tetap satu jawaban final. Gunakan command eksplisit jika ingin melihat opini agent satu per satu.

## Dashboard

Tab `Agents / Multi-Bot` menampilkan:

- bot status cards
- token configured true/false
- webhook secret configured true/false
- agent roles
- router test panel
- selected/internal/muted agents
- group mode settings
- recent routing activity

Dashboard tidak menampilkan token atau webhook secret asli.

## Keamanan

- Agent router tidak menjalankan aksi.
- Executor hanya membuat proposal jika ada write/external/danger intent.
- Approval dan run tetap dua langkah.
- Restore/import tetap wajib confirmation/approval.
- Unknown group sebaiknya gunakan quiet/manual jika belum dipercaya.

## Phase 19 Compatibility

Agents tab ditambahkan sebagai tab baru. PWA, Backup & Recovery, import preview, export/download, dan approved backup scheduler tetap terpisah dan tidak diganti.

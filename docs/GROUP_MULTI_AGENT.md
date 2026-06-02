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
/multibot
/multibot_on
/multibot_off
/visibleagents
/botmapping
```

`/allagents` admin/owner only agar grup tidak spam.

Council internal otomatis bisa aktif pada topik planning/decision/risk, tetapi normal chat tetap satu jawaban final. Gunakan command eksplisit jika ingin melihat opini agent satu per satu.

Phase 23 menambahkan delegation. Untuk request seperti `bagi tugas phase berikutnya` atau `bot error deploy, pecah tugasnya`, Orchestrator bisa membuat task internal untuk Planner/Coder/Ops/Critic/Security lalu menyatukan hasilnya. Task ini tetap reasoning-only dan tidak menjalankan aksi eksternal.

Phase 24 menambahkan decision system. Untuk request seperti `lebih baik PostgreSQL atau Redis?` atau `lanjut phase berapa?`, bot dapat membuat pros/cons, tradeoff, risk score, confidence, dan recommendation tanpa memicu semua bot bicara.

## Visible Specialist Bots

Jika bot Planner/Coder/Critic dan agent lain sudah ditambahkan ke grup, gunakan `/multibot_on` agar specialist yang dipilih router bisa bicara memakai token bot masing-masing. Ini tidak membuat semua bot menjawab semua pesan.

Default policy:

- Orchestrator selalu boleh memberi jawaban final.
- Specialist visible hanya jika dipilih router dan `multiBotVisibleReplies=true`.
- Maksimal 2 specialist bot terlihat pada natural chat.
- `/multibot_off` mengembalikan grup ke Orchestrator-only.
- `/botmapping` menampilkan agent -> bot configured true/false tanpa token.

## Dashboard

Tab `Agents / Multi-Bot` menampilkan:

- bot status cards
- token configured true/false
- webhook secret configured true/false
- agent roles
- router test panel
- selected/internal/muted agents
- group mode settings
- visible reply settings
- safe agent-to-bot mapping
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

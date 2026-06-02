# Natural Smart Agent Router

Phase 20 membuat routing agent bekerja dari chat biasa, bukan hanya slash command.

## Flow

```text
Telegram message
-> topic classifier
-> risk detector
-> agent scoring
-> response policy
-> conversation bus
-> selected agents respond
```

Agent tidak relevan diam secara default.

## Agent Default

- `orchestrator`: moderator utama dan summary.
- `planner`: roadmap, task, prioritas.
- `coder`: coding/debugging/arsitektur.
- `critic`: risiko, blind spot, trade-off.
- `research`: pencarian, opsi API, pembelajaran.
- `ops`: deploy, health, PostgreSQL, Redis, Render.
- `security`: token, permission, restore/import, danger action.
- `memory`: konteks memory/graph.
- `executor`: proposal eksekusi, bukan auto-run.
- `reflection`: dukungan refleksi personal.

## Natural Chat

Contoh routing:

| Chat | Agent |
| --- | --- |
| `Saya bingung lanjut phase berapa` | Orchestrator, Planner, Critic |
| `Bot saya error setelah deploy` | Orchestrator, Ops, Coder |
| `Saya ingin restore backup lama` | Orchestrator, Security, Executor, Ops |
| `Saya capek hari ini` | Orchestrator, Reflection |
| `Cari API vision gratis` | Orchestrator, Research, Coder |
| `Saya ingin menjalankan backup sekarang` | Orchestrator, Executor, Security, Ops |

## Council Integration

Phase 22 menambahkan internal council untuk pesan yang butuh keputusan multi-agent, misalnya `saya bingung lanjut phase berapa`, `nilai rencana saya`, `restore backup production`, atau `pilih PostgreSQL atau Redis`.

Normal chat tetap hanya mengirim final synthesis yang bersih. Diagnostics seperti `Mode`, raw selected agents, dan policy object hanya boleh muncul di `/router`, dashboard router test, atau command council eksplisit.

## Risk Policy

Write/external/danger action tidak pernah dijalankan langsung. Router hanya mengarahkan ke proposal/approval flow Phase 16.

High risk trigger:

- token/API key/env
- restore/import/overwrite
- delete/drop
- webhook/token setup
- permission/admin changes
- external API action

Jika secret-like text terdeteksi, output dan audit summary disanitasi.

## Anti-Spam

- Default natural chat maksimal 3 visible agents.
- Backup/restore/action mode boleh menampilkan Security/Ops tambahan.
- Agent lain masuk `internalOnlyAgents`.
- Bot message diabaikan agar tidak terjadi loop.
- Fingerprint pesan terbaru mencegah reply duplicate.

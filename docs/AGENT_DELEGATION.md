# Agent Delegation

Phase 23 menambahkan Multi-Agent Task Delegation. Orchestrator dapat memecah request kompleks menjadi task internal untuk Planner, Coder, Critic, Ops, Security, Memory, Research, Executor, atau Reflection.

## Kapan Aktif

Delegation aktif untuk request kompleks seperti:

- `buat prompt phase 24 external integration`
- `bot error setelah deploy di Render`
- `bagi tugas untuk membuat dashboard agent`
- `saya ingin restore backup lama`

Delegation tidak aktif untuk sapaan, pertanyaan sederhana, dan dukungan emosional sederhana.

## Batasan Safety

- Delegation bukan executor.
- Tidak ada shell, browser automation, write action, restore, import, atau external API run langsung.
- Action berisiko hanya menjadi rekomendasi executor proposal.
- Output task disanitasi dan tidak menampilkan secret, raw debug, atau hidden reasoning.

## Flow

```text
Natural chat / /delegate
-> delegation detector
-> delegation session
-> 2-5 agent tasks
-> internal task runner
-> conflict detector
-> Orchestrator final synthesis
```

## Dashboard

Tab `Agents / Multi-Bot` memiliki panel `Agent Task Delegation` untuk create/run delegation, router test, list delegation, dan list task.

## Telegram

```text
/delegate <topic>
/delegations
/delegation <delegationId>
/rundelegation <delegationId>
/agenttasks
/agenttask <taskId>
/runtask <taskId>
/handoffs
/handoff <taskId> | <targetAgentId>
/taskresult <taskId>
```

## Data Yang Disimpan

Delegation memakai storage aktif melalui storage-manager dengan key:

- `agent_delegations`
- `agent_tasks`
- `agent_task_results`
- `agent_handoffs`
- `agent_delegation_summaries`

Data disimpan per workspace/user. Item lama tidak hard delete; task dan session di-archive agar audit trail tetap aman.

## Agent Yang Umum Dipilih

| Jenis task | Agent utama |
| --- | --- |
| planning, roadmap, scope | Planner |
| coding review, bug, implementasi | Coder |
| risk review, restore, import, secret | Security dan Critic |
| deploy, Render, PostgreSQL, Redis, health | Ops |
| memory/context/graph | Memory |
| action proposal | Executor |

Jika agent target tidak cocok atau nonaktif, task fallback ke Orchestrator.

## Natural Chat

Natural delegation hanya aktif untuk request yang jelas kompleks, misalnya `bagi tugas`, `pecah task`, `buat prompt phase`, atau request yang menyentuh beberapa domain sekaligus. Sapaan, hitungan, dan chat emosional ringan tetap dijawab normal.

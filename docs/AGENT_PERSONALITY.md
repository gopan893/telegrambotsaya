# Agent Personality

Phase 21 menambahkan profile personality per agent agar multi-agent team tidak terasa generik dan tetap aman.

## Profile Model

Setiap agent punya:

- `responseStyle`: tone, verbosity, struktur jawaban, dan batas jumlah poin.
- `preferences`: preferensi runtime yang aman.
- `memoryPolicy`: apakah agent memory/shared memory aktif, top-k limit, dan tipe memory yang boleh dipakai.
- `knowledgeScope`: area pengetahuan yang relevan.
- `safetyRules`: guard tetap seperti larangan expose token dan larangan eksekusi tanpa approval.
- `toneRules` dan `outputFormatRules`: gaya bahasa dan format jawaban.

Default profile tersedia untuk:

- orchestrator
- planner
- coder
- critic
- research
- ops
- security
- memory
- executor
- reflection

## Override

Dashboard endpoint:

- `GET /api/dashboard/agents/profiles`
- `GET /api/dashboard/agents/:agentId/profile`
- `POST /api/dashboard/agents/:agentId/profile/update`

Override disimpan di `agent_profile_overrides` dan tetap disanitasi. Field yang mencoba membawa token, secret, credential, atau bypass approval akan ditolak atau dimasking.

## Telegram

- `/agentprofile <agentId>`
- `/agentprefs <agentId>`
- `/agentstyle <agentId>`

## Safety

Agent boleh bertindak sebagai persona/role, tetapi tidak boleh mengaku memiliki kesadaran manusia. Executor Agent hanya boleh membuat proposal, bukan menjalankan action berbahaya tanpa approval.

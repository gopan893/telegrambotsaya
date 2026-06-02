# Agent Memory

Phase 21 menambahkan memory khusus agent dan shared memory antar agent.

## Storage Keys

- `agent_memories`
- `agent_shared_memories`
- `agent_learning_notes`
- `agent_profile_overrides`

Storage mengikuti storage-manager aktif. Jika PostgreSQL aktif, data melewati driver aktif; jika gagal, fallback JSON/memory tetap aman.

## Memory Model

```json
{
  "id": "agent_mem_x",
  "agentId": "coder",
  "workspaceId": "default",
  "userId": "123",
  "type": "technical_pattern",
  "title": "Render CommonJS",
  "content": "Project memakai Node.js 20 CommonJS.",
  "tags": ["render", "commonjs"],
  "source": "manual",
  "confidence": 0.7,
  "importance": 0.6,
  "relevanceScore": 0,
  "createdBy": "123",
  "createdAt": "...",
  "updatedAt": "...",
  "archivedAt": null,
  "lastUsedAt": null,
  "usageCount": 0
}
```

## Relevance Guard

Memory dipakai hanya jika:

- workspace cocok
- user scope cocok atau memory adalah shared
- tidak archived
- tidak mengandung token/secret/credential
- relevan dengan topic dan agent

Limit prompt:

- max 5 memory per agent
- max 3 shared memory

Contoh guard:

- Coder memory tidak dipakai untuk chat emosional kecuali relevan.
- Security memory diprioritaskan untuk secret/risk/restore/import.
- Executor memory diprioritaskan untuk action/proposal/approval.

## Telegram

- `/agentmemory <agentId>`
- `/agentremember <agentId> | <text>`
- `/agentforget <agentId> | <memoryId>`
- `/sharedmemory`
- `/agentlearn <agentId> | <note>`

## Dashboard

Agents tab memiliki panel Agent Personality & Memory untuk:

- load profile
- load memory
- save agent memory
- save learning note
- lihat shared memory
- test router dengan memory context

## Security

Konten yang terlihat seperti `token`, `api_key`, `Authorization`, `DATABASE_URL`, `REDIS_URL`, `postgresql://`, `rediss://`, `sk-`, `gsk_`, `tvly_`, atau `ghp_` tidak disimpan.

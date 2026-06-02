# Agent Tasks

Phase 23 menambahkan task internal untuk multi-agent. Task ini dipakai agar Orchestrator bisa membagi pekerjaan besar menjadi langkah kecil tanpa menjalankan aksi eksternal otomatis.

## Model Ringkas

```json
{
  "id": "agent_task_xxx",
  "delegationId": "delegation_xxx",
  "workspaceId": "default",
  "userId": "telegram-user",
  "agentId": "planner",
  "type": "planning",
  "title": "Susun roadmap",
  "status": "queued",
  "riskLevel": "low",
  "requiresApproval": false
}
```

Status task:

- `queued`
- `claimed`
- `running`
- `completed`
- `failed`
- `blocked`
- `archived`

## Cara Kerja

1. `/delegate` atau natural chat kompleks membuat delegation session.
2. Delegation engine membuat 2-5 task internal.
3. Assignment memilih agent paling relevan.
4. Runner menjalankan reasoning task yang aman.
5. Aggregator menyatukan hasil menjadi jawaban final.

## Guard

- Task tidak menjalankan shell, browser automation, restore, import, atau external API.
- Write/external/danger hanya menghasilkan rekomendasi proposal executor.
- Payload secret-like ditolak.
- Output disanitasi dari token, connection string, raw debug, dan catatan file lama yang tidak relevan.

## Telegram

```text
/agenttasks
/agenttask <taskId>
/runtask <taskId>
/taskresult <taskId>
```

`/runtask` hanya menjalankan reasoning task aman, bukan executor aksi eksternal.

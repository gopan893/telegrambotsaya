# Tool Registry

Phase 17 menambahkan registry untuk tool/action bot. Tujuannya bukan plugin marketplace, tetapi satu tempat aman untuk mendaftarkan tool internal, melihat metadata, menjalankan tool read-only yang aman, dan membuat proposal human-approved untuk tool write/external/danger.

## Prinsip

- Hanya tool `builtin` dan `internal` yang dipercaya pada Phase 17.
- Tidak ada dynamic require dari path tidak tepercaya.
- Tidak ada shell executor, arbitrary JavaScript executor, atau dynamic npm install.
- Registry tidak menjalankan tool saat registrasi.
- Metadata disimpan lewat storage manager aktif, sementara handler tetap di memori proses.
- Tool write/external/danger harus lewat proposal executor Phase 16.

## Storage

Registry memakai key:

```text
tool_registry
tool_runs
tool_audit
```

Jika PostgreSQL aktif, storage manager menyimpan key tersebut ke PostgreSQL. Jika tidak, JSON fallback tetap dipakai.

## Metadata

Setiap tool punya metadata ringkas:

```json
{
  "id": "weather.lookup",
  "name": "Weather Lookup",
  "description": "Lookup current weather for a city.",
  "category": "weather",
  "version": "1.0.0",
  "enabled": true,
  "source": "builtin",
  "actionType": "weather.lookup",
  "riskLevel": "low",
  "permissionsRequired": ["read"],
  "requiresApproval": false,
  "workspaceAware": true,
  "inputSchema": {},
  "outputSchema": {},
  "rateLimit": { "windowMs": 60000, "max": 20 },
  "timeoutMs": 5000
}
```

Secret-like metadata ditolak atau disanitasi.

## Built-In Tools

Tool yang didaftarkan secara aman jika underlying module tersedia:

- `weather.lookup`
- `search.web`
- `ops.diagnostics.run`
- `ops.benchmark.light`
- `report.health.export`
- `report.user_summary.export`
- `planner.task.mark_done`
- `planner.task.mark_blocked`
- `workflow.step.add`
- `workflow.step.done`
- `goal.progress.update`
- `memory.suggest_archive`
- `graph.search`
- `graph.summarize`
- `backup.create`
- `backup.validate`
- `backup.export`
- `import.validate`
- `restore.plan`
- `recovery.check`
- `integrity.check`

Jika API key atau modul tidak tersedia, tool tetap bisa muncul sebagai disabled/unavailable tanpa membuat bot crash.

## Direct Run vs Proposal

Tool read-only low risk boleh dijalankan langsung jika permission valid.

Tool yang menulis data, memanggil aksi eksternal, atau berisiko tinggi tidak boleh dijalankan langsung. Sistem akan menolak direct run dan mengarahkan user membuat proposal:

```text
/toolpropose <toolId> | <input>
```

Proposal masuk ke executor, lalu harus:

```text
/approve <proposalId>
/runexec <proposalId>
```

## Telegram Commands

```text
/tools
/tool <toolId>
/toolpreview <toolId> | <input>
/toolrun <toolId> | <input>
/toolpropose <toolId> | <input>
/toolenable <toolId>
/tooldisable <toolId>
```

`/toolenable` dan `/tooldisable` admin-only. Output command tidak menampilkan secret, token, API key, atau connection string.

## Dashboard API

Endpoint protected:

```text
GET  /api/dashboard/tools
GET  /api/dashboard/tools/runs
GET  /api/dashboard/tools/audit
GET  /api/dashboard/tools/:toolId
POST /api/dashboard/tools/:toolId/enable
POST /api/dashboard/tools/:toolId/disable
POST /api/dashboard/tools/:toolId/preview
POST /api/dashboard/tools/:toolId/run
POST /api/dashboard/tools/:toolId/propose
```

Semua endpoint selain health dashboard membutuhkan `Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>`.

## Dashboard UI

Tab `Tools` menampilkan:

- daftar tool
- filter category/risk/enabled/source
- detail metadata dan permission
- preview tool
- direct run untuk tool aman
- proposal untuk tool write/danger
- enable/disable dengan konfirmasi
- recent runs
- audit log tool

## Batasan

- Belum ada marketplace publik.
- Belum ada install plugin dari URL.
- Belum ada registry handler linting terpisah.
- Handler tool tetap perlu tersedia dari kode internal.
- Tool external yang aman tetap tergantung API key terkait.
- Backup/import/restore tools mengikuti governance Phase 18: restore/import wajib proposal dan approval.

## Phase 19 Backup/PWA Tools

Tool tambahan:

- `pwa.status`
- `backup.schedule.create`
- `backup.schedule.preview`
- `backup.schedule.request_run`
- `backup.schedule.approve_run`
- `backup.schedule.run_approved`
- `backup.download.prepare`
- `import.preview`

Write/scheduler run tetap mengikuti governance dan approval flow. Restore/import danger tetap tidak berjalan langsung.

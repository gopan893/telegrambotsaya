# Research / Docs Dashboard

Dashboard menambahkan tab `Research / Docs` dengan route `#research`.

## Fitur

- Membuat research task.
- Mengumpulkan source read-only.
- Menjalankan analysis/evidence brief.
- Melihat evidence pack dan report.
- Membuat docs gap report.
- Membuat docs draft.
- Membuat docs update plan.
- Membuat docs proposal tanpa direct file write.

## API

Protected endpoints:

```text
GET  /api/dashboard/research
GET  /api/dashboard/research/tasks
POST /api/dashboard/research/tasks
GET  /api/dashboard/research/tasks/:id
POST /api/dashboard/research/tasks/:id/collect
POST /api/dashboard/research/tasks/:id/analyze
GET  /api/dashboard/research/tasks/:id/evidence
GET  /api/dashboard/research/tasks/:id/report
POST /api/dashboard/research/tasks/:id/link-knowledge
GET  /api/dashboard/research/docs/gaps
POST /api/dashboard/research/docs/draft
POST /api/dashboard/research/docs/update-plan
POST /api/dashboard/research/docs/proposal
```

Semua endpoint protected, sanitized, dan tidak mengembalikan secret.

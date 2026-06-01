# Disaster Recovery

Disaster Recovery Phase 18 memberi status ringan untuk kesiapan pemulihan data bot.

## Checks

Recovery check memeriksa active storage driver, PostgreSQL availability/table readiness, JSON fallback, Redis, latest backup age, backup count, audit log availability, workspace count, critical keys, fallback risk, dan secret leak risk.

## Integrity Check

Integrity check mendeteksi:

- workspace tanpa owner/id
- memory tanpa userId
- workflow yang link ke goal hilang
- graph edge yang link ke node hilang
- planner task tanpa plan
- executor proposal tanpa source

## Status

| Status | Arti |
| --- | --- |
| `ready` | Backup dan storage posture cukup sehat. |
| `attention` | Ada backup stale, fallback aktif, missing critical key, atau broken reference. |

## Recommendations

Contoh rekomendasi:

- buat backup terbaru
- aktifkan PostgreSQL sebagai active storage
- cek fallback JSON
- pastikan audit log tersedia
- perbaiki broken graph/planner reference

## Dashboard

Tab `Backup` menampilkan latest backup, backup count, storage driver, fallback active, recovery status, dan integrity report.

## Telegram

```text
/recovery
/integrity
/backupstatus
```

Output Telegram dibuat ringkas. Detail dan export penuh tetap di dashboard.

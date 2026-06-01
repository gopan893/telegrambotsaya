# Export & Import

Export/import Phase 18 dirancang untuk data AI OS yang sudah disanitasi, bukan full database dump.

## Export Format

Backup export menghasilkan JSON:

```json
{
  "exportType": "backup",
  "exportedAt": "2026-06-01T00:00:00.000Z",
  "manifest": {
    "id": "backup_...",
    "type": "workspace",
    "version": "1.0.0",
    "checksum": "...",
    "sanitized": true
  },
  "snapshot": {
    "backupVersion": "1.0.0",
    "scope": {},
    "data": {}
  }
}
```

Field secret/env tidak boleh ada. Payload yang mengandung credential akan ditolak saat import validation.

## Import Flow

1. Paste/upload JSON di dashboard.
2. Jalankan validate.
3. Lihat preview/diff.
4. Buat restore plan.
5. Jalankan restore dengan confirmation text `RESTORE`.

Import tidak langsung overwrite data.

## Diff

Preview menampilkan jumlah item incoming vs existing per storage key:

```json
{
  "planner_tasks": {
    "incoming": 3,
    "existing": 10,
    "mode": "merge_upsert"
  }
}
```

## Size Limit

Import payload dibatasi agar cocok untuk Render free tier. Jika backup terlalu besar, pecah per workspace/user.

## Reject Rules

Import ditolak jika mengandung token/API key/secret/password, Authorization/Bearer token, `DATABASE_URL`, `REDIS_URL`, connection string, atau provider key pattern seperti `sk-`, `gsk_`, `tvly_`, `ghp_`.

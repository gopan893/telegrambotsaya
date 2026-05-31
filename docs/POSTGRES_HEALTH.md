# PostgreSQL Health

Phase 12 menambahkan checker PostgreSQL aman untuk dashboard dan command Telegram.

## Fungsi

`src/storage/database.js` menyediakan:

- `checkPostgresHealth(options = {})`

Output aman:

- `configured`
- `available`
- `latencyMs`
- `errorCode`
- `errorMessageSafe`
- `tableReady`
- `status`
- `recommendedFix`

Status yang dipakai:

- `connected`
- `missing_env`
- `pg_missing`
- `connection_failed`
- `migration_required`
- `timeout`
- `unavailable`

## Cara Kerja

Checker menjalankan:

```sql
SELECT 1 AS ok;
SELECT to_regclass('public.app_kv_store') AS table_name;
```

Jika `app_kv_store` belum ada, status menjadi `migration_required`.

## Keamanan

Checker tidak mengembalikan `DATABASE_URL`, username, password, host lengkap, atau credential apa pun.

## Telegram

Gunakan:

```text
/dbstatus
```

Command ini menampilkan status PostgreSQL, table readiness, fallback storage, dan rekomendasi perbaikan.

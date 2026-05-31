# Redis Health

Phase 12 menambahkan checker Redis aman untuk dashboard dan command Telegram.

## Fungsi

`src/storage/redis-store.js` menyediakan:

- `checkRedisHealth(options = {})`

Output aman:

- `configured`
- `available`
- `latencyMs`
- `errorCode`
- `errorMessageSafe`
- `status`
- `recommendedFix`

Status yang dipakai:

- `connected`
- `missing_env`
- `ioredis_missing`
- `connection_failed`
- `timeout`
- `tls_issue`
- `unavailable`
- `disabled`

## Cara Kerja

Checker memakai Redis client ringan dengan:

- `lazyConnect`
- `connectTimeout`
- `maxRetriesPerRequest: 1`
- `enableOfflineQueue: false`
- cache hasil health sekitar 30 detik

Jika Redis tidak tersedia, bot tetap memakai memory cache fallback.

## Keamanan

Checker tidak mengembalikan `REDIS_URL`, password, host lengkap, atau token.

## Telegram

Gunakan:

```text
/redisstatus
```

Command ini menampilkan status Redis/cache, latency, fallback memory cache, dan rekomendasi perbaikan.

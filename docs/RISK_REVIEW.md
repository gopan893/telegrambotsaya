# Advanced Risk Review

Advanced Risk Review adalah bagian Phase 24 untuk menilai risiko teknis, data, operasional, security, scope, dan approval requirement.

## Risk Level

| Level | Arti |
| --- | --- |
| `low` | Aman untuk diskusi normal. |
| `medium` | Perlu perhatian, tapi bukan aksi berbahaya. |
| `high` | Bisa berdampak ke data, deploy, akses, atau production. |
| `danger` | Restore/import/delete/secret/action irreversible atau sangat sensitif. |

## Pemicu High/Danger

- restore backup;
- import overwrite;
- delete/drop/hapus permanen;
- token/API key/env;
- webhook secret;
- DATABASE_URL/REDIS_URL;
- permission/admin changes;
- external/write action.

## Output

Risk review memberi:

- risk score 0-100;
- faktor risiko;
- mitigasi;
- approval requirement;
- rekomendasi apakah lanjut, tunda, atau buat proposal executor.

## Command

```text
/risk <rencana/aksi>
/riskreview <topik>
```

`/risk` memakai Phase 24 decision risk scorer. `/riskreview` tetap memakai council/security review eksplisit.

## Guard

Risk review tidak menjalankan aksi. Jika user minta aksi berbahaya, bot hanya membuat rekomendasi proposal dan mengingatkan approval.

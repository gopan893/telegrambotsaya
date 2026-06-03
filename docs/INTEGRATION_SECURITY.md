# Integration Security

Phase 28 menjaga boundary integrasi eksternal dengan aturan berikut.

## Tidak Ada Auto-Write

- Proposal creation tidak menjalankan aksi eksternal.
- Dry-run tidak menjalankan aksi eksternal.
- Evaluation tidak menjalankan aksi eksternal.
- Approval tidak menjalankan aksi otomatis.
- Run hanya boleh setelah proposal approved.

## Secret Guard

Payload ditolak atau disanitasi jika mengandung:

- token, secret, password, api key;
- Authorization/Bearer;
- `DATABASE_URL`, `REDIS_URL`;
- `postgresql://`, `rediss://`;
- `sk-`, `ghp_`, `github_pat`, `gsk_`, `tvly_`;
- connector secrets seperti `GITHUB_TOKEN`, `GOOGLE_CLIENT_SECRET`, `CLOUDFLARE_API_TOKEN`.

## Permission

- Read-only membutuhkan read access.
- Write proposal membutuhkan owner/admin/editor.
- Danger/config/send action membutuhkan owner/admin jika risk naik ke high/danger.

## Audit

Sistem mencatat:

- connector read executed;
- connector dry-run executed;
- integration proposal pipeline;
- quality gate run;
- evaluation gate run;
- proposal created;
- permission denied.

Audit summary disanitasi dan tidak menyimpan raw credential.

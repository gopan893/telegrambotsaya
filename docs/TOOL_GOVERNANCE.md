# Tool Governance

Tool governance memastikan setiap tool dinilai sebelum preview, run, atau dijadikan proposal execution. Governance ini melengkapi executor Phase 16: registry mengatur tool, executor mengatur approval/run untuk aksi yang butuh persetujuan manusia.

## Risk Level

| Risk | Arti |
| --- | --- |
| `low` | Read-only, report, preview, atau lookup ringan. |
| `medium` | Write kecil ke planner/goal/workflow/memory. |
| `high` | Write sensitif, aksi eksternal, atau perubahan yang berdampak besar. |
| `danger` | Aksi berbahaya/irreversible. Phase 17 tidak menyediakan shell atau hard delete. |

## Permission

| Role | Preview/Read | Run Read-Only | Write Tool | Danger Tool |
| --- | --- | --- | --- | --- |
| owner | yes | yes | yes | yes |
| admin | yes | yes | yes | yes |
| editor | yes | yes | yes | no |
| viewer | yes | yes | no | no |
| guest | limited | no | no | no |

Permission selalu dievaluasi terhadap `workspaceId`. Jika tidak ada `workspaceId`, sistem memakai default workspace user.

## Governance Decision

Setiap tool run menghasilkan keputusan:

```json
{
  "allowed": true,
  "requiresApproval": false,
  "riskLevel": "low",
  "reason": "allowed",
  "permission": "read",
  "sanitizedInput": {},
  "warnings": []
}
```

Keputusan bisa menolak request karena:

- tool disabled
- permission tidak cukup
- input mengandung secret-like value
- input tidak sesuai schema ringan
- rate limit terlampaui
- tool membutuhkan proposal/approval

## Approval Requirement

Direct run hanya diizinkan untuk tool read-only low risk.

Tool berikut wajib lewat executor proposal:

- write tool
- external/danger tool
- tool dengan `requiresApproval=true`
- tool dengan risk `medium`, `high`, atau `danger`

Approval dan run tetap terpisah:

```text
toolpropose -> pending approval -> approve -> runexec
```

## Secret Guard

Input/output disaring dari pattern:

```text
token
secret
password
api_key
Authorization
Bearer
DATABASE_URL
REDIS_URL
postgresql://
rediss://
sk-
ghp_
gsk_
tvly_
```

Payload yang mengandung secret-like value ditolak untuk input tool. Output dan audit dimask agar tidak membocorkan rahasia.

## Rate Limit dan Timeout

Setiap tool dapat punya:

- `rateLimit.windowMs`
- `rateLimit.max`
- `timeoutMs`

Rate limit berlaku per tool, user, dan workspace. Timeout mencegah handler lambat menggantung request dashboard/Telegram terlalu lama.

## Audit dan Telemetry

Event yang dicatat:

- tool registered
- tool enabled/disabled
- tool previewed
- tool run attempted
- tool run completed/failed
- tool proposal created
- permission denied
- approval required
- rate limit hit

Run summary dicatat di `tool_runs`, audit detail ringkas di `tool_audit`, dan event penting juga masuk dashboard audit log.

## Limitasi

- Belum ada policy DSL.
- Belum ada dynamic plugin sandbox.
- Belum ada distributed rate limiter.
- Belum ada per-tool admin UI untuk mengubah schema.
- Phase 18 direkomendasikan untuk backup/export/import registry dan audit.

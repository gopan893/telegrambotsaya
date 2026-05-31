# Natural AI OS Integration

Phase 7 membuat AI OS bisa aktif dari chat natural tanpa user harus selalu memakai command.

## Alur

```text
Pesan non-command
-> natural router ringan
-> adaptive mode router
-> AI OS natural integration
-> autonomous/legacy AI fallback
```

AI OS natural integration hanya aktif jika heuristic melihat kebutuhan konteks project/memory/goal/workflow/insight/ops.

## Trigger Yang Mengaktifkan AI OS Context

- `langkah berikutnya`
- `prioritas`
- `project` / `proyek`
- `goal` / `tujuan`
- `workflow`
- `lanjutkan`
- `roadmap`
- `risiko`
- `insight`
- `memory` / `memori` / `ingat`
- `progress`
- `rencana`
- `strategi`
- `evaluasi`
- `phase` / `tahap`
- `cek bot sehat` / `health` / `diagnostics`

## Kapan Tidak Aktif

- command eksplisit seperti `/goals`;
- sapaan sederhana seperti `Halo`;
- ucapan pendek seperti `ok`, `sip`, `terima kasih`;
- ekspresi matematika sederhana seperti `25*4`;
- unit conversion yang sudah ditangani natural router;
- health-advice ringan seperti `Saya merasa pusing`.

## Context Limit

Context dibatasi agar ringan untuk Render free tier:

- top 5 memory;
- max 5 active goals;
- max 5 active workflows;
- max 5 insights;
- workflow steps hanya diambil untuk workflow relevan;
- tidak mengambil semua history;
- tidak menyimpan prompt penuh ke telemetry.

## Fallback Behavior

- Jika context kosong, pesan lanjut ke AI fallback normal.
- Jika storage-manager error, pesan lanjut ke AI fallback normal.
- Jika PostgreSQL tidak tersedia, context dibangun dari JSON/AI OS fallback.
- Jika Redis tidak tersedia, state sementara tetap memakai memory/local fallback.
- Jika ops module tidak tersedia, bot memberi checklist health manual.

## Contoh

User:

```text
Apa langkah berikutnya untuk project bot saya?
```

Bot:

```text
Langkah berikutnya yang paling masuk akal:

1. Kerjakan step workflow aktif...
2. Review goal utama...
3. Gunakan insight...
```

User:

```text
Halo
```

Bot memakai fallback chat biasa, tidak memuat AI OS context.

User:

```text
Cek apakah bot saya sehat
```

Bot memakai health/ops ringan jika tersedia.

# Agent Council

Phase 22 menambahkan Agent Council agar bot bisa meminta beberapa agent memberi opini internal, lalu Orchestrator menyatukan keputusan akhir yang bersih untuk user.

## Tujuan

Council dipakai untuk pesan yang butuh beberapa sudut pandang:

- roadmap atau phase berikutnya
- pilihan arsitektur
- pro kontra
- risk review
- restore/import/backup berisiko
- keputusan teknis yang bisa berdampak ke fitur lama

Sapaan, hitungan sederhana, dan chat ringan tidak memicu council.

## Mode

| Mode | Fungsi |
| --- | --- |
| `quick_council` | Council ringan untuk planning/decision umum. |
| `planning_review` | Fokus roadmap, prioritas, dan next step. |
| `coding_review` | Fokus implementasi, regresi, dan test. |
| `decision_review` | Fokus pilihan, pro/kontra, dan rekomendasi. |
| `risk_review` | Fokus safety, approval, restore/import, secret. |
| `debate` | Planner/Critic membandingkan opsi satu ronde. |

## Natural Chat

Normal chat tetap menerima satu jawaban final. Detail routing, daftar agent, dan raw diagnostics tidak ditampilkan.

Contoh:

```text
User: saya bingung lanjut phase berapa
Bot: Menurut saya lanjut ke Phase 22 — Agent Council + Internal Debate Engine...
```

## Command

```text
/council <topic>
/debate <topic>
/proscons <topic>
/riskreview <topic>
/councilstatus
/councilrecent
```

Command eksplisit boleh menampilkan opini agent dan kritik ringkas karena user memang meminta mode council.

## Dashboard

Tab `Agents / Multi-Bot` memiliki panel `Agent Council & Debate`:

- run council
- run debate
- risk review
- decision review
- council router test
- recent council sessions

## Safety

- Tidak menjalankan aksi apa pun.
- Write/external/danger tetap harus lewat executor approval.
- Secret-like input ditolak.
- Audit log memakai summary sanitized.
- Hidden chain-of-thought tidak ditampilkan; hanya reasoning summary ringkas.

## Manual Test

```text
/council saya bingung lanjut phase berapa
/debate 10 bot langsung atau 4 dulu
/proscons PostgreSQL atau Redis untuk memory
/riskreview restore backup production
/councilstatus
/councilrecent
```

# Command Reference

Dokumen ini merangkum command utama bot setelah Phase 7. Semua output panjang harus lewat sender/chunking Telegram.

## Core

| Command | Fungsi |
| --- | --- |
| `/start` | Sapaan awal bot. |
| `/help` | Daftar command. |
| `/ping` | Cek respons bot. |
| `/reset` | Reset state user dengan guard/konfirmasi jika tersedia. |
| `/stats` | Status runtime ringkas, storage, Redis, memory, plugin. |
| `/hitung <ekspresi>` | Kalkulator ekspresi matematika murni. |
| `/jam [lokasi]` | Waktu saat ini. |
| `/tanggal` | Tanggal saat ini. |
| `/cuaca <kota>` | Cuaca jika API key tersedia. |
| `/cari <query>` | Search/summarize jika search API tersedia. |

## Adaptive

| Command | Fungsi |
| --- | --- |
| `/mode` | Manual override mode lama. |
| `/adaptive` | Bantuan adaptive mode. |
| `/adaptive status` | Status adaptive mode. |
| `/adaptive on` | Aktifkan adaptive routing. |
| `/adaptive off` | Matikan adaptive routing. |
| `/adaptive reset` | Reset profile adaptive user. |

## AI OS, Memory, Goal, Workflow

| Command | Fungsi |
| --- | --- |
| `/aios` | Ringkasan AI OS user. |
| `/remember <teks>` | Simpan memory manual. |
| `/memory` | Lihat memory terbaru. |
| `/forget <memoryId>` | Soft delete/hapus memory user. |
| `/goals` | Lihat goal aktif. |
| `/goaladd <judul> | <deskripsi> | <prioritas> | <targetDate>` | Tambah goal. |
| `/goalupdate <goalId> | <field> | <value>` | Update goal. |
| `/workflows` | Lihat workflow aktif. |
| `/workflowadd <judul> | <deskripsi> | <goalId optional>` | Tambah workflow. |
| `/workflowstep <workflowId> | <step>` | Tambah step workflow. |
| `/workflowdone <workflowId> | <stepNumber>` | Tandai step selesai. |
| `/insights` | Lihat insight terbaru. |
| `/graph` | Ringkasan knowledge graph. |

## Collaboration

| Command | Fungsi |
| --- | --- |
| `/think <masalah>` | Thinking partner. |
| `/strategy <tujuan/masalah>` | Strategic analysis. |
| `/reflect <pengalaman/topik>` | Reflection partner. |
| `/learnplan <topik>` | Roadmap belajar. |
| `/mentalmodel <masalah/konsep>` | Mental model builder. |
| `/decision <pilihan/masalah>` | Decision support. |
| `/blindspot <rencana>` | Audit blind spot. |
| `/assumptions <argumen>` | Pisahkan fakta/asumsi/opini. |
| `/perspectives <masalah>` | Multi-perspective analysis. |
| `/insight <catatan>` | Generate insight ringan. |
| `/journal [isi]` | Prompt/refleksi harian. |
| `/collab` | Status collaboration layer. |
| `/collab-reset` | Reset data collaboration user. |

## Ops/Admin

Command ops bersifat admin-only jika sensitif.

| Command | Fungsi |
| --- | --- |
| `/ops` | Ringkasan AI Operations. |
| `/health` | Health/runtime/storage status. |
| `/diag` | Diagnostics. |
| `/reliability` | Reliability score. |
| `/perf` | Performance summary. |
| `/tokens` | Token estimate/usage. |

## Natural Chat Yang Didukung

Bot dapat memakai AI OS context secara natural untuk pesan seperti:

- `Apa langkah berikutnya untuk project bot saya?`
- `Saya bingung prioritas minggu ini apa`
- `Lanjutkan workflow terakhir`
- `Apa risiko terbesar dari roadmap AI saya?`
- `Apa insight penting dari project ini?`
- `Cek apakah bot saya sehat`

Sapaan sederhana, kalkulator sederhana, unit conversion, dan health-advice ringan tetap melewati router ringan agar tidak berat.

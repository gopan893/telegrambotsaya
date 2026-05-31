# Command Reference

Dokumen ini merangkum command utama bot setelah Phase 7. Semua output panjang harus lewat sender/chunking Telegram.

## Core

| Command | Fungsi |
| --- | --- |
| `/start` | Sapaan awal bot. |
| `/help` | Daftar command. |
| `/dashboard` | Info dashboard/API dan endpoint health. |
| `/dashboardstatus` | Status dashboard tanpa menampilkan token. |
| `/dbstatus` | Status PostgreSQL, readiness tabel, fallback, dan rekomendasi perbaikan. |
| `/redisstatus` | Status Redis/cache, fallback memory cache, dan rekomendasi perbaikan. |
| `/audit [recent]` | Ringkasan audit dashboard/admin terbaru, admin-only. |
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
| `/graph <konsep>` | Ringkasan konsep dan relasinya. |
| `/concepts` | Konsep terpenting user. |
| `/relate <A> | <B> | <relationship> | <evidence>` | Tambah relasi graph manual. |
| `/graphsearch <query>` | Cari node/edge relevan. |
| `/graphrisks` | Lihat risk node dan relasi risiko. |
| `/graphdeps` | Lihat dependency utama. |
| `/graphprune` | Prune graph stale/low-value. |
| `/graphstats` | Statistik node, edge, relationship, confidence. |

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
- `dashboard nya dimana?`
- `cara cek health bot?`
- `kenapa PostgreSQL dashboard unavailable?`
- `redis dashboard error gimana ceknya?`
- `Apa hubungan antara PostgreSQL, Redis, dan memory bot saya?`
- `Apa konsep penting dari project ini?`
- `Apa dependency terbesar dari roadmap bot saya?`

Sapaan sederhana, kalkulator sederhana, unit conversion, dan health-advice ringan tetap melewati router ringan agar tidak berat.

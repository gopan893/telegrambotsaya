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
| `/whoami` | Identitas Telegram user, role bot, default workspace, dan permission. |
| `/workspace` | Workspace aktif, role, permission, dan cognitive workspace lama. |
| `/workspaces` | Daftar workspace yang bisa diakses user. |
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

## Planner & Task Orchestration

| Command | Fungsi |
| --- | --- |
| `/plans` | Daftar long-term plan aktif user/workspace. |
| `/plan <planId>` | Detail plan, milestone, progress, dan next action. |
| `/planadd <judul> | <deskripsi> | <horizon>` | Buat plan baru. |
| `/plantasks <planId>` | Daftar task dalam plan. |
| `/taskadd <planId> | <task title> | <description>` | Tambah task ke plan. |
| `/taskdone <taskId>` | Tandai task selesai. |
| `/taskblock <taskId> | <reason>` | Tandai task blocked dengan alasan. |
| `/next` | Tampilkan next action dari planner. |
| `/priorities` | Tampilkan task prioritas tertinggi. |

Natural chat yang diarahkan ke planner: `apa prioritas saya?`, `langkah berikutnya apa?`, `buat roadmap`, `pecah goal ini jadi task`, dan `apa yang harus saya kerjakan minggu ini?`.

## Human-Approved Executor

| Command | Fungsi |
| --- | --- |
| `/executions` | Daftar proposal eksekusi terbaru untuk workspace user. |
| `/pending` | Daftar proposal yang menunggu approval. |
| `/propose <taskId>` | Buat proposal eksekusi dari planner task. Tidak menjalankan aksi. |
| `/approve <proposalId>` | Approve proposal. Approval tidak otomatis menjalankan aksi. |
| `/runexec <proposalId>` | Jalankan proposal yang sudah approved. |
| `/reject <proposalId> | <reason>` | Reject proposal. |
| `/cancel_exec <proposalId>` | Cancel proposal pending/approved. |

Natural chat seperti `jalankan task ini`, `eksekusi langkah berikutnya`, dan `buatkan proposal eksekusi` diarahkan ke executor. Bot hanya membuat proposal atau menjelaskan alur approval; tidak ada aksi write/eksternal yang berjalan tanpa `/approve` dan `/runexec`.

## Tool Registry

| Command | Fungsi |
| --- | --- |
| `/tools` | Daftar tool terdaftar per kategori dan risk. |
| `/tool <toolId>` | Detail metadata tool, risk, permission, dan approval requirement. |
| `/toolpreview <toolId> | <input>` | Preview aman tanpa menjalankan handler/mutasi data. |
| `/toolrun <toolId> | <input>` | Jalankan hanya tool read-only low risk yang permitted. |
| `/toolpropose <toolId> | <input>` | Buat proposal executor untuk write/external/danger tool. |
| `/toolenable <toolId>` | Enable tool, admin-only. |
| `/tooldisable <toolId>` | Disable tool, admin-only. |

Direct run untuk tool write/external/danger ditolak dan diarahkan ke `/toolpropose`, lalu flow `/approve` dan `/runexec`. Tidak ada shell executor, dynamic plugin loading, atau arbitrary code execution.

## Multi-Bot & Smart Agents

| Command | Fungsi |
| --- | --- |
| `/bots` | Daftar bot Telegram secara aman, hanya tokenConfigured/webhookSecretConfigured. |
| `/botstatus` | Ringkasan status multi-bot dan default bot. |
| `/botinfo <botId>` | Detail bot tanpa token atau secret. |
| `/agents` | Daftar agent/persona default. |
| `/agent <agentId>` | Detail role, botId, specialties, dan guard agent. |
| `/agentstatus` | Status agent registry. |
| `/agentprofile <agentId>` | Lihat personality profile agent. |
| `/agentmemory <agentId>` | Lihat memory khusus agent. |
| `/agentremember <agentId> \| <text>` | Simpan memory agent yang aman. |
| `/agentforget <agentId> \| <memoryId>` | Archive memory agent. |
| `/agentprefs <agentId>` | Lihat preferences agent. |
| `/sharedmemory` | Lihat shared memory antar agent. |
| `/agentlearn <agentId> \| <note>` | Simpan learning note agent. |
| `/agentstyle <agentId>` | Lihat style guide agent. |
| `/router` | Status natural smart router untuk chat saat ini. |
| `/routermode` | Alias status router. |
| `/quiet` | Mode grup orchestrator-only. |
| `/smart` | Mode grup natural smart. |
| `/council <topic>` | Run Agent Council ringan dan synthesis final. |
| `/debate <topic>` | Run debate satu ronde dengan Planner/Critic dan synthesis. |
| `/proscons <topic>` | Review pro/kontra dan rekomendasi. |
| `/allagents <topic>` | Semua agent menjawab singkat, admin-only. |
| `/askagents <topic>` | Test routing natural smart secara eksplisit. |
| `/riskreview <topic>` | Paksa Security/Critic review untuk topik berisiko. |
| `/councilstatus` | Status council session dan summary terbaru. |
| `/councilrecent` | Daftar session council terbaru. |

Natural chat tetap utama. Pesan seperti `Bot saya error setelah deploy`, `Saya ingin restore backup lama`, atau `Saya capek hari ini` akan memilih agent relevan otomatis; agent lain tetap silent. Untuk planning/decision kompleks, council bisa berjalan internal tetapi user tetap menerima satu jawaban final yang bersih.

## Backup & Recovery

| Command | Fungsi |
| --- | --- |
| `/backup` | Bantuan dan status backup/recovery singkat. |
| `/backupcreate` | Buat backup workspace aman. |
| `/backups` | Daftar backup terbaru. |
| `/backupstatus` | Status latest backup, storage, dan fallback. |
| `/pwa` | URL dashboard dan instruksi install PWA di HP. |
| `/backupdownload` | Panduan download backup JSON dari dashboard. |
| `/importhelp` | Panduan import, preview, dan restore aman. |
| `/backupschedule` | Bantuan backup scheduler manual/approved. |
| `/backupscheduleadd <nama> | <scope> | <frequency>` | Buat schedule backup tanpa menjalankan backup langsung. |
| `/backupschedules` | Daftar schedule backup. |
| `/backupdue` | Lihat due schedule dan pending run approval. |
| `/backupapprove <runId>` | Approve scheduled backup run. |
| `/backuprun <runId>` | Jalankan backup run yang sudah approved. |
| `/recovery` | Jalankan disaster recovery check ringan. |
| `/integrity` | Jalankan integrity check ringan. |
| `/exportsummary` | Export summary aman; JSON penuh lewat dashboard. |

Restore/import raw dijaga via dashboard karena butuh validation, preview, permission owner/admin, dan confirmation text `RESTORE`.
Scheduled backup juga tidak berjalan otomatis; flow-nya request approval, approve, lalu run.

## Knowledge Graph

| Command | Fungsi |
| --- | --- |
| `/graph` | Ringkasan knowledge graph. |
| `/graph <konsep>` | Ringkasan konsep dan relasinya. |
| `/concepts` | Konsep terpenting user. |
| `/relate <A> | <B> | <relationship> | <evidence>` | Tambah relasi graph manual. |
| `/graphsearch <query>` | Cari node/edge relevan. |
| `/graphrisks` | Lihat risk node dan relasi risiko. |
| `/graphdeps` | Lihat dependency utama. |
| `/graphprune` | Prune graph stale/low-value. |
| `/graphstats` | Statistik node, edge, relationship, confidence. |

## Workspace & Permission

| Command | Fungsi |
| --- | --- |
| `/whoami` | Cek user ID, role admin/user, default workspace, dan permission workspace. |
| `/workspace` | Cek workspace aktif dan cognitive workspace lama tanpa menghapus behavior lama. |
| `/workspaces` | Lihat personal/project/team/admin workspace yang bisa diakses. |

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

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
| `/propose_action <aksi>` | Buat action plan dan proposal executor dari natural action request. |
| `/actionplans` | Daftar action plan agent. |
| `/actionplan <actionPlanId>` | Detail action plan dan action di dalamnya. |
| `/propose_decision <decisionId>` | Buat proposal dari decision record. |
| `/propose_delegation <delegationId>` | Buat proposal dari delegation session. |
| `/propose_task <taskId>` | Buat proposal dari agent task. |
| `/proposalstatus <proposalId>` | Cek status approval/proposal. |
| `/approve <proposalId>` | Approve proposal. Approval tidak otomatis menjalankan aksi. |
| `/runexec <proposalId>` | Jalankan proposal yang sudah approved. |
| `/reject <proposalId> | <reason>` | Reject proposal. |
| `/cancel_exec <proposalId>` | Cancel proposal pending/approved. |

Natural chat seperti `jalankan task ini`, `eksekusi langkah berikutnya`, dan `buatkan proposal eksekusi` diarahkan ke executor. Bot hanya membuat proposal atau menjelaskan alur approval; tidak ada aksi write/eksternal yang berjalan tanpa `/approve` dan `/runexec`.

Phase 25 menambahkan action-aware natural chat. Pesan seperti `jalankan backup sekarang`, `restore backup lama`, atau `kerjakan keputusan tadi` akan dibuatkan action plan/proposal, tetapi tetap belum dijalankan.

## Agent Evaluation

| Command | Fungsi |
| --- | --- |
| `/evalagents` | Jalankan evaluation suite dry-run untuk routing, risk, proposal, dan safety. |
| `/evalagent <caseId>` | Jalankan satu evaluation case. |
| `/evalsummary` | Lihat summary evaluation terbaru. |
| `/evalgates` | Lihat status quality gates evaluation v2. |
| `/evalcompare` | Bandingkan dua evaluation run terakhir dan tampilkan regresi. |

## Self-Healing & Regression Guard

| Command | Fungsi |
| --- | --- |
| `/selfheal` | Status Self-Healing Ops, dashboard URL, dan command yang tersedia. |
| `/healthcheck` | Jalankan guard suite ringan untuk dashboard, natural chat, executor, integration gate, storage, security, dan PWA. |
| `/regressioncheck` | Jalankan guard P0/P1 untuk regresi kritis. |
| `/dashboardcheck` | Cek registry/routing dashboard agar tab stabil tidak fallback ke Overview dan tab internal tetap tersembunyi. |
| `/repairplans` | Daftar repair plan terbaru dari guard failure. |
| `/repairplan <planId>` | Detail repair plan, severity, kategori, dan suggested repair. |
| `/repairprompt <planId>` | Generate prompt perbaikan untuk Codex/Hermes, admin-only. |
| `/propose_repair <planId>` | Buat executor proposal dari repair plan, admin-only. Proposal tidak dijalankan otomatis. |

Self-Healing tidak menjalankan shell, tidak mengubah repo dari runtime bot, dan tidak melakukan auto-repair. Guard check bersifat read-only; repair prompt/proposal hanya menyiapkan langkah perbaikan yang tetap harus melalui approval executor.

## Monitoring, Auto-Healing, CI/CD

| Command | Fungsi |
| --- | --- |
| `/monitor` | Snapshot live monitoring, WebSocket client count, dan dashboard Monitoring URL. |
| `/livehealth` | Alias health snapshot real-time. |
| `/autoheal` | Daftar safe auto-heal action beserta level L0/L1/L2/L3. |
| `/autoheal_runs` | Riwayat auto-heal run terbaru. |
| `/autoheal_run <actionId>` | Jalankan L1 safe action atau buat proposal/plan untuk L2; L3 diblokir. |
| `/cicd` | Ringkasan CI/CD dan GitHub Actions read-only status. |
| `/cicd_status` | Alias status CI/CD. |
| `/github_actions` | Status GitHub Actions atau setup plan jika token belum tersedia. |
| `/propose_workflow <workflowId>` | Buat executor proposal untuk workflow dispatch, admin-only. Tidak dispatch langsung. |
| `/propose_deploy` | Buat executor proposal untuk deploy Render, admin-only. Tidak deploy langsung. |

Tab dashboard `Monitoring` dan `CI/CD` aktif mulai Phase 33. WebSocket monitoring butuh dashboard token dan semua payload disanitasi. Workflow dispatch/deploy tetap wajib Evaluation v2 + executor approval.

## Production Observability & Incident Response

| Command | Fungsi |
| --- | --- |
| `/prodhealth` | Jalankan production health check read-only dan buat/dedupe incident jika ada masalah. |
| `/incidents` | Daftar production incident terbuka; fallback ke ops incident lama jika belum ada production incident. |
| `/incident <incidentId>` | Detail incident, severity, status, affected systems, root cause, dan timeline. |
| `/analyze_incident <incidentId>` | Buat root cause hypothesis tanpa menjalankan repair. |
| `/incident_timeline <incidentId>` | Ringkasan timeline incident yang sudah disanitasi. |
| `/responseplan <incidentId>` | Buat response plan tanpa menjalankan action. |
| `/propose_incident_repair <incidentId>` | Buat executor proposal repair; belum dijalankan. |
| `/propose_incident_rollback <incidentId>` | Buat executor proposal rollback; belum dijalankan. |
| `/close_incident <incidentId>` | Tutup incident jika sudah aman/selesai. |

Natural chat seperti `cek production health`, `ada incident apa?`, `kenapa deploy gagal?`, `buat response plan`, dan `rollback kalau perlu` diarahkan ke Incident Response Center. Repair/rollback tetap wajib Evaluation v2 + executor proposal + `/approve` + `/runexec`.

## Multi-Project Portfolio Manager

| Command | Fungsi |
| --- | --- |
| `/portfolio` | Ringkasan portfolio lintas project/goal aktif, admin-only. |
| `/projects` | Daftar project/goal aktif dan link dashboard Portfolio. |
| `/projecthealth [goalId]` | Health score project tertentu atau ringkasan top project. |
| `/nextproject` | Project yang paling perlu dilanjutkan menurut priority engine. |
| `/portfolio_next` | Next action portfolio aman dan agent yang disarankan. |
| `/weeklyplan` | Rencana portfolio mingguan read-only. |
| `/monthlyplan` | Rencana portfolio bulanan read-only. |
| `/staleprojects` | Project/task yang stale, blocked, atau perlu refresh status. |
| `/projectrisks` | Review risiko portfolio dan rekomendasi stabilisasi. |
| `/portfolioreport` | Weekly portfolio report sanitized. |
| `/portfolio_proposal` | Buat action plan + executor proposal dari next action; tidak menjalankan aksi. |

Natural chat seperti `project mana yang harus saya lanjutkan?`, `apa prioritas minggu ini?`, `mana yang paling berisiko?`, `kenapa project ini macet?`, `Codex atau OpenCode untuk project ini?`, dan `push dan deploy project paling penting` diarahkan ke Portfolio Manager. Push/deploy/write/external tetap proposal-only dan wajib Evaluation v2 + executor approval.

## Approved External Integrations

| Command | Fungsi |
| --- | --- |
| `/connector_status <connectorId>` | Status connector aman tanpa menampilkan credential. |
| `/connector_quality <connectorId>` | Jalankan connector quality gate. |
| `/github_status` | Status konfigurasi GitHub connector. |
| `/github_issues` | List issue GitHub jika connector siap; jika belum, tampilkan setup plan. |
| `/calendar_status` | Status Google Calendar connector. |
| `/calendar_events` | List event calendar jika OAuth client tersedia dan user terautentikasi. |
| `/gmail_status` | Status Gmail draft connector. |
| `/nas_status` | Status Cloudflare/NAS connector. |
| `/webhook_preview <payload>` | Preview/validasi payload webhook tanpa POST. |
| `/propose_github_issue <text>` | Buat proposal executor untuk GitHub issue. Tidak membuat issue langsung. |
| `/propose_calendar_event <text>` | Buat proposal executor untuk event Calendar. Tidak membuat event langsung. |
| `/propose_gmail_draft <text>` | Buat proposal executor untuk Gmail draft. Tidak mengirim email. |
| `/propose_webhook <payload>` | Buat proposal executor untuk webhook send. Tidak melakukan POST langsung. |
| `/integration_pipeline <pipelineId>` | Lihat status pipeline preflight/dry-run/evaluation/proposal. |
| `/integration_eval <pipelineId>` | Jalankan Evaluation Gate untuk pipeline integrasi. |

Natural chat seperti `buat issue GitHub untuk bug deploy Render` atau `jadwalkan meeting besok jam 9` diarahkan ke proposal integrasi. Write/external/danger action tetap harus melewati Evaluation Gate v2, `/approve`, lalu `/runexec`.

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
| `/botmapping` | Mapping aman agent -> bot dan status configured true/false. |
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
| `/multibot` | Status visible multi-bot replies untuk chat/grup. |
| `/multibot_on` | Aktifkan specialist bot replies yang dipilih router, admin/owner di grup. |
| `/multibot_off` | Matikan specialist bot replies, kembali Orchestrator-only. |
| `/visibleagents` | Lihat policy visible replies, max specialist, dan mode grup. |
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

## Agent Delegation & Decision System

| Command | Fungsi |
| --- | --- |
| `/delegate <topic>` | Pecah request kompleks menjadi task internal beberapa agent. |
| `/delegations` | Daftar delegation session terbaru. |
| `/delegation <delegationId>` | Detail delegation, task, dan status. |
| `/rundelegation <delegationId>` | Jalankan reasoning task aman dan buat synthesis final. |
| `/agenttasks` | Daftar agent task terbaru. |
| `/agenttask <taskId>` | Detail agent task. |
| `/runtask <taskId>` | Jalankan satu reasoning task aman. |
| `/handoffs` | Lihat handoff agent task terbaru. |
| `/handoff <taskId> | <targetAgentId>` | Buat handoff task ke agent yang lebih cocok. |
| `/taskresult <taskId>` | Lihat hasil ringkas task. |
| `/decision <pertanyaan/pilihan>` | Analisis keputusan dengan opsi, risiko, confidence, dan rekomendasi. |
| `/compare <opsi A> | <opsi B>` | Bandingkan opsi secara terstruktur. |
| `/proscons <topik>` | Pro/kontra, tradeoff, dan rekomendasi Phase 24. |
| `/risk <rencana/aksi>` | Risk score dan mitigasi. |
| `/confidence <rencana/opsi>` | Confidence score dan informasi yang kurang. |
| `/decisions` | Daftar decision record terbaru. |
| `/decisionhistory` | Alias daftar decision record. |
| `/decisionstatus <decisionId> | <accepted|rejected|deferred>` | Update status keputusan. |

Natural chat tetap utama. Pesan seperti `Bot saya error setelah deploy`, `Saya ingin restore backup lama`, atau `Saya capek hari ini` akan memilih agent relevan otomatis; agent lain tetap silent. Untuk planning/decision kompleks, council bisa berjalan internal tetapi user tetap menerima satu jawaban final yang bersih.

Untuk topik yang kompleks, natural chat dapat memakai delegation atau decision system sebelum fallback AI umum. Contoh: `pecah goal ini jadi task`, `buat prompt phase external integration`, `lebih baik 10 bot langsung atau 4 dulu`, dan `apa risiko restore backup production`.

Jika `/multibot_on` aktif dan token specialist tersedia, Planner/Coder/Critic/Ops/Security yang dipilih router dapat mengirim komentar singkat memakai bot masing-masing. Maksimal default 2 specialist visible, dan bot message tetap diabaikan untuk mencegah loop.

Catatan visual/file seperti `Sumber file`, `#visual-analysis`, atau `API Vision belum dikonfigurasi` hanya muncul saat pesan saat ini memang membahas file/gambar/dokumen atau ada attachment. Chat biasa seperti roadmap, deploy, atau refleksi tidak membawa metadata file lama.

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

## Coding Workspace (Phase 29)

| Command | Fungsi |
| --- | --- |
| `/coding` | Tampilkan status coding workspace. |
| `/codereq <text>` | Classify dan analisis coding request. |
| `/codeplan <text>` | Buat code change plan dari request. |
| `/codetasks` | Tampilkan daftar coding tasks. |
| `/codeprompt <planId>` | Generate Codex-ready prompt dari plan. |
| `/testplan <planId>` | Generate test plan dari plan. |
| `/riskreview_code <planId>` | Jalankan risk review multi-agent. |
| `/propose_github_issue_from_plan <planId>` | Buat proposal GitHub issue (Evaluation v2 + approval required). |
| `/propose_github_pr_from_plan <planId>` | Buat proposal GitHub PR (Evaluation v2 + approval required). |

### Natural Chat Coding

Bot dapat mendeteksi coding request secara natural:

- `buat prompt phase 30`
- `menu Agents masih masuk Overview`
- `buat issue GitHub untuk bug dashboard`
- `buat PR untuk fix domain routing`
- `bot saya error Python`
- `tambahkan fitur reminder di bot`

### Keamanan Coding Workspace

- Tidak ada eksekusi shell
- Tidak ada mutasi repo langsung
- Tidak ada push/commit langsung
- GitHub write harus melalui Evaluation v2 + executor approval
- Semua output di-redact dari secrets

## Dev Governance (Phase 34)

| Command | Fungsi |
| --- | --- |
| `/devgov` | Ringkasan status Dev Governance. |
| `/handoff` | Lihat handoff agent terbaru. |
| `/handoff_update <task>:<goal>` | Update handoff task/goal. |
| `/archmap` | Status architecture map (entry points, tabs, routes). |
| `/contractcheck` | Validasi AGENTS.md contract. |
| `/collisioncheck` | Deteksi module/tab/route duplikat. |
| `/dashboardroutes` | Cek konsistensi route dashboard. |
| `/nextcodex` | Generate prompt untuk Codex. |
| `/nextopencode` | Generate prompt untuk OpenCode. |
| `/p0prompt` | Generate P0 patch prompt. |

## Research / Docs Agent (Phase 43)

| Command | Fungsi |
| --- | --- |
| `/research` | Ringkasan task Research / Docs Agent. |
| `/research_task <topik>` | Buat research task evidence-grounded. |
| `/research_sources <taskId>` | Kumpulkan dan cek credibility source. |
| `/research_report <taskId>` | Buat research brief berbasis evidence. |
| `/evidence <taskId>` | Tampilkan evidence/source summary. |
| `/docs_agent` | Tampilkan docs gap report. |
| `/docs_gaps` | Alias docs gap report. |
| `/docs_draft <topik>` | Buat draft dokumentasi tanpa menulis file. |
| `/docs_plan <topik>` | Buat documentation update plan. |
| `/propose_docs_update <topik>` | Buat docs proposal/prompt; tidak auto-run. |
| `/source_check <taskId>` | Audit source credibility dan freshness. |

Natural chat yang didukung:

- `riset cara terbaik deploy Render Node.js`
- `buat dokumentasi env project ini`
- `apa sumbernya?`
- `update README tentang Phase 42`
- `buat troubleshooting Render exited status 1`
- `cari docs yang belum sinkron`

Research/docs write action tetap proposal-only dan harus melewati Evaluation v2 + executor approval.

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
- `Riset cara terbaik deploy Render Node.js`
- `Buat dokumentasi env project ini`

Sapaan sederhana, kalkulator sederhana, unit conversion, dan health-advice ringan tetap melewati router ringan agar tidak berat.

## Phase 42 Knowledge Graph Commands

| Command | Purpose |
|---|---|
| `/knowledge` | Knowledge graph overview. |
| `/kg` | Alias `/knowledge`. |
| `/remember_project <title> \| <summary>` | Record a decision memory (safety gate + dedup). |
| `/decision_memory [query]` | List / search decision memory. |
| `/project_context [query]` | Build project context pack. |
| `/phase_context <n>` | Build phase context. |
| `/incident_context [query]` | Build incident context. |
| `/knowledge_search <query>` | Search nodes and edges. |
| `/memory_review` | Stale / duplicate review plan. |
| `/memory_cleanup` | Archive plan (no hard delete). |
| `/docs_status` | Documentation intelligence findings. |
| `/contextpack [query]` | Build context pack. |

### Natural chat Phase 42

- `kenapa kita tidak pakai React?` → decision context.
- `apa masalah Render deploy terakhir?` → incident/deploy context.
- `apa saja keputusan penting project ini?` → decision summary.
- `cari konteks phase 36` → phase context.
- `hapus memory yang duplikat` → cleanup plan (no hard delete).
- `apa yang harus OpenCode baca sebelum lanjut?` → handoff context.
- `ingat ini sebagai keputusan project: ...` → safety gate + decision record.

## Phase 44.5 Universal Telegram Control Layer

The Telegram Control Layer provides unified routing for all ~250 commands across 20 categories.
Full documentation: `docs/TELEGRAM_COMMANDS.md` (complete reference), `docs/TELEGRAM_NATURAL_CHAT_ROUTING.md` (natural language patterns).

### Category overview

| Category | Count | Examples |
|---|---|---|
| Core | 7 | /start, /help, /menu, /status, /health, /whoami, /settings |
| Agent | 12 | /agents, /agent, /council, /debate, /multibot, /visibleagents |
| Executor | 6 | /executions, /pending, /propose, /approve, /reject, /runexec |
| Backup | 6 | /backup, /backupcreate, /backups, /restore, /integrity |
| Coding | 7 | /coding, /codereq, /codeplan, /codetasks, /testplan |
| GitHub Ops | 13 | /githubops, /gitstatus, /changes, /propose_push, /releasegate |
| Deploy | 9 | /deploy, /deploycheck, /rendercheck, /propose_deploy, /propose_rollback |
| Observability | 10 | /prodhealth, /incidents, /analyze_incident, /responseplan, /close_incident |
| Cost | 12 | /usage, /tokens, /cost, /budget, /modelusage, /economymode |
| Life OS | 17 | /lifeos, /daily, /weekly, /tasks, /habits, /focus, /mood, /energy |
| Knowledge | 13 | /knowledge, /kg, /decision_memory, /knowledge_search, /contextpack |

### Natural examples

- `cek production health` → /prodhealth
- `project mana yang harus saya lanjutkan?` → /portfolio_next
- `buat rencana hari ini` → /daily
- `push perubahan ini ke GitHub` → /propose_push (proposal only)
- `deploy ke Render` → /propose_deploy (proposal only)
- `rollback deploy terakhir` → /propose_rollback (proposal only)
- `berapa token hari ini?` → /usage
- `kirim email ini` → blocked / strict proposal only
- `selesaikan semua otomatis` → refused, offers approval-based plan

## Phase 46 — Continuous Improvement / Feedback

| Command | Fungsi |
| --- | --- |
| `/feedback` | Kirim feedback atau laporan masalah |
| `/improve` | Saran perbaikan sistem |
| `/lessons` | Lihat lessons learned |
| `/weaknesses` | Lihat kelemahan sistem |
| `/patterns` | Lihat pola masalah |
| `/regression_suggestions` | Saran regression test |
| `/improvement_plan` | Rencana perbaikan |
| `/improvement_prompt` | Generate prompt perbaikan |
| `/quality_report` | Laporan kualitas |
| `/learning_report` | Laporan pembelajaran |

## Phase 48 — Security Hardening & Red-Team Audit

Implementation: Phase 48.

Security command registration (planned):
| Command | Fungsi |
| --- | --- |
| `/security` | Security center menu. |
| `/securitycheck` | Ringkasan keamanan umum. |
| `/secretscan` | Scan secret leakage di permukaan aman. |
| `/envdrift` | Cek environment drift (nama env saja). |
| `/permissionaudit` | Audit permission owner/admin. |
| `/capabilityaudit` | Audit capability berbahaya. |
| `/bypassaudit` | Audit approval bypass paths. |
| `/redteam` | Jalankan simulasi red-team. |
| `/injectiontest` | Tes prompt injection detection. |
| `/rotationplan` | Buat rotation plan manual. |
| `/securityscore` | Tampilkan security scorecard. |
| `/securityreport` | Generate laporan keamanan. |
| `/securityproposal` | Buat proposal perbaikan keamanan. |

Natural chat phrases:
- "cek apakah ada secret bocor" → secret scan summary
- "audit permission bot" → permission audit summary
- "apakah env saya sudah benar?" → env drift summary
- "simulasikan prompt injection" → red-team summary
- "cek apakah deploy bisa bypass approval" → bypass audit summary
- "buat rotation plan untuk GitHub token" → rotation plan checklist
- "apa security score sekarang?" → security scorecard
- "tampilkan DATABASE_URL" → refused/redacted

All security findings are redacted. No secrets displayed. Credential rotation is manual checklist only.

## Phase 50 — Stable AI OS v1 Release Candidate

Implementation: Phase 50.

Release Candidate commands:
| Command | Fungsi |
| --- | --- |
| `/releasecandidate` | Release candidate status and menu |
| `/rc` | Alias for `/releasecandidate` |
| `/v1status` | v1 release status summary |
| `/releasefreeze` | Release freeze status |
| `/readiness` | Module readiness summary |
| `/productionready` | Production readiness gate |
| `/releaseblockers` | Blocker summary |
| `/releaserisks` | Release risk summary |
| `/releasenotes` | Release notes preview |
| `/changelog` | Changelog summary |
| `/envchecklist` | Env names only — no values |
| `/operatorguide` | Operation guide summary |
| `/propose_release` | GitHub release proposal (proposal only) |
| `/propose_release_deploy` | Deploy proposal (proposal only) |

Natural chat phrases:
- "buat release candidate v1" → create RC + run readiness plan
- "cek apakah siap production" → production readiness report
- "apa blocker sebelum release?" → blocker summary
- "buat changelog v1" → changelog summary
- "buat checklist env final" → env names only
- "buat proposal release GitHub" → GitHub release proposal only
- "deploy release candidate" → deploy proposal only
- "abaikan blocker dan release sekarang" → blocked, approval-safe explanation
- "tampilkan env value di release report" → refused/redacted
- "auto deploy v1 tanpa approval" → refused/blocked

All release proposals require Evaluation v2 + executor approval.
No direct GitHub release/tag/deploy from runtime.
No env values, secrets, or tokens displayed in output.

## Phase 49 — Privacy, Data Retention & Export Control

Implementation: Phase 49.

Privacy command registration (planned):
| Command | Fungsi |
| --- | --- |
| `/privacy` | Privacy center menu. |
| `/datainventory` | Data inventory summary. |
| `/retention` | Retention policy overview. |
| `/retention_candidates` | Stale data candidates. |
| `/exportdata` | Request data export. |
| `/exportmanifest` | Preview export manifest. |
| `/archiveold` | Archive old/stale data. |
| `/deleterequest` | Request data deletion. |
| `/privacycheck` | Privacy status check. |
| `/lifeprivacy` | Life OS privacy settings. |
| `/memoryprivacy` | Memory privacy review. |
| `/privacyreport` | Generate privacy report. |
| `/privacyaudit` | Privacy audit log. |

Natural chat phrases:
- "data apa saja yang bot simpan?" → inventory summary
- "export data project saya" → export manifest, strict redaction
- "hapus memory lama" → archive/delete plan
- "hapus semua data saya sekarang" → delete request plan, no hard delete
- "jangan pakai mood note untuk coding" → privacy policy update
- "export Life OS saya" → owner-only export request
- "tampilkan raw DATABASE_URL dari export" → refused/redacted
- "hard delete audit logs sekarang" → blocked/proposal-only

All exports use strict redaction. No secrets exported. No direct hard delete. Archive preferred.

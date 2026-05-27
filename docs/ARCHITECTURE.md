# Arsitektur Bot Telegram AI

## Masalah Utama Saat Ini

- `telebot.js` masih monolit besar, sehingga risiko konflik dan regresi tinggi.
- State runtime global memakai banyak `Map` dan array; tanpa batas ukuran bisa boros RAM di Render free tier.
- Queue user sebelumnya berbasis Promise manual dan bisa bocor karena cleanup memakai asumsi timestamp.
- AI provider belum punya circuit breaker, sehingga provider yang sedang error bisa terus dipanggil.
- Plugin, command handler, AI orchestration, memory, file processing, dan webhook masih bercampur dalam satu file.

## Prioritas Pengembangan

1. Stabilkan runtime: bounded cache, queue per user, circuit breaker AI, cleanup berkala.
2. Pecah modul yang aman: core utility, AI router, memory store, plugin loader, command handlers.
3. Kurangi RAM: batasi memory/chat/knowledge, lazy-load package berat, simpan data panjang di Redis/JSON.
4. Perkuat recovery: graceful shutdown, atomic save, retry terbatas, log terstruktur.
5. Baru setelah stabil, pecah command besar menjadi modul per domain.

## Struktur Folder Tahap 2

```text
core/
  logger.js
  ttl-map.js
  keyed-queue.js
  circuit-breaker.js
config/
  env.js
handlers/
  learning.js
services/
  ai-router.js
utils/
  retry.js
storage/
  json-store.js
plugins/
scheduler/
  cleanup.js
middleware/
  process-guards.js
```

## Modul Yang Sudah Dipisah

- `core/logger.js`
- `core/ttl-map.js`
- `core/keyed-queue.js`
- `core/circuit-breaker.js`
- `config/env.js`
- `utils/retry.js`
- `storage/json-store.js`
- `middleware/process-guards.js`
- `scheduler/cleanup.js`
- `services/ai-router.js`
- `handlers/learning.js`

Modul ini sudah dipakai oleh `telebot.js` tanpa mengubah command Telegram lama.

## Catatan Belajar Tahap 2

- `config/env.js`: satu tempat untuk membaca environment variable. Ini mengurangi bug karena nama env tersebar.
- `utils/retry.js`: retry terbatas untuk API eksternal. Trade-off: request bisa sedikit lebih lama, tetapi error sementara lebih sering pulih.
- `storage/json-store.js`: tulis JSON secara atomic. Risiko yang dikurangi: file rusak jika proses mati saat save.
- `middleware/process-guards.js`: menangkap async error global. Ini membantu bot tetap shutdown dengan rapi.
- `scheduler/cleanup.js`: membersihkan cache dan queue berkala. Ini penting untuk RAM Render free tier.
- `services/ai-router.js`: memilih provider AI yang tersedia saja. Ini mengurangi log error dan request sia-sia.
- `handlers/learning.js`: command edukasi `/belajar`, supaya perubahan teknis bisa dipelajari dari dalam bot.

## Prioritas Berikutnya

1. Pisahkan command handler besar dari `telebot.js` secara bertahap per domain.
2. Pisahkan provider AI menjadi `services/providers/groq.js` dan `services/providers/mistral.js`.
3. Pisahkan memory/context manager agar prompt panjang bisa dikontrol lebih baik.
4. Tambahkan test smoke untuk command penting sebelum deploy.

## Tahap 3: Autonomous AI System

Alur utama sekarang diarahkan ke `src/core/autonomous-engine.js` setelah command Telegram lama selesai diproses.

```text
INPUT
-> Safety Check
-> Context Analysis
-> Selective Memory Loading
-> Intent Analysis / Planner Shortcut
-> Confidence Scoring
-> Tool Selection
-> Planning atau Chat Execution
-> Consensus / Reflection
-> Evaluation
-> Verification
-> Output Sanitization
-> Final Response
```

### Modul Autonomous

- `src/core/autonomous-engine.js`: orchestrator utama untuk workflow autonomous.
- `src/core/task-queue.js`: queue ringan dengan concurrency, idempotency, dan deduplication.
- `src/core/message-bus.js`: shared context sementara antar agen dalam satu request.
- `src/intent/semantic-parser.js`: semantic intent parser dengan confidence threshold.
- `src/action/action-executor.js`: eksekutor tool natural language yang tervalidasi.
- `src/agents/executor.js`: chat/tool executor dan mode belajar/kritis/riset/builder.
- `src/agents/planner.js`: multi-step planning dan goal tracking.
- `src/agents/evaluator.js`: self-review dan scoring kualitas jawaban.
- `src/agents/verifier.js`: confidence scoring dan circular reasoning guard.
- `src/agents/reflection.js`: consensus dan reflection after response.
- `src/agents/learning.js`: correction memory, feedback stats, dan adaptive style.
- `src/agents/recovery.js`: graceful fallback saat pipeline error.
- `src/agents/safety.js`: prompt injection, unsafe action, dan output leak protection.
- `src/agents/memory.js`: memory importance scoring, pruning, context compression.
- `src/memory/advanced-memory.js`: session state dan selective context loading.

### Keputusan Arsitektur

- Router intent dibuat konservatif: tool hanya jalan jika confidence cukup. Trade-off: beberapa perintah natural mungkin dijawab sebagai chat biasa, tetapi risiko tool salah jalan jauh lebih kecil.
- Planner goal kompleks melewati parser intent untuk menghemat satu AI call. Trade-off: heuristic planner harus dijaga agar tidak terlalu luas.
- Queue autonomous tidak memakai rate limit keras karena bot utama sudah punya antispam. Trade-off: queue fokus pada deduplication dan concurrency, sedangkan spam tetap dikontrol di lapisan Telegram.
- Memory diseleksi dan dipangkas sebelum masuk prompt. Trade-off: tidak semua riwayat dibawa, tetapi RAM dan token lebih hemat.
- Reflection dibuat ringan dan bounded. Trade-off: tidak semua jawaban direwrite, tetapi latency dan biaya AI tetap terkendali.

### Risiko Yang Dikurangi

- Tool misuse saat intent ambigu.
- Halusinasi status tool, misalnya mengaku berhasil menjadwalkan padahal gagal.
- Loop respons berulang.
- Prompt injection dari teks atau file.
- Memory leak dari trace dan message bus.
- JSON/session state korup melalui recovery layer.

### Hal Penting Untuk Dipelajari

- Autonomous assistant bukan berarti semua tindakan otomatis dilakukan. Sistem yang aman harus punya confidence threshold dan fallback chat biasa.
- Reasoning pipeline yang baik memisahkan “memahami maksud”, “memilih tool”, “mengeksekusi”, dan “memvalidasi jawaban”.
- Untuk Render free tier, arsitektur ringan lebih penting daripada banyak package berat.
- Multi-step planning harus menyimpan state kecil, bukan seluruh percakapan mentah.

## Tahap 4: Production Agent Platform

Tahap 4 memperkuat sistem agar lebih siap dipakai lama di Render free tier, bukan hanya terlihat pintar saat demo.

### Struktur Produksi

```text
Telegram Webhook
-> Legacy Command Handler
-> Autonomous Engine
-> Task Queue
-> Safety Agent
-> Memory/Context Layer
-> Planner/Tool Router
-> Executor
-> Evaluator
-> Verifier
-> Output Safety
-> Learning + Persistence
```

### Guard Produksi Baru

- Queue overload guard: `TaskQueue` menolak task baru saat antrean penuh.
- Task timeout: task autonomous yang terlalu lama dihentikan dari sisi request agar bot tetap responsif.
- Runtime status: `autonomousEngine.getRuntimeStatus()` menggabungkan queue, agent registry, telemetry, issues, dan error patterns.
- Health JSON: endpoint `/healthz` memberi snapshot produksi tanpa membocorkan token.
- Admin status: command `/system` menampilkan RAM, queue, agent count, dan issue aktif.
- Error pattern database: `ObservabilityAgent` menyimpan pola error berulang agar recovery bisa dianalisis.
- Stale session guard: session multi-step yang terlalu lama otomatis dibersihkan.
- Feedback loop nyata: tombol `positive`/`negative` sekarang masuk ke `LearningAgent`.

### Trade-off Tahap 4

- Queue overload menjaga RAM, tetapi saat traffic tinggi beberapa pesan bisa diminta ulang.
- Task timeout mencegah request menggantung, tetapi task eksternal yang sangat lambat bisa gagal lebih cepat.
- `/healthz` sengaja ringkas agar aman untuk monitoring publik; detail rahasia tetap tidak diekspos.
- Stale session TTL mencegah konteks lama mengganggu user, tetapi rencana yang tidak dilanjutkan berjam-jam akan reset.
- Error pattern disimpan in-memory agar ringan; setelah Render restart, histori diagnostik lama hilang.

### Apa Yang Diamati Setelah Deploy

1. Render logs: cari event `QUEUE_PRESSURE`, `TASK_TIMEOUT`, atau `PIPELINE_FAILURE_TRIGGERED`.
2. Endpoint `/healthz`: pastikan `status` tetap `HEALTHY` dan RAM RSS wajar.
3. Command `/system`: cek queue tidak menumpuk dan issue tidak berulang.
4. Respons natural language: pastikan tool hanya jalan saat intent jelas.
5. Feedback tombol: pantau apakah koreksi dan feedback mulai mengubah gaya respons user.

## Tahap 5: Self-Improving AI & Adaptive Intelligence

Tahap 5 menambahkan loop peningkatan diri yang ringan. Tujuannya bukan membuat bot “belajar liar”, tetapi memberi sistem cara terukur untuk melihat kualitas jawaban sebelumnya dan menyesuaikan prompt berikutnya secara aman.

### Alur Reflective Reasoning

```text
INPUT
-> Intent Analysis
-> Context Analysis
-> Planning / Tool Decision
-> Reasoning / Chat Execution
-> Draft Answer
-> Evaluation
-> Verification
-> Confidence + Risk Check
-> Final Answer
-> Self-Improvement Update
-> Memory Evolution
```

### Modul Baru

- `src/agents/self-improvement.js`: menghitung Answer Quality, Reasoning, Confidence, Tool Accuracy, Memory Relevance, User Satisfaction, Consistency, Risk, Clarity, Learning Impact, dan Latency Efficiency.
- `src/core/autonomous-engine.js`: menyisipkan self-improvement hints ke prompt dan mencatat hasil jawaban setelah response dikirim.
- `src/agents/executor.js`: menerima sinyal adaptif, mode pipeline, dan konteks file dalam prompt final.
- `telebot.js`: menambahkan `/improve`, mode `refleksi`, `deep`, `mentor`, `optimasi`, serta feedback user ke self-improvement loop.

### Memory Evolution

Self-improvement memory disimpan per user sebagai:

- `reasoningHistory`: histori metrik terbatas.
- `learningMemory`: catatan pelajaran penting dari kualitas rendah, tool gagal, atau konteks kurang relevan.
- `failureHistory`: pola kegagalan terbaru.
- `promptHints`: sinyal adaptif untuk jawaban berikutnya.
- `rollbackSnapshot`: baseline prompt hints untuk rollback jika learning menjadi tidak stabil.

Semua list dibatasi ukurannya agar aman untuk Render free tier.

### Safety & Rollback

- Low-quality dan high-risk answer dicatat sebagai failure pattern.
- Jika kegagalan berulang, prompt hints dikembalikan ke snapshot awal.
- Feedback negatif tidak langsung mengubah seluruh perilaku; ia hanya memberi sinyal clarity, confidence, dan risk.
- Sistem tidak menjalankan AI call tambahan untuk evaluasi, sehingga biaya token dan latency tetap rendah.

### Trade-off Tahap 5

- Evaluasi berbasis heuristic lebih hemat dan stabil, tetapi tidak sedalam evaluator berbasis LLM.
- Self-improvement hints membuat jawaban lebih adaptif, tetapi terlalu banyak sinyal bisa membuat prompt panjang; karena itu sinyal dibuat pendek.
- Rollback sederhana mengurangi risiko unstable learning, tetapi belum menyimpan versi historis lengkap.
- Feedback user sangat berguna, tetapi bisa noisy; karena itu hanya dipakai sebagai sinyal, bukan kebenaran mutlak.

### Apa Yang Diamati Setelah Deploy

1. Jalankan `/improve` sebagai admin setelah beberapa percakapan untuk melihat score dan learning notes.
2. Perhatikan apakah feedback negatif membuat jawaban berikutnya lebih jelas dan lebih berhati-hati.
3. Pantau Render logs untuk `SelfImprovementAgent` dan `LEARNING_UPDATE_FAILED`.
4. Cek RAM di `/system`; self-improvement history harus tetap kecil.
5. Uji bahasa campuran, misalnya Jepang/Inggris/Indonesia, dan pastikan bot mengikuti bahasa dominan user.

## Tahap 6: Multi-Agent Intelligence System

Tahap 6 memperkuat bot dari adaptive single-agent menjadi ekosistem agent kolaboratif. Fokusnya adalah pembagian peran, komunikasi internal, consensus, observability, dan collaborative memory yang tetap ringan untuk Render free tier.

### Struktur Multi-Agent

```text
Telegram Input
-> Intent Analysis
-> Agent Coordinator
-> Delegation Plan
-> Safety Agent
-> Memory Agent
-> Executor / Planner
-> Research Agent
-> Reasoning Agent
-> Reflection Agent
-> Evaluator + Verifier
-> Final Response
-> Learning + Collaborative Memory
```

### Agent Communication Layer

- `src/core/agent-coordinator.js`: registry agent, role management, dynamic routing, delegation plan, workflow scoring, dan collaborative memory persistence.
- `src/core/message-bus.js`: shared context per request, agent message, timeline, memory access analytics, opinion metadata, dan conflict record.
- `src/agents/reflection.js`: consensus builder yang membaca confidence tiap agent, memilih opini utama secara aman, dan memberi consensus metrics.
- `src/agents/observability.js`: menyimpan analytics workflow kolaboratif seperti agent activity, average consensus, dan latency.

### Role Tiap Agent

- Planner Agent: memecah goal kompleks dan membuat workflow.
- Research Agent: mengumpulkan evidence dari memori lokal dan memberi evidence strength.
- Reasoning Agent: mengevaluasi asumsi, bias, trade-off, dan kualitas logika.
- Verifier Agent: cek confidence, circular reasoning, dan output yang terlalu lemah.
- Memory Agent: memilih konteks relevan, compression, dan memory access record.
- Tool Router Agent: validasi tool dan audit eksekusi.
- Safety Agent: validasi input, action gating, prompt injection guard, dan output sanitization.
- Reflection Agent: consensus building, conflict handling, dan final synthesis.
- Learning Agent: belajar dari koreksi dan feedback.
- Observability Agent: tracing, diagnostics, collaboration analytics, dan anomaly signal.

### Consensus Mechanism

Consensus tidak lagi hanya mengambil opini terakhir. Sistem menghitung:

- Agent Performance Score
- Consensus Confidence Score
- Reasoning Quality Score
- Tool Accuracy Score
- Memory Relevance Score
- Collaboration Efficiency Score
- Verification Reliability Score
- Safety Confidence Score
- Evidence Strength Score
- Critical Thinking Score

Jika conflict tinggi atau confidence rendah, Reflection Agent memberi sintesis yang lebih hati-hati. Jika agent sejalan, opini Reasoning/Executor diprioritaskan sebagai final synthesis.

### Shared Memory System

Collaborative memory disimpan per user dalam bentuk terbatas:

- `collaborativeMemory.history`: riwayat workflow kompleks.
- `collaborativeMemory.agentPerformance`: rata-rata performa agent.
- `collaborativeMemory.sharedKnowledge`: catatan ringkas consensus/evidence/reasoning.

Data ini dibatasi agar tidak membengkak di Render free tier.

### Mode Multi-Agent

- `/mode kolaborasi`: multi-perspective reasoning dan evaluasi silang.
- `/mode research-intelligence`: evidence dan confidence analysis.
- `/mode mentor-intelligence`: penjelasan cara berpikir dan critical thinking.
- `/mode strategis`: goal decomposition dan workflow optimization.
- `/mode system-analysis`: architecture, bottleneck, reliability, dan stability review.

### Trade-off Tahap 6

- Multi-agent hanya aktif pada mode/permintaan kompleks. Trade-off: request sederhana tetap cepat, tetapi analisis biasa tidak selalu memakai semua agent.
- Shared memory dibuat ephemeral per request lalu dipersist ringkas. Trade-off: hemat RAM, tetapi audit detail lama tidak disimpan penuh.
- Consensus score memakai heuristic ringan. Trade-off: murah dan stabil, tetapi belum sedalam judge LLM khusus.
- Agent registry statis lebih aman untuk production. Trade-off: dynamic plugin-agent penuh bisa ditambahkan nanti, tetapi belum dibuka agar tidak rawan misuse.

### Risiko Yang Dikurangi

- Agent loop berulang melalui `maxIterations`.
- Tool salah jalan melalui safety gating dan confidence threshold.
- Conflict antar agent melalui Reflection Agent.
- Memory leak melalui cleanup context dan bounded timeline.
- Workflow tidak terlihat melalui distributed tracing dan `/system` analytics.

### Hal Penting Untuk Dipelajari

Multi-agent system yang baik bukan berarti semua agent selalu aktif. Prinsip utamanya adalah routing selektif: aktifkan agent tambahan hanya saat nilai analisisnya lebih besar dari biaya latency, token, dan kompleksitas.

## Tahap 7: Multimodal Intelligence System

Tahap 7 mengubah bot dari text-only agent menjadi multimodal assistant yang bisa membaca attachment dan menggabungkannya dengan pesan user, memory, dan reasoning pipeline.

### Alur Multimodal

```text
INPUT ATTACHMENT
-> Content Type Detection
-> Safety + Integrity Check
-> Parsing / Vision / OCR Fallback
-> Chunking + Extraction
-> Semantic Tagging
-> File Cache + File Memory Index
-> Cross-Modal Context Builder
-> Reasoning + Grounded Answer
-> Verification + Citation Guard
-> Learning Update
```

### Modul Multimodal

- `src/multimodal/file-handler.js`: klasifikasi format, size guard, integrity check, chunking, semantic tag, citation, compression, dan hash cache.
- `src/multimodal/document-parser.js`: parsing PDF/dokumen teks, key point extraction, facts vs inferences, confidence, dan limitation warning.
- `src/multimodal/image-vision.js`: pipeline vision dengan fallback metadata dan OCR hook ringan.
- `src/multimodal/data-interpreter.js`: parsing CSV/TSV/Excel/JSON, sample rows, statistik sederhana, empty-value insight, dan data citation.
- `src/multimodal/cross-modal-engine.js`: ranking file relevan, context merging, evidence scoring, source attribution, citation mismatch guard, dan low-confidence annotation.
- `src/agents/memory.js`: attachment memory store, recent file context retrieval, dan file index terbatas per user.

### Mode Multimodal

- `/mode document-analysis`: fokus ringkasan, poin penting, Q&A dokumen, fakta/inferensi.
- `/mode visual-analysis`: fokus gambar, deskripsi visual, OCR fallback, dan batasan pembacaan.
- `/mode data-understanding`: fokus tabel, pola data, statistik dasar, dan risiko sampling.
- `/mode cross-modal`: menggabungkan chat + file + memory untuk jawaban terpadu.
- `/mode research-file`: validasi isi file, evidence, citation, confidence, dan keterbatasan.

### Source Grounding

Jawaban berbasis file diberi konteks:

- `sourceCitations`: rujukan chunk unik seperti `[file:1.1]`, `[image:1.1]`, atau `[data:1.1]`.
- `sourceAttribution`: label file/chunk untuk laporan sumber.
- `mergedEvidence`: evidence ringkas yang paling relevan terhadap pertanyaan user.
- `limitations`: batasan parsing, OCR, truncation, confidence rendah, atau format tidak terbaca.

Jika jawaban membahas file tetapi tidak menyebut sumber, `CrossModalEngine` menambahkan catatan sumber file secara otomatis.

### Trade-off Tahap 7

- Parsing dibatasi ukuran dan jumlah chunk. Trade-off: hemat RAM/token, tetapi dokumen sangat panjang hanya dianalisis dari bagian paling relevan.
- OCR lokal belum dipasang karena berat untuk Render free tier. Trade-off: gambar tetap bisa diproses dengan vision API jika tersedia, atau fallback metadata jika belum.
- PDF memakai `pdf-parse` secara lazy. Trade-off: startup tetap cepat, tetapi PDF corrupt atau parser gagal akan diberi limitation.
- Cache file berbasis hash mengurangi parsing ulang. Trade-off: memory file harus dibatasi agar tidak membengkak.
- Citation guard memakai heuristic ringan. Trade-off: cepat dan murah, tetapi belum setajam verifier berbasis LLM khusus.

### Risiko Yang Dikurangi

- Prompt injection dari isi dokumen melalui `SafetyAgent.validateFileContent`.
- File rusak atau salah format melalui integrity check.
- Halusinasi analisis file melalui source citation dan grounding guard.
- Parsing ulang file yang sama melalui content hash cache.
- Memory pollution melalui file index dan semantic memory yang dibatasi.
- Token berlebih melalui chunk compression dan selective file context.

### Hal Penting Untuk Dipelajari

Multimodal AI yang aman tidak cukup hanya “membaca file”. Sistem harus tahu sumber klaimnya, confidence pembacaan, bagian yang tidak terbaca, dan kapan harus menolak menebak. Alur berpikir yang benar adalah: baca data yang tersedia, pisahkan fakta dari inferensi, beri rujukan, lalu jelaskan batasan.

## Tahap 8: Governance Intelligence & Autonomous Control

Tahap 8 menambahkan lapisan kendali di atas autonomous agent. Tujuannya adalah memisahkan kemampuan AI untuk memahami permintaan dari izin untuk menjalankan aksi.

### Governance Workflow

```text
INPUT
-> Intent Validation
-> Context Integrity Check
-> Risk Assessment
-> Policy Validation
-> Permission Validation
-> Planning
-> Tool Safety Review
-> Execution Simulation
-> Controlled Execution
-> Reflection
-> Audit Logging
-> Governance Feedback Update
-> Persist Safe State
```

### Modul Governance

- `src/governance/policy-engine.js`: daftar policy per intent/capability, risk level, approval requirement, admin requirement, dan batas risk score.
- `src/governance/permission-engine.js`: role-based access control sederhana: `owner`, `admin`, dan `user`.
- `src/governance/risk-assessment.js`: dynamic risk scoring, context trust scoring, suspicious context detection, destructive language detection, dan sensitive-data signal.
- `src/governance/safety-validator.js`: decision reviewer yang menggabungkan policy, permission, risk, simulation, approval, dan safe fallback.
- `src/governance/approval-layer.js`: human oversight untuk aksi sensitif dengan format `konfirmasi <id>`.
- `src/governance/rollback-controller.js`: snapshot kecil sebelum aksi yang mengubah state lokal, lalu rollback jika eksekusi gagal.
- `src/governance/audit-logger.js`: decision audit trail, tool execution log, memory mutation log, dan governance analytics.
- `src/governance/explainability.js`: penjelasan keputusan, risk, policy, confidence, dan trade-off.
- `src/governance/index.js`: router utama governance agar orchestrator tidak bergantung pada detail tiap module.

### Autonomous Control System

Sebelum tool berjalan, `AutonomousEngine` sekarang membuat `governanceDecision`:

- `ALLOW`: aksi aman dan bisa berjalan.
- `CONTROLLED_EXECUTION`: aksi boleh berjalan karena sudah dikonfirmasi atau masih dalam batas policy, tetapi tetap diaudit.
- `APPROVAL_REQUIRED`: aksi ditahan sampai user mengetik `konfirmasi <id>`.
- `SAFE_FALLBACK`: bot menjawab sebagai percakapan biasa, tanpa tool execution.
- `BLOCKED`: aksi ditolak karena permission, context, simulation, atau risk terlalu bermasalah.

### Policy & Risk

Contoh policy:

- `HITUNG`, `JAM`, `TANGGAL`: low risk, read-only/lokal.
- `SEARCH`, `GAMBAR`: medium risk, memakai provider eksternal.
- `TAMBAH_TUGAS`, `TAMBAH_PENGINGAT`: medium risk, mengubah state user.
- `TAMBAH_EVENT`: high risk, menulis ke Google Calendar, butuh approval.
- `RELOADPLUGINS`, `RESET_SYSTEM`, `BAN_MEMBER`: high/critical, butuh admin dan approval.

Risk score mempertimbangkan intent, confidence parser, context trust, attachment, bahasa destruktif, dan sinyal data sensitif.

### Audit & Explainability

Governance menyimpan audit yang terbatas agar aman di Render free tier:

- decision audit trail
- tool execution governance log
- memory modification log
- risk level analytics
- blocked/approval count

`/system` menampilkan ringkasan governance audit, blocked count, dan approval request count tanpa membocorkan parameter sensitif.

### Rollback & Recovery

Untuk aksi yang mengubah state lokal seperti todo, reminder, mood, atau session, sistem membuat recovery snapshot kecil sebelum execution. Jika tool gagal, snapshot terakhir bisa dipulihkan agar state lokal tidak setengah berubah.

### Trade-off Tahap 8

- Approval untuk aksi sensitif menambah satu langkah, tetapi mencegah autonomous write yang tidak disengaja.
- Risk scoring dibuat heuristic agar hemat RAM/token. Trade-off: tidak sedalam LLM judge, tetapi lebih cepat dan stabil.
- Audit log dibatasi in-memory. Trade-off: ringan untuk Render, tetapi histori audit lama hilang saat restart.
- Rollback hanya untuk state lokal. Aksi eksternal seperti Google Calendar tetap perlu verifikasi provider karena tidak semua API mudah di-rollback otomatis.
- Policy registry statis lebih aman daripada policy dinamis dari prompt. Trade-off: menambah policy baru harus lewat kode.

### Hal Penting Untuk Dipelajari

Autonomous AI yang aman harus punya batas: policy menentukan apa yang boleh, permission menentukan siapa yang boleh, risk assessment menentukan seberapa berbahaya, approval memberi kontrol manusia, audit membuat keputusan bisa diperiksa, dan rollback membuat kegagalan bisa dipulihkan.

## Phase 9 - Unified AI Operating System

Tahap 9 menambahkan layer `src/ai-os/` sebagai Mini AI Operating System yang persistent, context-aware, dan tetap ringan untuk Render free tier. Layer ini tidak mengganti command lama; ia menambah persistent cognition di atas autonomous engine.

### AI OS Workflow

```text
INPUT
-> Context Synchronization
-> Goal Alignment
-> Memory Graph Retrieval
-> Strategic Planning bila perlu
-> Multi-Agent Collaboration bila perlu
-> Research & Reasoning bila perlu
-> Reflection
-> Workflow Update
-> Knowledge Graph Evolution
-> Learning Update
-> Persistent State Sync
-> Final Response
```

### Modul AI OS

- `src/ai-os/cognitive-core.js`: orchestrator utama yang memilih layer aktif berdasarkan kompleksitas input.
- `src/ai-os/context-sync.js`: selective context activation untuk memory, goals, workflows, graph, dan insights.
- `src/ai-os/memory-bus.js`: global memory bus untuk publish, retrieve, update, prune, dan insight memory.
- `src/ai-os/unified-memory.js`: persistent memory per user dengan type, confidence, importance, deduplication, pruning, dan compression.
- `src/ai-os/goal-manager.js`: long-term goal management dengan progress, priority, milestone, dan workflow attachment.
- `src/ai-os/workflow-engine.js`: workflow multi-hari/multi-minggu dengan step tracking dan context summary.
- `src/ai-os/knowledge-graph.js`: graph ringan untuk concept node, relationship edge, ranking, dan graph summary.
- `src/ai-os/semantic-relationship-engine.js`: heuristic relationship detection tanpa AI call tambahan.
- `src/ai-os/strategic-reasoning.js`: fact/inference/speculation split, assumption, risk, trade-off, next action, dan confidence.
- `src/ai-os/reflection-engine.js`: answer quality check, weak reasoning detection, insight extraction, dan reflective memory.
- `src/ai-os/meta-reasoning.js`: memilih kapan cukup jawaban sederhana dan kapan perlu AI OS layer.
- `src/ai-os/personal-intelligence.js`: personal layer berbasis memory tersimpan, tanpa mengarang profil user.
- `src/ai-os/research-intelligence.js`: persistent research session, evidence synthesis, confidence, dan source summary.
- `src/ai-os/cognitive-workspace.js`: workspace untuk ide, catatan, project thinking, dan link ke goal/workflow/graph.
- `src/ai-os/learning-evolution.js`: belajar dari koreksi, feedback, dan insight.
- `src/ai-os/cognitive-analytics.js`: observability ringan: memory, goal, workflow, graph, confidence, insight, stale item.
- `src/ai-os/guards.js`: overload prevention, prompt injection memory guard, corruption recovery, stale cleanup, dan low-confidence action guard.

### Command Baru

- `/aios`: status ringkas AI OS.
- `/goals`, `/goaladd`, `/goalupdate`: goal management.
- `/workflows`, `/workflowadd`, `/workflowstep`, `/workflowdone`: workflow persistence.
- `/graph`: ringkasan knowledge graph.
- `/insights`: insight penting terakhir.
- `/workspace`, `/workspaceadd`: cognitive workspace.
- `/reflect`: reflection strategis ringan.
- `/strategy`: strategic reasoning deterministik.
- `/aios-reset`: reset data AI OS user, tanpa menghapus memory lama bot.

### Mode Baru

- `strategic-thinking`: roadmap, trade-off, risk analysis, dan next action.
- `personal-intelligence`: adaptasi berbasis memory tersimpan.
- `deep-research-os`: evidence synthesis, confidence, dan research continuity.
- `cognitive-workspace`: organisasi ide, project thinking, dan graph.
- `meta-reasoning`: evaluasi strategi berpikir AI dan batasan pendekatan.

### Trade-off Tahap 9

- AI OS memakai heuristic dulu agar hemat RAM/token. Trade-off: tidak sedalam LLM planner penuh, tetapi lebih stabil dan murah.
- Memory disimpan di `userMemory[id].aios`. Trade-off: deployment mudah dan kompatibel, tetapi untuk skala besar nanti perlu database khusus.
- Knowledge graph dibatasi jumlah node/edge per user. Trade-off: graph tidak tak terbatas, tetapi mencegah memory leak.
- Reflection berjalan setelah respons dan tidak memblokir user. Trade-off: insight update bisa terlambat beberapa milidetik, tetapi respons Telegram tetap cepat.
- Personal intelligence hanya memakai memory tersimpan. Trade-off: adaptasi lebih konservatif, tetapi menghindari profil palsu.

### Hal Penting Untuk Dipelajari

AI OS yang sehat bukan berarti semua layer aktif setiap saat. Kuncinya adalah selective activation: pertanyaan sederhana tetap sederhana, sementara goal, research, workflow, dan keputusan strategis mendapat memory, graph, reflection, dan analytics tambahan.

## Phase 9 Part 2 - Cognitive Graph, Workflow, And Strategic Intelligence

Part 2 memperkuat AI OS agar lebih berguna sebagai persistent cognitive infrastructure, bukan hanya status layer.

### Knowledge Graph System

Graph tetap ringan dan persistent di `userMemory[id].aios.graph`. Node dibatasi per user dan punya:

- `type`: project, concept, person, topic, goal, workflow, insight, evidence, decision, risk, assumption.
- `seenCount`: menghitung berapa kali konsep muncul.
- `evolution`: catatan pendek perubahan/kemunculan konsep.
- `importance`, `confidence`, `lastSeenAt`: dipakai untuk ranking dan stale cleanup.

Edge mendukung relasi:

- `related_to`, `supports`, `contradicts`, `depends_on`, `part_of`, `improves`, `blocks`, `belongs_to_project`, `linked_to_goal`, `derived_from`, `evidence_for`.

Graph dipakai oleh `/graph`, `context-sync`, goal/workflow linking, dan research evidence linking. Stale cleanup menghapus node lama dengan importance rendah supaya RAM tetap aman.

### Persistent Workflow System

Workflow sekarang menyimpan:

- step dan status selesai
- `contextSummary`
- `decisionLog`
- `blockers`
- `nextAction`
- link ke goal dan memory
- stale/conflict detection
- completion ratio

Workflow tidak menjalankan aksi sensitif otomatis. Ia hanya menyimpan state dan memberi next action; eksekusi tetap melewati governance/tool layer.

### Long-Term Goal System

Goal menyimpan dependency, risk note, linked memory, linked graph node, dan strategic reflection. Goal reasoning mengevaluasi feasibility, risk, dependency, milestone, next action, dan confidence.

### Strategic Reasoning Engine

Output `/strategy` sekarang terstruktur:

- Ringkasan masalah
- Tujuan
- Fakta diketahui
- Asumsi
- Inferensi
- Spekulasi
- Risiko
- Trade-off
- Opsi
- Rekomendasi
- Next action
- Evidence quality
- Mental model
- Confidence

Ini dibuat deterministic agar murah dan cepat. Jika butuh fakta terbaru, research/search layer tetap harus dipakai.

### Cognitive Analytics

`/aios` dan `/system` sekarang membaca statistik tambahan:

- memory count dan memory by type
- active goals/workflows
- graph nodes/edges
- stale goals/workflows
- workflow conflicts
- workflow completion ratio
- research memory count
- reflection count
- average confidence

### Trade-off Part 2

- Graph heuristic lebih murah daripada embedding/vector DB, tetapi relasi tidak selalu sesempurna semantic model.
- Workflow menyimpan decision/blocker tanpa worker otomatis agar tidak terjadi runaway autonomous behavior.
- Goal strategic reflection dibuat ringan agar bisa berjalan tanpa AI call tambahan.
- Evidence linking ke graph membantu audit, tetapi hanya sekuat evidence yang diberikan user/search.

### Manual Test

```bash
node --check telebot.js
node scratch/test-aios.js
npm run check
```

Command Telegram yang perlu dicoba:

```text
/aios
/goaladd Belajar backend | Roadmap 30 hari | high
/goals
/workflowadd Minggu 1 backend | Express, API, database | <goalId>
/workflowstep <workflowId> | Pelajari middleware Express
/workflowdone <workflowId> | 1
/workflowdecision <workflowId> | Mulai dari Express sebelum database
/workflowblocker <workflowId> | Belum memilih database latihan
/workflownext <workflowId> | Pilih database latihan
/graph
/workspaceadd Ide backend | Catatan belajar dan project thinking
/workspace
/reflect Belajar backend terlalu luas, apa risiko utamanya?
/strategy Saya ingin belajar backend selama 30 hari sambil membuat project
```

## Phase 10 - AI Production Ecosystem

Tahap 10 menambahkan `src/ops` sebagai AI Operations Layer ringan. Tujuannya bukan membuat bot lebih berat, tetapi membuat perilaku production bisa dipantau, diuji, dibandingkan, dan dipulihkan dengan aman.

### Modul Utama

- `health-monitor`: uptime, RAM, heap, queue, provider, Redis/webhook, dan recent errors.
- `telemetry-collector`: request, command, AI call, tool, latency, token estimate, dan error secara compact.
- `diagnostics-engine`: membedakan masalah model, tool, memory, workflow, infra, config, dan input user.
- `benchmark-engine`: benchmark ringan manual untuk regression prevention.
- `incident-handler`: klasifikasi info, warning, degraded, incident, dan critical.
- `recovery-controller`: recovery non-destruktif seperti prune ops cache, pause evaluation, dan fallback recommendation.
- `performance-profiler`: latency per operasi dan bottleneck ringkas.
- `cost-optimizer` dan `token-analyzer`: estimasi token, token spike, dan rekomendasi efisiensi.
- `reliability-scorer`: skor reliability 0-100 dari memory, error, provider, queue, latency, cost, dan safety.
- `regression-detector`: membandingkan benchmark/telemetry terbaru dengan baseline.
- `rollback-manager`: membuat rollback plan manual tanpa git rollback otomatis.
- `tuning-controller`: rekomendasi setting tanpa auto-apply agresif.
- `canary-controller`: canary draft/off by default.
- `evaluation-scheduler`: evaluasi manual/light agar aman untuk Render free tier.
- `ops-knowledge-base`: lesson, fix recipe, deployment checklist, rollback checklist.
- `ops-workflow`: workflow adaptif dari health check sampai operational learning.

### Command Admin

```text
/ops
/health
/perf
/cost
/tokens
/benchmark [type]
/benchmarkfull
/benchmarks
/diag atau /diagnose
/incidents
/incident <id>
/recover
/recover confirm <action>
/reliability
/regression
/rollbackplan [alasan]
/tuning
/opslessons
/opskb <query>
/canary
/canary create <nama> | <deskripsi>
/canary rollback <id>
/ops-reset atau /opsreset
```

### Trade-off

- Telemetry dibatasi agar hemat RAM. Dampaknya, data historis tidak sedetail observability platform besar.
- Benchmark dibuat deterministic dan ringan. Dampaknya, benchmark tidak menggantikan evaluasi kualitas AI berbasis manusia.
- Recovery tidak destruktif otomatis. Dampaknya, beberapa masalah tetap perlu keputusan admin, tetapi risiko salah recovery jauh lebih rendah.
- Canary default `draft/off`. Dampaknya, rollout tidak otomatis, tetapi aman untuk bot personal di Render free tier.
- Workflow ops adaptif: pesan biasa hanya mencatat telemetry ringan, sementara benchmark, diagnostics, dan recovery berjalan lewat command atau jadwal ringan.

### Manual Test

```bash
node --check telebot.js
node scratch/test-ops.js
npm run check
```

## Phase 10 Part 2 - Reliability, Cost, Regression, And Adaptive Ops

Part 2 melengkapi AI Operations Layer agar bukan hanya menampilkan status, tetapi juga membantu membaca kualitas produksi dari waktu ke waktu.

### Reliability Scoring

`src/ops/reliability-scorer.js` sekarang menghitung 12 faktor:

- uptime
- recovery success
- reasoning consistency
- response quality
- safety
- latency
- cost efficiency
- memory efficiency
- tool success
- user satisfaction proxy
- regression risk
- stability trend

Output `/reliability` menampilkan overall score, strongest area, weakest area, top risks, recommended fixes, dan trend. Heuristic dibuat sederhana supaya mudah diaudit dan tidak membutuhkan AI call tambahan.

### Cost And Resource Optimization

`cost-optimizer`, `token-analyzer`, dan `resource-analyzer` sekarang membaca:

- estimasi token prompt/output dan top expensive operation
- memory count, graph size, stale item, telemetry size
- ukuran ops data, benchmark history, incident history
- workflow aktif, completion ratio, dan stuck workflow

Rekomendasi yang diberikan sengaja berupa saran, bukan perubahan otomatis. Ini menjaga stabilitas Render free tier karena tuning besar tetap dikontrol admin.

### Regression Detection

`regression-detector` membandingkan benchmark terbaru dengan baseline dan telemetry ringan. Sinyal yang dicek:

- skor benchmark turun
- latency p90 naik
- error spike
- tool success rate turun
- memory retrieval tidak tercatat
- token/cost spike

Output `/regression` memberi metric, baseline, current value, delta, possible cause, dan recommendation.

### A/B Testing And Canary

`src/ops/ab-testing.js` menyediakan experiment ringan untuk assignment dan metric comparison. `canary-controller` tetap default draft/off, lalu admin bisa:

- membuat canary
- mencatat metric
- membandingkan canary dengan baseline sederhana
- promote hanya jika sample cukup
- rollback manual

Canary tidak memengaruhi user otomatis kecuali nanti diaktifkan secara eksplisit di behavior routing.

### Adaptive Ops And Guards

`adaptive-ops` dan `ops-guards` menambahkan:

- dynamic threshold recommendation
- incident pattern learning
- prioritized fixes
- smart rollback recommendation
- incident escalation guard
- unstable tuning guard
- unsafe optimization blocker
- runaway cost prevention
- regression rollback guard
- diagnostics/recovery loop prevention
- corrupted telemetry fallback
- false positive suppression

Prinsipnya: sistem boleh belajar dari telemetry, tetapi tidak boleh mengubah konfigurasi penting secara agresif.

### Cara Membaca Data Ops

- `/health`: cek status dasar dan provider.
- `/ops`: baca ringkasan health, reliability, benchmark, incident, dan tuning.
- `/reliability`: lihat faktor terlemah sebelum menambah fitur baru.
- `/cost` dan `/tokens`: lihat token spike, storage ops, dan workflow yang mulai membebani.
- `/regression`: cek apakah perubahan terbaru menurunkan skor atau menaikkan latency/error.
- `/recover`: lihat tindakan recovery aman; aksi destruktif tetap harus manual.

### Catatan Render Free Tier

- Telemetry dipruning dan disampling agar tidak membesar.
- Benchmark berjalan manual, bukan setiap pesan.
- Recovery otomatis dibatasi pada aksi non-destruktif.
- Canary dan tuning default rekomendasi, bukan auto-change.
- Jika modul ops gagal, bot lama tetap fallback ke pipeline utama.

## Final: Human-AI Cognitive Operating System

Final architecture menggabungkan bot Telegram lama, AI OS, Ops, adaptive routing, collaboration framework, dan storage production yang tetap punya fallback aman.

### Storage Production

Folder `src/storage` menambahkan:

- `database.js`: koneksi PostgreSQL optional lewat package `pg`.
- `migrations.js`: schema production untuk users, adaptive_profiles, memories, goals, workflows, workflow_steps, insights, graph_nodes, graph_edges, reflections, research_sessions, workspace_notes, telemetry_events, incidents, benchmark_runs, ops_lessons, dan `bot_kv`.
- `postgres-store.js`: persistent store PostgreSQL dengan migrasi otomatis dan key-value compatibility layer.
- `redis-store.js`: Redis cache jika `REDIS_URL` tersedia, fallback memory cache jika tidak.
- `storage-manager.js`: memilih PostgreSQL jika `DATABASE_URL` aktif, fallback JSON jika gagal/tidak tersedia, dan tetap menjaga cache Redis/memory.

Bot lama tetap memakai fungsi `loadData` dan `saveData`, tetapi jalurnya sekarang melewati `storage-manager`. Ini membuat data lama tetap kompatibel sambil membuka jalan ke PostgreSQL.

### Adaptive Mode Router

Folder `src/adaptive` menambahkan:

- `adaptive-mode-router`: memilih mode dari intent natural user.
- `intent-complexity-detector`: menilai kompleksitas tanpa AI call.
- `user-context-profiler`: membaca mode, goal, workflow, dan preferensi tersimpan.
- `adaptive-memory-selector`: memilih memory hint secukupnya.
- `response-style-adapter`: membuat prompt hint pendek.
- `adaptive-guards`: high-stakes guard, manual override, dan fallback low confidence.

Priority mode:

1. Safety/governance
2. Explicit command
3. Manual `/mode` override
4. Adaptive auto mode
5. Default simple assistant

Command baru:

```text
/adaptive
/adaptive status
/adaptive on
/adaptive off
/adaptive reset
```

### Human-AI Collaboration

Folder `src/collaboration` menambahkan framework berpikir ringan:

- thinking partner
- strategic thinking
- decision support
- mental model
- learning plan
- critical thinking
- reflection
- insight and journal
- collaboration analytics
- human judgment guard

Command baru:

```text
/think <masalah>
/learnplan <topik>
/mentalmodel <konsep>
/decision <keputusan>
/blindspot <rencana>
/assumptions <argumen>
/perspectives <masalah>
/insight <catatan>
/journal [catatan]
/collab
/collab-reset
```

Command `/strategy` dan `/reflect` tetap tersedia dari AI OS agar compatibility lama tidak rusak.

### Cognitive Workflow

Alur pesan natural sekarang:

```text
Telegram input
-> command compatibility check
-> adaptive mode detection jika bukan command
-> selective memory/context
-> AI OS jika relevan
-> governance and safety
-> autonomous/multi-agent pipeline
-> reflection/self-improvement
-> ops telemetry
-> safe response
```

Pertanyaan sederhana tidak memicu semua layer. Adaptive router hanya memberi sinyal mode dan prompt hint pendek.

### Multi-Device UX Mode

Setiap jawaban AI melewati dua lapisan UX ringan:

- `src/ux/multi-device-response.js` menyimpan aturan format lintas perangkat.
- `getSystemPrompt()` menyuntikkan aturan agar AI menulis jawaban yang nyaman di HP, tablet, laptop, desktop, Telegram mobile, Telegram desktop, dan web client.
- `response-style-adapter` menambahkan hint mobile-friendly saat adaptive mode aktif.
- `sanitizeOutgoingText()` menormalisasi blank line dan trailing space sebelum pesan dikirim.

Prinsipnya:

- inti jawaban muncul dulu;
- paragraf pendek;
- bullet sederhana;
- section kecil untuk jawaban panjang;
- code block tetap rapi;
- tidak memakai tabel besar atau nested bullet dalam kecuali sangat perlu.

Trade-off: sistem tidak memaksa hard wrap per baris karena itu bisa merusak URL, code block, dan format Telegram. Responsiveness terutama dikendalikan lewat prompt dan normalisasi spacing.

### Conversation Continuity Layer

Pesan non-command sekarang melewati `src/conversation/` sebelum adaptive mode dan autonomous engine.

```text
Telegram input
-> command lama tetap prioritas
-> pending action check
-> follow-up detector
-> topic shift detector
-> clarification handler jika konteks kurang
-> adaptive mode
-> autonomous / normal chat answer
-> record context window + infer pending action baru
```

Modul:

- `conversation-manager.js`: orchestrator ringan untuk pending action, context window, follow-up, dan fallback.
- `pending-actions.js`: menyimpan action sementara per user/chat dengan TTL.
- `followup-detector.js`: mendeteksi `iya`, `tidak`, `lanjut`, `jelaskan`, dan referensi pendek tanpa LLM.
- `topic-shift-detector.js`: membatalkan pending action jika user jelas mengganti topik.
- `context-window.js`: menyimpan beberapa pesan terakhir, topik aktif, intent terakhir, dan summary ringkas.
- `clarification-handler.js`: meminta klarifikasi saat follow-up terlalu ambigu.
- `continuation-handler.js`: membuat instruksi continuity agar AI tidak mengulang tawaran lama.
- `conversation-guards.js`: helper deterministic untuk token, overlap, topic, dan guard.

Edge case penting:

- `iya` tanpa pending action tidak dipaksa menjadi follow-up; pesan diproses sebagai chat normal.
- `lanjut` tanpa konteks cukup dibalas klarifikasi.
- Pending topic `Xiaomi 14`, lalu user bertanya `Buatkan kode login Next.js`, dianggap topic shift dan diproses sebagai topik baru.
- Pending action kedaluwarsa otomatis agar bot tidak stuck pada topik lama.
- Jika conversation layer error, webhook tetap punya fallback ke pipeline AI lama.

### Interaction Layer Telegram

Layer `src/interactions/` membuat bot lebih interaktif tanpa mengganggu chat normal.

```text
AI response
-> classify context
-> decide whether buttons help
-> store small interaction state
-> send inline keyboard
-> callback_query
-> route action
-> continue conversation or request confirmation
```

Modul:

- `interaction-manager.js`: menentukan apakah jawaban perlu tombol.
- `keyboard-builder.js`: helper inline keyboard Telegram.
- `callback-router.js`: routing `callback_query` berbasis `callback_data`.
- `action-handlers.js`: aksi cepat seperti ringkas, jelaskan lagi, roadmap, coding, learning, decision, dan ops.
- `confirmation-handler.js`: konfirmasi untuk aksi penting seperti reset memory.
- `interaction-state.js`: state sementara memakai Redis jika ada, fallback ke memory Map.
- `interactive-menu.js`: `/menu`, `/actions`, dan keyboard bantuan.

Trade-off: tombol hanya ditampilkan pada konteks yang membantu. Pertanyaan sederhana tetap dijawab biasa agar Telegram tidak terasa ramai.

### Dashboard API Foundation

Endpoint ringan:

```text
GET /api/dashboard
```

Endpoint ini hanya menampilkan struktur publik, health ringkas, storage status, modul aktif, command group, dan target dashboard. Ia tidak mengekspos memory user, prompt internal, token, atau data sensitif. Frontend penuh bisa dibangun nanti dengan Next.js, Tailwind CSS, shadcn/ui, PostgreSQL, Redis, dan Auth.js/Clerk/Supabase Auth.

### Human Judgment Safety Layer

Modul `src/ux/human-ai-safety.js` menambahkan guard deterministic untuk topik high-stakes:

- kesehatan;
- hukum;
- keuangan;
- keselamatan;
- keputusan besar.

Guard ini menyuntikkan aturan ke `getSystemPrompt()`, menambahkan context note saat user bertanya topik berisiko, dan memberi footer singkat bila jawaban perlu menekankan verifikasi manusia. Tujuannya menjaga AI tetap menjadi partner berpikir, bukan pengambil keputusan final.

### Trade-off Final

- PostgreSQL memberi persistence kuat, tetapi optional agar local/Render kecil tetap bisa jalan dengan JSON.
- Redis mempercepat cache/session/rate-limit, tetapi fallback memory menjaga bot tetap hidup tanpa Redis.
- Adaptive mode mengurangi beban user mengetik `/mode`, tetapi manual override tetap disediakan.
- Collaboration framework deterministic lebih murah daripada LLM planner tambahan, tetapi kedalamannya terbatas pada struktur berpikir.
- Dashboard baru berupa API foundation, bukan frontend penuh, agar tidak menambah package berat.
- Safety footer high-stakes menambah sedikit panjang jawaban, tetapi mengurangi risiko overconfidence pada keputusan penting.

### Manual Test

```bash
node --check telebot.js
node scratch/test-conversation-layer.js
node scratch/test-multi-device-ux.js
node scratch/test-human-ai-safety.js
node scratch/test-final-cognitive-os.js
node scratch/test-ops.js
npm run check
TELEGRAM_TOKEN=dummy MISTRAL_API_KEY=dummy PORT=0 npm start
```

Command Telegram yang perlu dicoba:

```text
/adaptive status
/adaptive on
/think Saya bingung memilih Redis atau PostgreSQL untuk memory bot
/learnplan backend dari nol
/mentalmodel scalable bot
/decision Redis vs PostgreSQL untuk memory
/blindspot rencana saya deploy banyak user di Render free tier
/assumptions bot ini akan dipakai banyak user
/perspectives bagaimana membangun AI OS personal
/insight Mulai dari baseline sebelum optimasi
/journal Hari ini belajar storage architecture
/collab
/aios
/goals
/workflows
/graph
/ops
/health
```

Conversation test manual:

```text
User: Tolong bantu
Bot: Mau aku bantu cari info topik tertentu?
User: Iya
Expected: bot melanjutkan tawaran, bukan mengulang pertanyaan.

User: Lanjut
Expected: jika konteks cukup, bot lanjut; jika tidak, bot minta klarifikasi.

User: Buatkan kode login Next.js
Expected: jika sebelumnya ada pending action beda topik, pending dibersihkan dan pesan diproses sebagai topik baru.
```

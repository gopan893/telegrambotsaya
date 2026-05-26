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

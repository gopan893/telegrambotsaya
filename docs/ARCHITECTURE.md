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

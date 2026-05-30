# Telegram AI Level Tertinggi

Project ini adalah versi AI bot Telegram yang sudah ditingkatkan untuk pemakaian serius:

- OpenAI Responses API
- Model default `gpt-5.2`
- Memori jangka panjang per user
- Konteks percakapan berkelanjutan
- Mode AI untuk coding, bisnis, belajar, kreatif, dan jawaban tegas
- Knowledge base lokal dari folder `knowledge/`
- Web search opsional
- Input gambar Telegram opsional
- Rate limit anti-spam
- Statistik admin
- Adaptive mode otomatis
- AI OS untuk goals, workflows, graph, insight, dan workspace
- Human-AI Collaboration untuk thinking, learning, reflection, dan decision support
- AI Operations untuk health, benchmark, reliability, regression, dan recovery
- Multi-device UX mode agar jawaban nyaman dibaca di Telegram mobile, Telegram desktop, web client, laptop, dan desktop
- Conversation continuity layer agar follow-up seperti `iya`, `lanjut`, `jelaskan`, dan pergantian topik dipahami natural
- Interaction layer dengan inline keyboard, menu cepat, callback handler, dan confirmation flow untuk aksi penting
- Human judgment safety layer untuk topik kesehatan, hukum, keuangan, keselamatan, dan keputusan besar

## Mulai Cepat

```bash
npm install
cp .env.example .env
npm start
```

Isi `.env` minimal:

```env
TELEGRAM_TOKEN=isi_token_bot_telegram
MISTRAL_API_KEY=isi_api_key_mistral
OWNER_CHAT_ID=telegram_user_id_owner
```

File env juga mendukung `DATABASE_URL`, `REDIS_URL`, `WEBHOOK_URL`, `GROQ_API_KEY`, `TAVILY_API_KEY`, `OPENWEATHER_API_KEY`, `ADMIN_IDS`, dan variabel lain yang ada di `.env.example`.

Storage production:

- `STORAGE_DRIVER=auto` akan memakai PostgreSQL jika `DATABASE_URL` tersedia dan sehat.
- `STORAGE_DRIVER=json` memaksa bot memakai file JSON lokal walau `DATABASE_URL` ada.
- PostgreSQL menyimpan data legacy bot di tabel ringan `app_kv_store` sebagai JSONB.
- Jika PostgreSQL error atau `DATABASE_URL` kosong, bot tetap berjalan dengan JSON fallback.
- Jika `REDIS_URL` tersedia, bot memakai Redis sebagai cache/session sementara.
- Jika Redis error atau `REDIS_URL` kosong, bot tetap berjalan dengan memory/local fallback.

Contoh `DATABASE_URL` PostgreSQL Render:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
STORAGE_DRIVER=auto
```

Jangan menaruh `DATABASE_URL` di chat publik atau commit GitHub.

Catatan arsitektur dan rencana modularisasi ada di `docs/ARCHITECTURE.md`.

## Push Otomatis ke GitHub

Pertama kali saja:

```bash
git init
git add .
git commit -m "Initial AI bot"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

Setelah itu, setiap selesai mengembangkan kode:

```bash
npm run push -- "upgrade AI bot"
```

Script ini otomatis menjalankan `git add .`, `git commit`, dan `git push`.

## Cara Membuat AI Lebih Pintar

Tambahkan file ke folder `knowledge/`, misalnya:

- `knowledge/profil-bisnis.md`
- `knowledge/faq.md`
- `knowledge/harga.md`
- `knowledge/sop-admin.md`

Bot akan mencari potongan yang relevan dari file tersebut saat menjawab.

## Command Telegram

```text
/help
/menu
/actions
/mode
/adaptive status
/think masalah
/learnplan topik
/mentalmodel konsep
/decision pilihan
/blindspot rencana
/assumptions argumen
/perspectives masalah
/insight catatan
/journal catatan
/collab
/aios
/goals
/workflows
/graph
/ops
/health
/stats
```

## Catatan Penting

Kalau project lama kamu punya file `telebot.js` sendiri, pindahkan logic khusus lama secara bertahap ke file ini. Versi ini dibuat sebagai fondasi baru yang lebih kuat dan lebih mudah dikembangkan.

## Multi-Device UX

Bot sekarang menyuntikkan aturan format jawaban yang mobile-friendly ke system prompt:

- Ringkasan atau inti jawaban muncul lebih dulu.
- Paragraf dibuat pendek dan mudah discan.
- Bullet dibuat sederhana tanpa nested list berlebihan.
- Jawaban panjang dipecah menjadi section kecil.
- Code block tetap rapi untuk kebutuhan coding.
- Normalisasi output membatasi blank line berlebihan sebelum dikirim ke Telegram.

## Conversation Continuity

Layer `src/conversation/` menangani pesan non-command sebelum masuk AI pipeline:

- command lama tetap prioritas;
- pending action aktif bisa dilanjutkan dengan jawaban pendek seperti `iya`;
- `tidak` atau `batal` membatalkan pending action;
- topik baru seperti coding/debugging tidak dipaksa ke konteks lama;
- `lanjut` tanpa konteks cukup akan memicu klarifikasi singkat;
- context window dibatasi beberapa pesan terakhir agar ringan untuk Render free tier.

## PostgreSQL Relational Storage

Phase 6 menambahkan schema relational PostgreSQL tanpa menghapus fallback lama.

- `app_kv_store` tetap ada untuk kompatibilitas data JSON/KV lama.
- Jika `DATABASE_URL` valid, startup menjalankan migration idempotent dan mengaktifkan repository PostgreSQL.
- Jika PostgreSQL kosong/error, bot tetap memakai JSON fallback.
- Redis tetap optional untuk cache/session; tanpa `REDIS_URL`, sistem memakai memory cache lokal.
- Tabel relational utama: `users`, `adaptive_profiles`, `memories`, `goals`, `workflows`, `workflow_steps`, `insights`, `graph_nodes`, `graph_edges`, `telemetry_events`, `incidents`, `benchmark_runs`, dan `ops_lessons`.
- Command `/memory`, `/remember`, `/goals`, `/goaladd`, `/goalupdate`, `/workflows`, `/workflowadd`, `/workflowstep`, `/workflowdone`, `/graph`, `/insights`, `/health`, dan `/stats` aman berjalan dengan PostgreSQL maupun JSON fallback.

Env storage:

```text
DATABASE_URL=
REDIS_URL=
PGSSL=false
STORAGE_DRIVER=auto
RUN_MIGRATIONS=true
```

## Phase 7 Stabilization Docs

Dokumentasi audit dan deploy final:

- `docs/COMMANDS.md`: ringkasan command core, adaptive, AI OS, collaboration, dan ops.
- `docs/PHASE7_E2E_AUDIT.md`: checklist manual command dan natural chat.
- `docs/RENDER_DEPLOYMENT.md`: checklist deploy Render, env, fallback, dan rollback.
- `docs/NATURAL_AI_OS_INTEGRATION.md`: cara kerja AI OS context untuk chat natural.

## Interactive Telegram UX

Layer `src/interactions/` menambahkan tombol Telegram tanpa memaksa semua jawaban memakai tombol:

- `/menu` dan `/actions` membuka menu utama.
- Jawaban coding bisa menawarkan tombol `Buat kode`, `Debug`, `Jelaskan error`, atau pilihan auth.
- Jawaban learning bisa menawarkan `Roadmap`, `Sederhanakan`, `Latihan`, dan `Quiz`.
- Jawaban decision support bisa menawarkan `Bandingkan opsi`, `Lihat risiko`, `Rekomendasi`, dan `Next step`.
- Aksi penting seperti `/reset` meminta konfirmasi inline terlebih dahulu.
- State tombol memakai Redis jika tersedia, lalu fallback ke memory Map jika Redis tidak ada.

## Human Judgment Safety

Bot dirancang sebagai partner berpikir, bukan pengganti keputusan manusia.

- Untuk topik high-stakes seperti kesehatan, hukum, keuangan, keselamatan, dan keputusan besar, bot menambahkan batasan dan anjuran verifikasi.
- Jika evidence kurang atau confidence rendah, bot diarahkan untuk mengatakan keterbatasannya.
- Keputusan akhir tetap di user.

## Dashboard API

Endpoint ringan:

```text
GET /api/dashboard
```

Endpoint ini hanya menampilkan metadata publik seperti health ringkas, tipe storage, modul aktif, dan daftar command. Memory user, prompt internal, token, dan data sensitif tidak diekspos.

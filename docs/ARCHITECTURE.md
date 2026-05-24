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

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

## Struktur Target

```text
src/
  core/
    logger.js
    ttl-map.js
    keyed-queue.js
    circuit-breaker.js
  ai/
    router.js
    providers/
      groq.js
      mistral.js
  memory/
    store.js
    context.js
  plugins/
    loader.js
  commands/
    index.js
    reminder.js
    calendar.js
    files.js
    moderation.js
  telegram/
    webhook.js
    sender.js
```

## Modul Yang Sudah Dipisah

- `src/core/logger.js`
- `src/core/ttl-map.js`
- `src/core/keyed-queue.js`
- `src/core/circuit-breaker.js`

Modul ini sudah dipakai oleh `telebot.js` tanpa mengubah command Telegram lama.

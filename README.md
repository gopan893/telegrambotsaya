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

## Mulai Cepat

```bash
npm install
cp .env.example .env
npm start
```

Isi `.env` minimal:

```env
TELEGRAM_BOT_TOKEN=isi_token_bot_telegram
OPENAI_API_KEY=isi_api_key_openai
```

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
/mode
/mode coder
/mode business
/memory
/memory_add saya suka jawaban yang singkat
/memory_clear
/forget
/stats
```

## Catatan Penting

Kalau project lama kamu punya file `telebot.js` sendiri, pindahkan logic khusus lama secara bertahap ke file ini. Versi ini dibuat sebagai fondasi baru yang lebih kuat dan lebih mudah dikembangkan.

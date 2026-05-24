# Deploy Telegram AI Bot

## 1. Install

```bash
npm install
```

## 2. Buat konfigurasi

```bash
cp .env.example .env
```

Isi:

- `TELEGRAM_TOKEN` dari BotFather
- `MISTRAL_API_KEY` dari Mistral
- `OWNER_CHAT_ID` untuk admin bot
- `WEBHOOK_URL` jika memakai webhook, atau `RENDER_EXTERNAL_HOSTNAME` jika deploy di Render

## 3. Jalankan

```bash
npm start
```

## 4. Upgrade pengetahuan bot

Tambahkan file `.txt`, `.md`, atau `.json` ke folder `knowledge/`.

Contoh:

```text
knowledge/harga.md
knowledge/faq.md
knowledge/profil-bisnis.md
```

Bot akan otomatis mengambil potongan file yang relevan saat menjawab.

## 5. Jalankan 24 jam dengan PM2

```bash
npm install -g pm2
pm2 start telebot.js --name telegram-ai
pm2 save
pm2 startup
```

## 6. Command Telegram

- `/help` melihat fitur
- `/mode` melihat mode AI
- `/mode coder` mode programmer
- `/mode business` mode bisnis
- `/memory` melihat memori
- `/memory_add teks` menambah memori manual
- `/memory_clear` hapus memori user
- `/forget` reset konteks chat
- `/stats` statistik khusus admin

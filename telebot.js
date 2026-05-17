const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ==================== AMBIL ENVIRONMENT VARIABLES ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;

// ==================== CEK ENVIRONMENT VARIABLES ====================
console.log("🔍 CEK ENVIRONMENT VARIABLES:");
console.log("TELEGRAM_TOKEN :", TELEGRAM_TOKEN ? "✅ ADA" : "❌ TIDAK ADA");
console.log("GROQ_API_KEY   :", GROQ_API_KEY ? "✅ ADA" : "❌ TIDAK ADA");
console.log("POLLINATIONS_API_KEY :", POLLINATIONS_API_KEY ? "✅ ADA" : "⚠️ TIDAK ADA (TTS nonaktif)");

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}

// ==================== HAPUS WEBHOOK OTOMATIS ====================
async function deleteWebhook() {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`);
        if (response.data.ok) {
            console.log("✅ Webhook berhasil dihapus");
        } else {
            console.log("⚠️ Gagal hapus webhook:", response.data.description);
        }
    } catch (error) {
        console.log("⚠️ Error hapus webhook:", error.message);
    }
}

// ==================== FUNGSI CHAT AI (GROQ) ====================
async function chatAI(pesan) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: pesan }],
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ AI Error:", error.response?.data || error.message);
        return "Maaf, AI sedang error. Coba lagi nanti.";
    }
}

// ==================== FUNGSI GENERATE GAMBAR (POLLINATIONS) ====================
async function generateImage(prompt) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
        // Cek apakah URL valid
        await axios.head(url, { timeout: 10000 });
        return url;
    } catch (error) {
        console.error("❌ Gambar error:", error.message);
        return null;
    }
}

// ==================== FUNGSI TEXT-TO-SPEECH (POLLINATIONS) ====================
async function textToSpeech(text) {
    if (!POLLINATIONS_API_KEY) {
        console.log("⚠️ TTS: API key tidak tersedia");
        return null;
    }
    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.pollinations.ai/tts',
            data: {
                text: text,
                voice: "alloy"
            },
            headers: {
                'Authorization': `Bearer ${POLLINATIONS_API_KEY}`,
                'Content-Type': 'application/json'
            },
            responseType: 'stream',
            timeout: 20000
        });
        return response.data;
    } catch (error) {
        console.error("❌ TTS error:", error.message);
        return null;
    }
}

// ==================== HAPUS WEBHOOK & START BOT ====================
deleteWebhook().then(() => {
    setTimeout(() => {
        startBot();
    }, 2000);
});

// ==================== FUNGSI START BOT ====================
function startBot() {
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    
    console.log("🚀 Bot Telegram sedang berjalan...");
    
    // PERINTAH /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, 
`🤖 *Selamat datang di Bot AI!*

📋 *Perintah yang tersedia:*
/start - Menampilkan pesan ini
/image <deskripsi> - Membuat gambar dari teks
/tts <teks> - Mengubah teks menjadi suara
/chat <pesan> - Obrolan dengan AI

💬 *Atau kirim pesan biasa* tanpa perintah, saya akan jawab dengan AI.

Dibuat dengan Groq AI & Pollinations`, { parse_mode: "Markdown" });
    });
    
    // PERINTAH /image
    bot.onText(/\/image (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const prompt = match[1];
        
        await bot.sendMessage(chatId, `🎨 *Sedang menggambar:* "${prompt}"...`, { parse_mode: "Markdown" });
        
        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
            await bot.sendPhoto(chatId, imageUrl, { caption: `✨ *Hasil gambar dari:* ${prompt}`, parse_mode: "Markdown" });
        } else {
            await bot.sendMessage(chatId, "❌ *Gagal membuat gambar.* Coba lagi dengan deskripsi yang berbeda.", { parse_mode: "Markdown" });
        }
    });
    
    // PERINTAH /tts
    bot.onText(/\/tts (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const text = match[1];
        
        if (!POLLINATIONS_API_KEY) {
            await bot.sendMessage(chatId, "❌ *Fitur TTS tidak tersedia.* API key Pollinations belum diset.", { parse_mode: "Markdown" });
            return;
        }
        
        await bot.sendMessage(chatId, "🔊 *Mengubah teks ke suara...*", { parse_mode: "Markdown" });
        
        const audioStream = await textToSpeech(text);
        if (audioStream) {
            await bot.sendVoice(chatId, audioStream, { caption: `🔊 "${text}"` });
        } else {
            await bot.sendMessage(chatId, "❌ *Gagal membuat audio.* Coba lagi nanti.", { parse_mode: "Markdown" });
        }
    });
    
    // PERINTAH /chat
    bot.onText(/\/chat (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const pesan = match[1];
        
        await bot.sendChatAction(chatId, 'typing');
        const jawaban = await chatAI(pesan);
        
        if (jawaban.length > 4000) {
            await bot.sendMessage(chatId, jawaban.slice(0, 4000) + "...(terpotong)");
        } else {
            await bot.sendMessage(chatId, jawaban);
        }
    });
    
    // CHAT BIASA (tanpa perintah)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;
        
        if (msg.from.is_bot) return;
        if (!text) return;
        if (text.startsWith('/')) return;
        
        try {
            await bot.sendChatAction(chatId, 'typing');
            const jawaban = await chatAI(text);
            
            if (jawaban.length > 4000) {
                await bot.sendMessage(chatId, jawaban.slice(0, 4000) + "...(terpotong)");
            } else {
                await bot.sendMessage(chatId, jawaban);
            }
        } catch (error) {
            console.error("❌ Error chat biasa:", error.message);
            await bot.sendMessage(chatId, "Maaf, terjadi kesalahan. Coba lagi nanti.");
        }
    });
    
    // HANDLER ERROR POLLING
    bot.on('polling_error', (error) => {
        console.error("⚠️ Polling error:", error.message);
        if (error.message.includes("409")) {
            console.log("🔄 Terdeteksi konflik, mencoba hapus webhook...");
            deleteWebhook();
        }
    });
    
    console.log("✅ Bot Telegram siap menerima pesan!");
    console.log(`📊 Fitur aktif: /image, /chat, chat biasa | TTS: ${POLLINATIONS_API_KEY ? "AKTIF" : "NONAKTIF"}`);
}

console.log("🚀 Memulai inisialisasi bot...");
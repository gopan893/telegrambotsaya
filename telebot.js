const express = require('express');
const axios = require('axios');

// ==================== AMBIL ENVIRONMENT VARIABLES ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const PORT = process.env.PORT || 3000; // Render akan memberikan variabel PORT

// ==================== CEK ENVIRONMENT VARIABLES ====================
console.log("🔍 CEK ENVIRONMENT VARIABLES:");
console.log("TELEGRAM_TOKEN :", TELEGRAM_TOKEN ? "✅ ADA" : "❌ TIDAK ADA");
console.log("GROQ_API_KEY   :", GROQ_API_KEY ? "✅ ADA" : "❌ TIDAK ADA");
console.log("POLLINATIONS_API_KEY :", POLLINATIONS_API_KEY ? "✅ ADA" : "⚠️ TIDAK ADA (TTS nonaktif)");

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
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
            data: { text: text, voice: "alloy" },
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

// ==================== SETUP WEBHOOK & SERVER EXPRESS ====================
const app = express();
app.use(express.json());

// Endpoint untuk menerima update dari Telegram
app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    console.log("📨 Update diterima:", update);

    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const fromBot = update.message.from.is_bot;

        if (!fromBot && text) {
            // Proses perintah dan chat biasa
            let replyText = "";
            let imageUrl = null;
            let audioStream = null;

            if (text.startsWith('/start')) {
                replyText = `🤖 *Selamat datang di Bot AI!*\n\n📋 *Perintah yang tersedia:*\n/start - Menampilkan pesan ini\n/image <deskripsi> - Membuat gambar\n/tts <teks> - Teks ke suara\n/chat <pesan> - Obrolan dengan AI\n\n💬 *Atau kirim pesan biasa* tanpa perintah.`;
            } 
            else if (text.startsWith('/image ')) {
                const prompt = text.slice(7);
                replyText = `🎨 Sedang menggambar: "${prompt}"...`;
                imageUrl = await generateImage(prompt);
                if (!imageUrl) replyText = "❌ Gagal membuat gambar.";
            }
            else if (text.startsWith('/tts ')) {
                if (!POLLINATIONS_API_KEY) {
                    replyText = "❌ Fitur TTS tidak tersedia.";
                } else {
                    const ttsText = text.slice(5);
                    replyText = `🔊 Mengubah teks ke suara...`;
                    audioStream = await textToSpeech(ttsText);
                    if (!audioStream) replyText = "❌ Gagal membuat audio.";
                }
            }
            else if (text.startsWith('/chat ')) {
                const prompt = text.slice(6);
                replyText = await chatAI(prompt);
            }
            else if (!text.startsWith('/')) {
                // Chat biasa
                replyText = await chatAI(text);
            }
            else {
                replyText = "Perintah tidak dikenal. Ketik /start untuk bantuan.";
            }

            // Kirim balasan ke Telegram API
            const sendMessage = async (chat_id, text, parse_mode = "Markdown") => {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id, text, parse_mode });
            };
            const sendPhoto = async (chat_id, photo, caption) => {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id, photo, caption });
            };
            const sendVoice = async (chat_id, voice, caption) => {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, { chat_id, voice, caption });
            };

            if (imageUrl) {
                await sendPhoto(chatId, imageUrl, replyText);
            } else if (audioStream) {
                await sendVoice(chatId, audioStream, replyText);
            } else if (replyText) {
                await sendMessage(chatId, replyText);
            }
        }
    }
    res.sendStatus(200);
});

// Menjalankan server Express
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server webhook berjalan di port ${PORT}`);
    // Set webhook ke URL Render setelah server berjalan
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
        console.log(`✅ Webhook berhasil diset ke: ${webhookUrl}`);
    } catch (error) {
        console.error("❌ Gagal set webhook:", error.message);
    }
});
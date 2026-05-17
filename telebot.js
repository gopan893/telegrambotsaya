const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Ganti dengan token bot Telegram kamu
const TELEGRAM_TOKEN = "8617592038:AAFTCdirN89HFiHGVUeqAr7A2sBKyNijaTQ";

// Ganti dengan API key Groq atau Gemini
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

async function chatAI(pesan) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile", // ganti ke model yang aktif
                messages: [{ role: "user", content: pesan }],
                temperature: 0.7
            },
            {
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.log("AI Error:", error.response?.data || error.message);
        return "Maaf, AI sedang error.";
    }
}

// Handler untuk perintah /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Halo! Kirim pesan apa saja, saya akan jawab tanpa perlu perintah.");
});

// Handler untuk semua pesan (tanpa prefix)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (msg.from.is_bot) return;
    if (!text) return;
    if (text.startsWith('/')) return; // abaikan perintah selain /start
    
    try {
        await bot.sendChatAction(chatId, 'typing');
        const jawaban = await chatAI(text);
        
        if (jawaban.length > 4000) {
            await bot.sendMessage(chatId, jawaban.slice(0, 4000) + "...(terpotong)");
        } else {
            await bot.sendMessage(chatId, jawaban);
        }
    } catch (error) {
        console.log("Error:", error.message);
        await bot.sendMessage(chatId, "Maaf, terjadi kesalahan.");
    }
});

console.log("Bot Telegram siap (tanpa prefix)!");
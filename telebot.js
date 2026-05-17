const express = require('express');
const fs = require('fs');
const axios = require('axios');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const PORT = process.env.PORT || 3000;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}

// ==================== FILE MEMORI ====================
const MEMORY_FILE = 'memory.json';
const LESSONS_FILE = 'lessons.json';

let shortMemory = [];     // untuk konteks percakapan
let lessons = { rules: [] };  // aturan hasil belajar dari kesalahan

// Load data dari file (jika ada)
try {
    if (fs.existsSync(MEMORY_FILE)) shortMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));
    if (fs.existsSync(LESSONS_FILE)) lessons = JSON.parse(fs.readFileSync(LESSONS_FILE));
    console.log(`📂 Memori dimuat: ${shortMemory.length} percakapan, ${lessons.rules.length} aturan`);
} catch(e) { console.log("📂 File memori baru dibuat"); }

function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(shortMemory.slice(-100))); }
function saveLessons() { fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons)); }

// ==================== FUNGSI AI (GROQ) ====================
async function askGroq(prompt, systemMsg = "Kamu adalah asisten yang berpikir kritis, memberikan pro-kontra, dan belajar dari kesalahan masa lalu.") {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemMsg },
                    { role: "user", content: prompt }
                ],
                temperature: 0.5,
                max_tokens: 1500
            },
            {
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Groq error:", error.message);
        return "Maaf, AI sedang sibuk. Coba lagi nanti.";
    }
}

// ==================== FUNGSI GAMBAR (POLLINATIONS) ====================
async function generateImage(prompt, retry = 0) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch (error) {
        if (retry < 3) {
            console.log(`🔄 Retry gambar (${retry+1}/3) untuk: ${prompt}`);
            await new Promise(r => setTimeout(r, 3000 * (retry+1)));
            return generateImage(prompt, retry+1);
        }
        return null;
    }
}

// ==================== FUNGSI TEXT-TO-SPEECH ====================
async function textToSpeech(text) {
    if (!POLLINATIONS_API_KEY) return null;
    try {
        const response = await axios({
            method: 'post',
            url: 'https://text.pollinations.ai/openai',
            data: {
                model: "openai-audio",
                modalities: ["text", "audio"],
                audio: { voice: "echo", format: "mp3" },
                messages: [{ role: "user", content: text }]
            },
            headers: { 'Authorization': `Bearer ${POLLINATIONS_API_KEY}`, 'Content-Type': 'application/json' },
            responseType: 'arraybuffer',
            timeout: 20000
        });
        return Buffer.from(response.data);
    } catch (error) {
        console.error("❌ TTS error:", error.message);
        return null;
    }
}

// ==================== BELAJAR DARI KESALAHAN ====================
async function reflectOnMistake(question, wrongAnswer, userFeedback) {
    const analysisPrompt = `Analisis mengapa jawaban ini salah:
Pertanyaan: "${question}"
Jawaban AI: "${wrongAnswer}"
Feedback user: "${userFeedback}"
Buat satu aturan (maks 30 kata) agar AI tidak mengulangi kesalahan ini. Output hanya aturan.`;
    
    const newRule = await askGroq(analysisPrompt, "Anda adalah analis kesalahan AI.");
    lessons.rules.push({ rule: newRule, timestamp: Date.now(), questionPattern: question.slice(0,100) });
    if (lessons.rules.length > 50) lessons.rules = lessons.rules.slice(-50);
    saveLessons();
    console.log("✅ Aturan baru:", newRule);
}

// ==================== JAWABAN DENGAN BERPIKIR KRITIS ====================
async function getCriticalAnswer(question) {
    const recentRules = lessons.rules.slice(-3).map(r => "- " + r.rule).join("\n");
    const recentChat = shortMemory.slice(-5).map(m => `User: ${m.q}\nAI: ${m.a}`).join("\n\n");
    
    const prompt = `Pertanyaan user: "${question}"

Aturan dari kesalahan lalu (hindari):
${recentRules || "Belum ada aturan"}

Percakapan terbaru:
${recentChat || "Tidak ada"}

Sekarang, berpikirlah kritis:
1. Berikan 2-3 opsi solusi beserta pro dan kontra.
2. Berikan saran dengan tingkat keyakinan (contoh: "Saya 75% yakin bahwa...").
3. Hindari mengulangi kesalahan di aturan.
4. Akhiri dengan: "Apakah jawaban ini membantu? (Tekan tombol di bawah)"`;
    
    return await askGroq(prompt);
}

// ==================== SETUP EXPRESS WEBHOOK ====================
const app = express();
app.use(express.json());

// Track last message per chat untuk keperluan feedback
const lastResponse = new Map();

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    // Handle callback query (tombol feedback)
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const messageId = update.callback_query.message.message_id;
        
        const last = lastResponse.get(`${chatId}_${messageId}`);
        if (last && data === "negative") {
            await reflectOnMistake(last.question, last.answer, "User bilang tidak membantu");
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Terima kasih! Saya akan belajar dari ini.",
                show_alert: false
            });
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: "🙏 *Terima kasih atas masukannya! Saya akan belajar.*\n\n" + last.answer,
                parse_mode: "Markdown"
            });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Senang membantu!",
                show_alert: false
            });
        }
        return res.sendStatus(200);
    }
    
    // Handle pesan biasa
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        // Perintah /start
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🧠 *AI KRITIS v2.0*\n\nKirim pertanyaan apa pun, saya akan:\n✅ Berpikir pro-kontra\n✅ Memberi tingkat keyakinan\n✅ Belajar dari kesalahan\n✅ Bisa buat gambar dan suara\n\n📌 *Perintah:*\n/image <deskripsi>\n/tts <teks>\n/chat <pertanyaan>",
                parse_mode: "Markdown"
            });
            return res.sendStatus(200);
        }
        
        // Perintah /image
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: `🎨 *Menggambar:* "${prompt}"...\n🔄 Mencoba maksimal 3x jika gagal.`,
                parse_mode: "Markdown"
            });
            const imageUrl = await generateImage(prompt);
            if (imageUrl) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
                    chat_id: chatId,
                    photo: imageUrl,
                    caption: `✨ Hasil dari: "${prompt}"`
                });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "❌ Gagal membuat gambar setelah 3 kali percobaan."
                });
            }
            return res.sendStatus(200);
        }
        
        // Perintah /tts
        if (text.startsWith('/tts ')) {
            const ttsText = text.slice(5);
            if (!POLLINATIONS_API_KEY) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "❌ Fitur TTS tidak tersedia (API key Pollinations tidak diset)."
                });
                return res.sendStatus(200);
            }
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🔊 *Mengubah teks ke suara...*",
                parse_mode: "Markdown"
            });
            const audio = await textToSpeech(ttsText);
            if (audio) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, {
                    chat_id: chatId,
                    voice: audio.toString('base64'),
                    caption: `🔊 "${ttsText}"`
                });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "❌ Gagal membuat audio."
                });
            }
            return res.sendStatus(200);
        }
        
        // Perintah /chat (opsional, langsung ke AI)
        let finalAnswer;
        let finalQuestion;
        if (text.startsWith('/chat ')) {
            finalQuestion = text.slice(6);
            finalAnswer = await getCriticalAnswer(finalQuestion);
        } else {
            // Chat biasa (tanpa perintah) juga pake critical thinking
            finalQuestion = text;
            finalAnswer = await getCriticalAnswer(finalQuestion);
        }
        
        // Simpan ke memori
        shortMemory.push({ q: finalQuestion, a: finalAnswer, timestamp: Date.now() });
        if (shortMemory.length > 50) shortMemory = shortMemory.slice(-50);
        saveMemory();
        
        // Kirim jawaban dengan tombol feedback
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: finalAnswer,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ Membantu", callback_data: "positive" },
                    { text: "❌ Tidak membantu", callback_data: "negative" }
                ]]
            }
        });
        
        // Simpan untuk keperluan feedback
        lastResponse.set(`${chatId}_${sent.data.result.message_id}`, {
            question: finalQuestion,
            answer: finalAnswer
        });
        
        // Hapus dari map setelah 10 menit
        setTimeout(() => lastResponse.delete(`${chatId}_${sent.data.result.message_id}`), 600000);
    }
    res.sendStatus(200);
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server AI Kritis berjalan di port ${PORT}`);
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
        console.log(`✅ Webhook diset ke: ${webhookUrl}`);
    } catch (error) {
        console.error("❌ Gagal set webhook:", error.message);
    }
});
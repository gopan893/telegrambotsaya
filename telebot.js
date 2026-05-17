const express = require('express');
const fs = require('fs');
const axios = require('axios');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const PORT = process.env.PORT || 3000;
const MAX_RALPH_ITERATIONS = 3;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}

// ==================== FILE MEMORI ====================
const MEMORY_FILE = 'memory.json';
const LESSONS_FILE = 'lessons.json';

let shortMemory = [];
let lessons = { rules: [], ralphLogs: [], userMood: {} };

try {
    if (fs.existsSync(MEMORY_FILE)) shortMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));
    if (fs.existsSync(LESSONS_FILE)) lessons = JSON.parse(fs.readFileSync(LESSONS_FILE));
    console.log(`📂 Memori dimuat: ${shortMemory.length} percakapan, ${lessons.rules.length} aturan`);
} catch(e) { console.log("📂 File memori baru dibuat"); }

function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(shortMemory.slice(-100))); }
function saveLessons() { fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons)); }

// ==================== DETEKSI SUASANA HATI (SENTIMENT) ====================
async function detectMood(message) {
    const moodPrompt = `Tentukan suasana hati dari pesan ini: "${message}"
Output hanya satu kata: SEDIH, MARAH, SENANG, BERCANDA, SERIUS, atau NETRAL.`;

    try {
        const mood = await askGroq(moodPrompt, "Anda adalah pendeteksi suasana hati. Output hanya satu kata.");
        return mood.trim().toUpperCase();
    } catch (error) {
        return "NETRAL";
    }
}

// ==================== SYSTEM PROMPT DINAMIS (BERDASAR SUASANA) ====================
function getDynamicSystemPrompt(mood, lastFewChats = "") {
    const basePersona = "Kamu adalah teman ngobrol yang asyik, natural, tidak kaku. Bahasa seperti orang ngobrol biasa, bisa pake kata 'sih', 'dong', 'nih', 'ya ampun', 'wow', 'haha', 'seriusan?', dll. JANGAN pake bahasa formal/baku kayak 'saya', 'anda', 'apakah', 'sebaiknya'. Pake 'aku', 'kamu', 'gak', 'nggak', 'aja'. Bisa serius kalau lagi butuh, bisa bercanda kalau lagi santai. Sesuaikan dengan suasana lawan bicara.";

    const moodAdjustments = {
        "SEDIH": "User sedang sedih. Tanggapi dengan empati, lembut, jangan bercanda. Tawarkan dukungan. Boleh kasih saran yang menghibur.",
        "MARAH": "User sedang marah. Jangan terpancing. Tetap tenang, akui perasaannya, tawarkan solusi. Jangan bercanda.",
        "SENANG": "User sedang senang. Ikut senang, bisa bercanda, pake ekspresi 'asik', 'wah mantap', 'keren nih'.",
        "BERCANDA": "User sedang bercanda. Balas dengan candaan juga, pake gaya santai, bisa pake emoji atau 'wkwk'.",
        "SERIUS": "User sedang serius. Jawab dengan informatif tapi tetap santai. Jangan bercanda. Beri solusi logis.",
        "NETRAL": "User netral. Bisa campur: sedikit santai, sedikit informatif. Tanya balik biar ngobrol lanjut."
    };

    return `${basePersona}\n\nSUASANA USER SEKARANG: ${mood}\nPANDUAN: ${moodAdjustments[mood] || moodAdjustments["NETRAL"]}\n\nKonteks percakapan terbaru:\n${lastFewChats}`;
}

// ==================== FUNGSI AI (GROQ) ====================
async function askGroq(prompt, systemMsg) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemMsg || "Kamu asisten yang membantu." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8,  // Lebih tinggi biar lebih kreatif/bercanda
                max_tokens: 1000
            },
            {
                headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
                timeout: 30000
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("❌ Groq error:", error.message);
        return "Maaf, lagi error nih. Coba lagi ya?";
    }
}

// ==================== RALPH WIGGUM: AUTO-VALIDASI ====================
async function autoValidateAnswer(question, answer) {
    const validationPrompt = `Apakah jawaban ini BAIK atau BURUK untuk pertanyaan: "${question}"
Jawaban: "${answer}"
Kriteria BURUK: tidak relevan, berbahaya, terlalu pendek/generik.
Output hanya BAIK atau BURUK.`;

    const result = await askGroq(validationPrompt, "Anda validator AI.");
    return result.trim().toUpperCase() === "BAIK";
}

async function extractLesson(question, badAnswer) {
    const lessonPrompt = `Ekstrak satu pelajaran (maks 30 kata) dari jawaban buruk ini:
Pertanyaan: "${question}"
Jawaban buruk: "${badAnswer}"
Output hanya pelajarannya.`;
    return await askGroq(lessonPrompt, "Anda ekstraktor pelajaran.");
}

async function chatAIWithRalph(question, iteration = 1, previousLesson = "") {
    let prompt = question;
    if (previousLesson) {
        prompt = `${question}\n\n⚠️ [JANGAN]: ${previousLesson}`;
    }
    const answer = await askGroq(prompt);
    const isValid = await autoValidateAnswer(question, answer);
    
    if (isValid || iteration >= MAX_RALPH_ITERATIONS) {
        return { answer, iteration };
    }
    
    const lesson = await extractLesson(question, answer);
    lessons.ralphLogs.push({ question, lesson, iteration });
    lessons.rules.push({ rule: lesson, source: "ralph", timestamp: Date.now() });
    saveLessons();
    
    return chatAIWithRalph(question, iteration + 1, lesson);
}

// ==================== FUNGSI GAMBAR & TTS ====================
async function generateImage(prompt, retry = 0) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch (error) {
        if (retry < 3) {
            await new Promise(r => setTimeout(r, 3000 * (retry+1)));
            return generateImage(prompt, retry+1);
        }
        return null;
    }
}

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

// ==================== JAWABAN DENGAN PERSONA ADAPTIF ====================
async function getAdaptiveAnswer(question, mood, chatHistory) {
    const systemPrompt = getDynamicSystemPrompt(mood, chatHistory);
    const recentRules = lessons.rules.slice(-3).map(r => "- " + r.rule).join("\n");
    
    const enhancedQuestion = `Pertanyaan: "${question}"

Aturan yang harus diingat:
${recentRules || "Tidak ada aturan khusus"}

Sekarang jawab dengan gaya teman ngobrol, santai, bisa serius atau bercanda sesuai suasana (${mood}). Gunakan "aku" dan "kamu". Jangan baku. Akhiri dengan pertanyaan balik atau ekspresi ringan.`;

    const { answer, iteration } = await chatAIWithRalph(enhancedQuestion);
    return { answer, iteration };
}

// ==================== SETUP EXPRESS WEBHOOK ====================
const app = express();
app.use(express.json());

const lastResponse = new Map();

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const messageId = update.callback_query.message.message_id;
        const last = lastResponse.get(`${chatId}_${messageId}`);
        
        if (last && data === "negative") {
            const lesson = await extractLesson(last.question, last.answer);
            lessons.rules.push({ rule: lesson, source: "user_feedback", timestamp: Date.now() });
            saveLessons();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Makasih ya! Aku bakal belajar dari ini 🙏",
                show_alert: false
            });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Seneng bisa bantu! 😊",
                show_alert: false
            });
        }
        return res.sendStatus(200);
    }
    
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        
        // Ambil sejarah chat terakhir
        const chatHistory = shortMemory.slice(-5).map(m => `Kamu: ${m.q}\nAku: ${m.a}`).join("\n");
        
        // Deteksi suasana hati
        const mood = await detectMood(text);
        console.log(`😊 Mood terdeteksi: ${mood} dari pesan: "${text.slice(0,50)}"`);
        
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🤗 *Halo teman!*\n\nAku di sini buat ngobrol santai sama kamu. Bisa serius, bisa bercanda, sesuai kebutuhanmu.\n\n📌 *Perintah:*\n/image <deskripsi> -> bikin gambar\n/tts <teks> -> jadi suara\n\nKirim aja pesan biasa, aku bakal jawab kayak teman!",
                parse_mode: "Markdown"
            });
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: `🎨 Lagi gambar: "${prompt}"... tunggu ya!`,
                parse_mode: "Markdown"
            });
            const imageUrl = await generateImage(prompt);
            if (imageUrl) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
                    chat_id: chatId,
                    photo: imageUrl,
                    caption: `✨ Nih hasil gambar "${prompt}"`
                });
            } else {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "❌ Waduh gagal nih buat gambarnya. Coba kata-kata lain ya?"
                });
            }
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/tts ')) {
            const ttsText = text.slice(5);
            if (!POLLINATIONS_API_KEY) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                    chat_id: chatId,
                    text: "❌ Maaf, fitur suara belum bisa dipakai. Belum ada kunci API-nya."
                });
                return res.sendStatus(200);
            }
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🔊 Lagi bikin suara...",
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
                    text: "❌ Gagal bikin suaranya, coba lain kali ya."
                });
            }
            return res.sendStatus(200);
        }
        
        let finalQuestion = text;
        if (text.startsWith('/chat ')) finalQuestion = text.slice(6);
        
        const { answer, iteration } = await getAdaptiveAnswer(finalQuestion, mood, chatHistory);
        
        shortMemory.push({ q: finalQuestion, a: answer, timestamp: Date.now(), mood });
        if (shortMemory.length > 50) shortMemory = shortMemory.slice(-50);
        saveMemory();
        
        const moodEmoji = { SEDIH: "🥺", MARAH: "😤", SENANG: "😄", BERCANDA: "😜", SERIUS: "🤔", NETRAL: "😊" };
        const answerWithInfo = `${moodEmoji[mood] || "💬"} *[${mood.toLowerCase()}]* (${iteration}/${MAX_RALPH_ITERATIONS})\n\n${answer}`;
        
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: answerWithInfo,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    { text: "👍 Membantu", callback_data: "positive" },
                    { text: "👎 Nggak membantu", callback_data: "negative" }
                ]]
            }
        });
        
        lastResponse.set(`${chatId}_${sent.data.result.message_id}`, {
            question: finalQuestion,
            answer: answer
        });
        setTimeout(() => lastResponse.delete(`${chatId}_${sent.data.result.message_id}`), 600000);
    }
    res.sendStatus(200);
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 AI Teman Ngobrol v4.0 berjalan di port ${PORT}`);
    console.log(`📊 Fitur: Adaptive Persona + Sentiment Detection + Ralph Wiggum`);
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
        console.log(`✅ Webhook diset ke: ${webhookUrl}`);
    } catch (error) {
        console.error("❌ Gagal set webhook:", error.message);
    }
});
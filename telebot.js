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

// ==================== FILE MEMORI (MULTI-USER) ====================
const MEMORY_FILE = 'memory.json';
const LESSONS_FILE = 'lessons.json';
const SUCCESS_FILE = 'success_strategies.json';     // ReasoningBank
const USER_MEMORY_FILE = 'user_memory.json';        // LightAgent Mem0

let shortMemory = [];
let lessons = { rules: [], ralphLogs: [] };
let successStrategies = { strategies: [] };         // ReasoningBank
let userMemory = {};                                 // Mem0 per user

try {
    if (fs.existsSync(MEMORY_FILE)) shortMemory = JSON.parse(fs.readFileSync(MEMORY_FILE));
    if (fs.existsSync(LESSONS_FILE)) lessons = JSON.parse(fs.readFileSync(LESSONS_FILE));
    if (fs.existsSync(SUCCESS_FILE)) successStrategies = JSON.parse(fs.readFileSync(SUCCESS_FILE));
    if (fs.existsSync(USER_MEMORY_FILE)) userMemory = JSON.parse(fs.readFileSync(USER_MEMORY_FILE));
    console.log(`📂 Memori dimuat: ${shortMemory.length} percakapan, ${lessons.rules.length} aturan, ${successStrategies.strategies.length} strategi sukses, ${Object.keys(userMemory).length} user`);
} catch(e) { console.log("📂 File memori baru dibuat"); }

function saveMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(shortMemory.slice(-100))); }
function saveLessons() { fs.writeFileSync(LESSONS_FILE, JSON.stringify(lessons)); }
function saveSuccessStrategies() { fs.writeFileSync(SUCCESS_FILE, JSON.stringify(successStrategies)); }
function saveUserMemory() { fs.writeFileSync(USER_MEMORY_FILE, JSON.stringify(userMemory)); }

// ==================== DETEKSI SUASANA HATI ====================
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
                temperature: 0.8,
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

// ==================== SAGE REFLECTION: CHECKER AGENT ====================
async function checkerAgent(question, draftAnswer) {
    const checkPrompt = `Anda adalah Checker Agent. Evaluasi jawaban ini:
Pertanyaan: "${question}"
Jawaban draft: "${draftAnswer}"

Kriteria penilaian:
- Apakah menjawab pertanyaan? (Ya/Tidak)
- Apakah informatif? (Ya/Tidak)
- Apakah aman/tidak berbahaya? (Ya/Tidak)
- Apakah sesuai suasana? (Ya/Tidak)
- Saran perbaikan (maks 20 kata)

Output format:
VALID: Ya/Tidak
SARAN: [saran perbaikan jika tidak valid]`;

    const result = await askGroq(checkPrompt, "Anda adalah Checker Agent yang kritis.");
    const isValid = result.includes("VALID: Ya") && !result.includes("VALID: Tidak");
    const suggestion = result.match(/SARAN: (.*)/)?.[1] || "";
    return { isValid, suggestion };
}

// ==================== RALPH WIGGUM + CHECKER INTEGRATION ====================
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

async function extractSuccessStrategy(question, goodAnswer) {
    const strategyPrompt = `Ekstrak pola penalaran SUKSES (maks 30 kata) dari jawaban baik ini:
Pertanyaan: "${question}"
Jawaban baik: "${goodAnswer}"
Pola ini akan digunakan untuk pertanyaan serupa di masa depan.
Output hanya polanya.`;
    return await askGroq(strategyPrompt, "Anda ekstraktor pola sukses.");
}

async function chatAIWithRalphAndChecker(question, userId, iteration = 1, previousLesson = "") {
    // Ambil strategi sukses relevan (ReasoningBank)
    const relevantStrategies = successStrategies.strategies
        .filter(s => s.keywords?.some(k => question.toLowerCase().includes(k)))
        .slice(-2)
        .map(s => s.strategy)
        .join("\n");
    
    let prompt = question;
    if (previousLesson) {
        prompt = `${question}\n\n⚠️ [JANGAN]: ${previousLesson}`;
    }
    if (relevantStrategies) {
        prompt = `${prompt}\n\n✅ [POLA SUKSES DULU]: ${relevantStrategies}`;
    }
    
    const draftAnswer = await askGroq(prompt);
    
    // SAGE Checker
    const { isValid, suggestion } = await checkerAgent(question, draftAnswer);
    
    if (isValid || iteration >= MAX_RALPH_ITERATIONS) {
        return { answer: draftAnswer, iteration };
    }
    
    // Ralph belajar dari kegagalan
    const lesson = await extractLesson(question, draftAnswer);
    lessons.rules.push({ rule: lesson, source: "ralph", userId, timestamp: Date.now() });
    saveLessons();
    
    // Coba lagi dengan saran dari checker
    const improvedPrompt = `${question}\n\n⚠️ [SARAN CHECKER]: ${suggestion}\nJANGAN ulangi kesalahan sebelumnya.`;
    const improvedAnswer = await askGroq(improvedPrompt);
    return { answer: improvedAnswer, iteration: iteration + 1 };
}

// ==================== SYSTEM PROMPT DINAMIS ====================
function getDynamicSystemPrompt(mood, userHistory = "") {
    const basePersona = "Kamu adalah teman ngobrol yang asyik, natural, tidak kaku. Bahasa seperti orang ngobrol biasa, bisa pake kata 'sih', 'dong', 'nih', 'ya ampun', 'wow', 'haha', 'seriusan?', dll. JANGAN pake bahasa formal/baku kayak 'saya', 'anda', 'apakah', 'sebaiknya'. Pake 'aku', 'kamu', 'gak', 'nggak', 'aja'. Bisa serius kalau lagi butuh, bisa bercanda kalau lagi santai.";

    const moodAdjustments = {
        "SEDIH": "User sedang sedih. Tanggapi dengan empati, lembut, jangan bercanda. Tawarkan dukungan.",
        "MARAH": "User sedang marah. Jangan terpancing. Tetap tenang, akui perasaannya.",
        "SENANG": "User sedang senang. Ikut senang, bisa bercanda, pake ekspresi 'asik', 'wah mantap'.",
        "BERCANDA": "User sedang bercanda. Balas dengan candaan juga, pake gaya santai.",
        "SERIUS": "User sedang serius. Jawab dengan informatif tapi tetap santai. Jangan bercanda.",
        "NETRAL": "User netral. Bisa campur: sedikit santai, sedikit informatif."
    };

    return `${basePersona}\n\nSUASANA USER SEKARANG: ${mood}\nPANDUAN: ${moodAdjustments[mood] || moodAdjustments["NETRAL"]}\n\nRIWAYAT USER: ${userHistory || "Belum ada riwayat"}`;
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

// ==================== LIGHTAGENT MEM0 (PER USER) ====================
async function getUserMemory(userId) {
    if (!userMemory[userId]) {
        userMemory[userId] = {
            preferences: {},
            lastTopics: [],
            interactionCount: 0,
            firstSeen: Date.now(),
            moodHistory: []
        };
        saveUserMemory();
    }
    return userMemory[userId];
}

async function updateUserMemory(userId, question, answer, mood) {
    const mem = await getUserMemory(userId);
    mem.interactionCount++;
    mem.lastTopics.unshift(question.slice(0, 100));
    if (mem.lastTopics.length > 10) mem.lastTopics.pop();
    mem.moodHistory.unshift({ mood, timestamp: Date.now() });
    if (mem.moodHistory.length > 20) mem.moodHistory.pop();
    saveUserMemory();
    return mem;
}

// ==================== JAWABAN UTAMA (SEMUA FITUR) ====================
async function getUltraAnswer(question, userId, mood, chatHistory, userPreference) {
    const userMem = await getUserMemory(userId);
    const recentRules = lessons.rules.slice(-3).map(r => "- " + r.rule).join("\n");
    const recentSuccess = successStrategies.strategies.slice(-2).map(s => "- " + s.strategy).join("\n");
    const systemPrompt = getDynamicSystemPrompt(mood, `User ${userId} sudah ${userMem.interactionCount} kali chat. Topik terakhir: ${userMem.lastTopics.slice(0,3).join(", ")}`);
    
    const enhancedQuestion = `Pertanyaan: "${question}"

INFORMASI USER:
- Preferensi: ${userPreference || "Belum diketahui"}
- Suasana saat ini: ${mood}
- Topik yang sering dibahas: ${userMem.lastTopics.slice(0,3).join(", ")}

PELAJARAN DARI KESALAHAN (HINDARI):
${recentRules || "Tidak ada"}

POLA SUKSES DARI MASA LALU (Gunakan jika relevan):
${recentSuccess || "Tidak ada"}

KONTEKS PERCAKAPAN TERBARU:
${chatHistory || "Tidak ada"}

Sekarang jawab dengan gaya teman ngobrol, santai, bisa serius atau bercanda sesuai suasana (${mood}). Gunakan "aku" dan "kamu". Jangan baku. Akhiri dengan pertanyaan balik atau ekspresi ringan.`;

    const { answer, iteration } = await chatAIWithRalphAndChecker(enhancedQuestion, userId);
    return { answer, iteration };
}

// ==================== SETUP EXPRESS WEBHOOK ====================
const app = express();
app.use(express.json());

const lastResponse = new Map();

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    
    // Handle callback query (feedback)
    if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const data = update.callback_query.data;
        const messageId = update.callback_query.message.message_id;
        const last = lastResponse.get(`${chatId}_${messageId}`);
        
        if (last && data === "negative") {
            const lesson = await extractLesson(last.question, last.answer);
            lessons.rules.push({ rule: lesson, source: "user_feedback", userId: chatId.toString(), timestamp: Date.now() });
            saveLessons();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Makasih ya! Aku bakal belajar dari ini 🙏",
                show_alert: false
            });
        } else if (last && data === "positive") {
            // ReasoningBank: simpan strategi sukses
            const strategy = await extractSuccessStrategy(last.question, last.answer);
            successStrategies.strategies.push({
                strategy: strategy,
                keywords: last.question.toLowerCase().split(" ").slice(0, 5),
                timestamp: Date.now(),
                userId: chatId.toString()
            });
            if (successStrategies.strategies.length > 100) successStrategies.strategies = successStrategies.strategies.slice(-100);
            saveSuccessStrategies();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id,
                text: "Seneng bisa membantu! 😊",
                show_alert: false
            });
        }
        return res.sendStatus(200);
    }
    
    // Handle pesan biasa
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const userId = chatId.toString();
        const text = update.message.text;
        
        // Ambil memori user (LightAgent Mem0)
        const userMem = await getUserMemory(userId);
        const chatHistory = shortMemory.filter(m => m.userId === userId).slice(-5).map(m => `Kamu: ${m.q}\nAku: ${m.a}`).join("\n");
        
        // Deteksi suasana hati
        const mood = await detectMood(text);
        console.log(`😊 User ${userId} mood: ${mood} dari pesan: "${text.slice(0,50)}"`);
        
        // Update user memory
        await updateUserMemory(userId, text, "", mood);
        
        // Handle perintah
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "🧠 *ULTRA AI v5.0 - All-in-One*\n\nAku punya semua fitur canggih:\n✅ ReasoningBank (belajar dari sukses)\n✅ SAGE Reflection (Checker Agent)\n✅ LightAgent Mem0 (memori per user)\n✅ Ralph Wiggum (belajar dari kesalahan)\n✅ Adaptive Persona (deteksi suasana)\n✅ Gambar & Suara\n\nKirim pesan biasa, aku bakal jawab kayak teman!",
                parse_mode: "Markdown"
            });
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: `🎨 Lagi gambar: "${prompt}"... tunggu ya!`
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
                text: "🔊 Lagi bikin suara..."
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
        
        // Dapatkan preferensi dari user memory
        const userPreference = userMem.preferences?.favoriteStyle || "santai";
        
        const { answer, iteration } = await getUltraAnswer(finalQuestion, userId, mood, chatHistory, userPreference);
        
        // Simpan ke short memory dengan userId
        shortMemory.push({ userId, q: finalQuestion, a: answer, timestamp: Date.now(), mood });
        if (shortMemory.length > 200) shortMemory = shortMemory.slice(-200);
        saveMemory();
        
        // Update user memory dengan jawaban
        await updateUserMemory(userId, finalQuestion, answer, mood);
        
        const moodEmoji = { SEDIH: "🥺", MARAH: "😤", SENANG: "😄", BERCANDA: "😜", SERIUS: "🤔", NETRAL: "😊" };
        const answerWithInfo = `${moodEmoji[mood] || "💬"} *[${mood.toLowerCase()}|R${iteration}]*\n\n${answer}`;
        
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: answerWithInfo,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [[
                    { text: "✅ Membantu", callback_data: "positive" },
                    { text: "❌ Tidak membantu", callback_data: "negative" }
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
    console.log(`🚀 ULTRA AI v5.0 berjalan di port ${PORT}`);
    console.log(`📊 Fitur aktif: ReasoningBank + SAGE Reflection + LightAgent Mem0 + Ralph + Adaptive Persona`);
    console.log(`📊 ${Object.keys(userMemory).length} user terdaftar, ${lessons.rules.length} aturan, ${successStrategies.strategies.length} strategi sukses`);
    const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
        console.log(`✅ Webhook diset ke: ${webhookUrl}`);
    } catch (error) {
        console.error("❌ Gagal set webhook:", error.message);
    }
});
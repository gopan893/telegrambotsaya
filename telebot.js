const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const Redis = require('ioredis');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_NAME = process.env.REPO_NAME || "gopan893/telegrambotsaya";
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 3000;
const MAX_RALPH_ITERATIONS = 3;
const SELF_IMPROVE_INTERVAL = 50;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}
if (!REDIS_URL) {
    console.error("❌ ERROR: REDIS_URL tidak ditemukan! Gunakan Upstash Redis.");
    process.exit(1);
}

// ==================== KONEKSI REDIS ====================
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000)
});
redis.on('connect', () => console.log("✅ Redis terhubung"));
redis.on('error', (err) => console.error("❌ Redis error:", err));

// ==================== IN-MEMORY CACHE UNTUK DATA SEMENTARA (TIDAK DISIMPAN LAMA) ====================
let stats = { conversationCount: 0, lastSelfImprove: Date.now() };
let lessons = { rules: [], ralphLogs: [] };
let successStrategies = { strategies: [] };

// Fungsi untuk load data dari Redis saat startup
async function loadRedisData() {
    try {
        const statsRaw = await redis.get('stats');
        if (statsRaw) stats = JSON.parse(statsRaw);
        const lessonsRaw = await redis.get('lessons');
        if (lessonsRaw) lessons = JSON.parse(lessonsRaw);
        const successRaw = await redis.get('successStrategies');
        if (successRaw) successStrategies = JSON.parse(successRaw);
        console.log(`📂 Data dimuat: ${stats.conversationCount} percakapan, ${lessons.rules.length} aturan, ${successStrategies.strategies.length} strategi`);
    } catch(e) { console.log("📂 Gagal load dari Redis, mulai baru"); }
}

// Fungsi simpan ke Redis
async function saveStats() { await redis.set('stats', JSON.stringify(stats)); }
async function saveLessons() { await redis.set('lessons', JSON.stringify(lessons)); }
async function saveSuccessStrategies() { await redis.set('successStrategies', JSON.stringify(successStrategies)); }

// ==================== FUNGSI MEMORI PER USER (Redis Hash) ====================
async function getUserMemory(userId) {
    const key = `user:${userId}`;
    let mem = await redis.hgetall(key);
    if (!mem || Object.keys(mem).length === 0) {
        mem = {
            preferences: '{}',
            lastTopics: '[]',
            interactionCount: '0',
            firstSeen: Date.now().toString(),
            moodHistory: '[]'
        };
        await redis.hmset(key, mem);
    }
    return {
        preferences: JSON.parse(mem.preferences),
        lastTopics: JSON.parse(mem.lastTopics),
        interactionCount: parseInt(mem.interactionCount),
        firstSeen: parseInt(mem.firstSeen),
        moodHistory: JSON.parse(mem.moodHistory)
    };
}

async function updateUserMemory(userId, question, answer, mood) {
    const key = `user:${userId}`;
    let mem = await getUserMemory(userId);
    mem.interactionCount++;
    mem.lastTopics.unshift(question.slice(0, 100));
    if (mem.lastTopics.length > 10) mem.lastTopics.pop();
    mem.moodHistory.unshift({ mood, timestamp: Date.now() });
    if (mem.moodHistory.length > 20) mem.moodHistory.pop();
    await redis.hmset(key, {
        preferences: JSON.stringify(mem.preferences),
        lastTopics: JSON.stringify(mem.lastTopics),
        interactionCount: mem.interactionCount,
        firstSeen: mem.firstSeen,
        moodHistory: JSON.stringify(mem.moodHistory)
    });
    return mem;
}

async function saveShortMemory(userId, question, answer, mood) {
    const key = `short:${userId}`;
    await redis.lpush(key, JSON.stringify({ q: question, a: answer, mood, ts: Date.now() }));
    await redis.ltrim(key, 0, 99); // simpan 100 pesan terakhir per user
}

async function loadShortMemory(userId) {
    const key = `short:${userId}`;
    const items = await redis.lrange(key, 0, 99);
    return items.map(item => JSON.parse(item));
}

// ==================== FUNGSI AI (GROQ) ====================
async function askGroq(prompt, systemMsg) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemMsg || "Kamu teman ngobrol asyik, natural, pake 'aku/kamu'." },
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

// ==================== DETEKSI SUASANA ====================
async function detectMood(message) {
    const moodPrompt = `Tentukan suasana hati dari pesan ini: "${message}" Output hanya satu kata: SEDIH, MARAH, SENANG, BERCANDA, SERIUS, atau NETRAL.`;
    try {
        const mood = await askGroq(moodPrompt, "Output hanya satu kata.");
        return mood.trim().toUpperCase();
    } catch (error) {
        return "NETRAL";
    }
}

// ==================== SAGE CHECKER AGENT ====================
async function checkerAgent(question, draftAnswer) {
    const checkPrompt = `Evaluasi jawaban ini: Pertanyaan: "${question}" Jawaban: "${draftAnswer}"
Kriteria: relevan, informatif, aman.
Output format:
VALID: Ya/Tidak
SARAN: saran perbaikan jika tidak valid`;
    const result = await askGroq(checkPrompt, "Anda Checker Agent.");
    const isValid = result.includes("VALID: Ya");
    const suggestion = result.match(/SARAN: (.*)/)?.[1] || "";
    return { isValid, suggestion };
}

async function autoValidateAnswer(question, answer) {
    const res = await askGroq(`Apakah jawaban ini BAIK atau BURUK? Pertanyaan: "${question}" Jawaban: "${answer}" Output hanya BAIK atau BURUK.`, "Validator.");
    return res.trim().toUpperCase() === "BAIK";
}

async function extractLesson(question, badAnswer) {
    return await askGroq(`Ekstrak satu pelajaran (maks 30 kata) dari jawaban buruk ini: "${badAnswer}" untuk pertanyaan: "${question}" Output hanya pelajarannya.`, "Ekstraktor.");
}

async function extractSuccessStrategy(question, goodAnswer) {
    return await askGroq(`Ekstrak pola sukses (maks 30 kata) dari jawaban baik: "${goodAnswer}" untuk pertanyaan: "${question}" Output hanya polanya.`, "Ekstraktor.");
}

async function chatAIWithRalphAndChecker(question, userId, iteration = 1, previousLesson = "") {
    const relevantStrategies = successStrategies.strategies.slice(-2).map(s => s.strategy).join("\n");
    let prompt = question;
    if (previousLesson) prompt = `${question}\n\n⚠️ JANGAN: ${previousLesson}`;
    if (relevantStrategies) prompt = `${prompt}\n\n✅ POLA SUKSES: ${relevantStrategies}`;
    
    const draftAnswer = await askGroq(prompt);
    const { isValid, suggestion } = await checkerAgent(question, draftAnswer);
    if (isValid || iteration >= MAX_RALPH_ITERATIONS) return { answer: draftAnswer, iteration };
    
    const lesson = await extractLesson(question, draftAnswer);
    lessons.rules.push({ rule: lesson, source: "ralph", userId, timestamp: Date.now() });
    await saveLessons();
    
    const improvedAnswer = await askGroq(`${question}\n\n⚠️ SARAN: ${suggestion}`);
    return { answer: improvedAnswer, iteration: iteration + 1 };
}

// ==================== SYSTEM PROMPT DINAMIS ====================
function getDynamicSystemPrompt(mood, userHistory) {
    const base = "Kamu teman ngobrol asyik, natural, pake 'aku/kamu', gak pake 'saya/anda'. Bisa serius atau bercanda sesuai suasana.";
    const moodGuide = {
        SEDIH: "Tanggapi dengan empati, lembut.",
        MARAH: "Tetap tenang, akui perasaannya.",
        SENANG: "Ikut senang, bisa bercanda.",
        BERCANDA: "Balas dengan candaan.",
        SERIUS: "Jawab informatif tapi santai.",
        NETRAL: "Campur santai dan informatif."
    };
    return `${base}\nSUASANA: ${mood}\nPANDUAN: ${moodGuide[mood] || moodGuide.NETRAL}\nRIWAYAT: ${userHistory || "Belum ada"}`;
}

// ==================== GAMBAR & SUARA ====================
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

// ==================== SELF-IMPROVEMENT ====================
async function analyzeAndImproveCode() {
    if (!GITHUB_TOKEN) return;
    console.log("🧠 Self-improvement cycle...");
    try {
        const currentCode = require('fs').readFileSync(__filename, 'utf8');
        const analysisPrompt = `Analisis kode bot Telegram berikut. Identifikasi 3 kelemahan terbesar (performance, logic error, missing feature). Berikan kode perbaikan singkat. Output JSON: {"weaknesses":["..."],"fixedCode":"..."}`;
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: analysisPrompt + "\n\nKode:\n" + currentCode.slice(0, 5000) }], temperature: 0.3 },
            { headers: { "Authorization": `Bearer ${GROQ_API_KEY}` } }
        );
        const analysis = JSON.parse(response.data.choices[0].message.content);
        if (analysis.fixedCode && analysis.fixedCode !== currentCode) {
            const getFile = await axios.get(`https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`, { headers: { "Authorization": `token ${GITHUB_TOKEN}` } });
            await axios.put(`https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`, {
                message: `Self-improve: ${analysis.weaknesses.join(", ")}`,
                content: Buffer.from(analysis.fixedCode).toString('base64'),
                sha: getFile.data.sha
            }, { headers: { "Authorization": `token ${GITHUB_TOKEN}` } });
            console.log("✅ Self-improvement pushed to GitHub");
            stats.lastSelfImprove = Date.now();
            await saveStats();
        }
    } catch(e) { console.error("Self-improve error:", e.message); }
}

// ==================== JAWABAN UTAMA ====================
async function getUltraAnswer(question, userId, mood, chatHistory, userPreference) {
    const userMem = await getUserMemory(userId);
    const recentRules = lessons.rules.slice(-3).map(r => "- " + r.rule).join("\n");
    const recentSuccess = successStrategies.strategies.slice(-2).map(s => "- " + s.strategy).join("\n");
    const systemPrompt = getDynamicSystemPrompt(mood, `User ${userId} sudah ${userMem.interactionCount} kali chat.`);
    const enhancedQuestion = `Pertanyaan: "${question}"\nSUASANA: ${mood}\nRIWAYAT: ${userMem.lastTopics.slice(0,3).join(", ")}\nHINDARI: ${recentRules}\nGUNAKAN: ${recentSuccess}\nKONTEKS: ${chatHistory}\nJawab dengan gaya teman ngobrol, akhiri dengan pertanyaan balik.`;
    const { answer, iteration } = await chatAIWithRalphAndChecker(enhancedQuestion, userId);
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
        const msgId = update.callback_query.message.message_id;
        const last = lastResponse.get(`${chatId}_${msgId}`);
        if (last && data === "negative") {
            const lesson = await extractLesson(last.question, last.answer);
            lessons.rules.push({ rule: lesson, source: "user_feedback", userId: chatId.toString(), timestamp: Date.now() });
            await saveLessons();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Makasih! Aku belajar 🙏", show_alert: false });
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, { chat_id: chatId, message_id: msgId, text: "🙏 *Terima kasih! Aku akan belajar.*\n\n" + last.answer, parse_mode: "Markdown" });
        } else if (last && data === "positive") {
            const strategy = await extractSuccessStrategy(last.question, last.answer);
            successStrategies.strategies.push({ strategy, keywords: last.question.toLowerCase().split(" ").slice(0,5), timestamp: Date.now(), userId: chatId.toString() });
            if (successStrategies.strategies.length > 100) successStrategies.strategies = successStrategies.strategies.slice(-100);
            await saveSuccessStrategies();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Seneng membantu! 😊", show_alert: false });
        }
        return res.sendStatus(200);
    }
    
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const userId = chatId.toString();
        const text = update.message.text;
        
        stats.conversationCount++;
        if (stats.conversationCount % SELF_IMPROVE_INTERVAL === 0 && GITHUB_TOKEN) {
            await analyzeAndImproveCode();
        }
        await saveStats();
        
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🧠 *ULTRA AI v7.0 - Redis Edition*\n\n✅ Memori permanen (Redis)\n✅ Belajar dari sukses/gagal\n✅ Bisa gambar & suara\n✅ Self-improvement\nKirim pesan biasa, aku jawab kayak teman!", parse_mode: "Markdown" });
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🎨 Lagi gambar: "${prompt}"...` });
            const imageUrl = await generateImage(prompt);
            if (imageUrl) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: imageUrl, caption: `✨ Hasil: "${prompt}"` });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal buat gambar." });
            return res.sendStatus(200);
        }
        
        if (text.startsWith('/tts ')) {
            const ttsText = text.slice(5);
            if (!POLLINATIONS_API_KEY) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Fitur suara tidak tersedia." });
                return res.sendStatus(200);
            }
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🔊 Membuat suara..." });
            const audio = await textToSpeech(ttsText);
            if (audio) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, { chat_id: chatId, voice: audio.toString('base64'), caption: `🔊 "${ttsText}"` });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal buat suara." });
            return res.sendStatus(200);
        }
        
        let finalQuestion = text;
        if (text.startsWith('/chat ')) finalQuestion = text.slice(6);
        
        const mood = await detectMood(finalQuestion);
        const shortMem = await loadShortMemory(userId);
        const chatHistory = shortMem.slice(-5).map(m => `Kamu: ${m.q}\nAku: ${m.a}`).join("\n");
        const userPreference = (await getUserMemory(userId)).preferences.favoriteStyle || "santai";
        const { answer, iteration } = await getUltraAnswer(finalQuestion, userId, mood, chatHistory, userPreference);
        
        await saveShortMemory(userId, finalQuestion, answer, mood);
        await updateUserMemory(userId, finalQuestion, answer, mood);
        
        const moodEmoji = { SEDIH: "🥺", MARAH: "😤", SENANG: "😄", BERCANDA: "😜", SERIUS: "🤔", NETRAL: "😊" };
        const answerText = `${moodEmoji[mood] || "💬"} *[${mood.toLowerCase()}|R${iteration}]*\n\n${answer}`;
        
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: answerText,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "✅ Membantu", callback_data: "positive" }, { text: "❌ Tidak membantu", callback_data: "negative" }]] }
        });
        
        lastResponse.set(`${chatId}_${sent.data.result.message_id}`, { question: finalQuestion, answer });
        setTimeout(() => lastResponse.delete(`${chatId}_${sent.data.result.message_id}`), 600000);
    }
    res.sendStatus(200);
});

// ==================== START SERVER ====================
async function start() {
    await loadRedisData();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 ULTRA AI v7.0 (Redis) berjalan di port ${PORT}`);
        const webhookUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
        try {
            await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${webhookUrl}`);
            console.log(`✅ Webhook diset ke: ${webhookUrl}`);
        } catch (error) {
            console.error("❌ Gagal set webhook:", error.message);
        }
    });
}
start();
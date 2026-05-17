const express = require('express');
const axios = require('axios');
const { Redis } = require('@upstash/redis');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_NAME = process.env.REPO_NAME || "gopan893/telegrambotsaya";
const REDIS_URL = process.env.REDIS_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN;
const PORT = process.env.PORT || 3000;
const MAX_RALPH_ITERATIONS = 3;
const SELF_IMPROVE_INTERVAL = 50;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}
if (!REDIS_URL || !REDIS_TOKEN) {
    console.error("❌ REDIS_URL dan REDIS_TOKEN wajib diisi (dari Upstash)");
    process.exit(1);
}

// ==================== KONEKSI REDIS (Upstash) ====================
const redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
});
console.log("✅ Redis terhubung (Upstash)");

// ==================== DATA SEMENTARA (di memori) ====================
let stats = { conversationCount: 0, lastSelfImprove: Date.now() };
let lessons = { rules: [], ralphLogs: [] };
let successStrategies = { strategies: [] };

async function loadRedisData() {
    try {
        const s = await redis.get('stats');
        if (s) stats = JSON.parse(s);
        const l = await redis.get('lessons');
        if (l) lessons = JSON.parse(l);
        const ss = await redis.get('successStrategies');
        if (ss) successStrategies = JSON.parse(ss);
        console.log(`📂 Data dimuat: ${stats.conversationCount} percakapan, ${lessons.rules.length} aturan`);
    } catch(e) { console.log("⚠️ Gagal load dari Redis, mulai baru"); }
}
async function saveStats() { await redis.set('stats', JSON.stringify(stats)); }
async function saveLessons() { await redis.set('lessons', JSON.stringify(lessons)); }
async function saveSuccessStrategies() { await redis.set('successStrategies', JSON.stringify(successStrategies)); }

// ==================== MEMORI PER USER ====================
async function getUserMemory(userId) {
    const key = `user:${userId}`;
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
        const defaultMem = {
            preferences: '{}',
            lastTopics: '[]',
            interactionCount: '0',
            firstSeen: Date.now().toString(),
            moodHistory: '[]'
        };
        await redis.hset(key, defaultMem);
        return {
            preferences: {},
            lastTopics: [],
            interactionCount: 0,
            firstSeen: parseInt(defaultMem.firstSeen),
            moodHistory: []
        };
    }
    return {
        preferences: JSON.parse(data.preferences || '{}'),
        lastTopics: JSON.parse(data.lastTopics || '[]'),
        interactionCount: parseInt(data.interactionCount || '0'),
        firstSeen: parseInt(data.firstSeen || Date.now()),
        moodHistory: JSON.parse(data.moodHistory || '[]')
    };
}
async function updateUserMemory(userId, question, answer, mood) {
    const key = `user:${userId}`;
    let mem = await getUserMemory(userId);
    mem.interactionCount++;
    mem.lastTopics.unshift(question.slice(0,100));
    if (mem.lastTopics.length > 10) mem.lastTopics.pop();
    mem.moodHistory.unshift({ mood, timestamp: Date.now() });
    if (mem.moodHistory.length > 20) mem.moodHistory.pop();
    await redis.hset(key, {
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
    await redis.ltrim(key, 0, 99);
}
async function loadShortMemory(userId) {
    const key = `short:${userId}`;
    const items = await redis.lrange(key, 0, 99);
    return items.map(i => JSON.parse(i));
}

// ==================== FUNGSI AI ====================
async function askGroq(prompt, systemMsg) {
    try {
        const res = await axios.post(
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
        return res.data.choices[0].message.content;
    } catch(e) {
        console.error("Groq error:", e.message);
        return "Maaf, lagi error. Coba lagi ya?";
    }
}
async function detectMood(text) {
    const mood = await askGroq(`Tentukan suasana hati dari: "${text}" (SEDIH/MARAH/SENANG/BERCANDA/SERIUS/NETRAL)`, "Output satu kata.");
    return mood.trim().toUpperCase();
}
async function checkerAgent(question, draft) {
    const result = await askGroq(`Evaluasi jawaban: Q:"${question}" A:"${draft}" Valid? (Ya/Tidak) dan saran singkat. Format: VALID: Ya/Tidak SARAN: ...`, "Checker");
    const isValid = result.includes("VALID: Ya");
    const suggestion = result.match(/SARAN: (.*)/)?.[1] || "";
    return { isValid, suggestion };
}
async function autoValidate(question, answer) {
    const res = await askGroq(`Apakah jawaban ini BAIK atau BURUK? Q:"${question}" A:"${answer}"`, "Output hanya BAIK/BURUK");
    return res.trim().toUpperCase() === "BAIK";
}
async function extractLesson(question, bad) {
    return await askGroq(`Ekstrak pelajaran (max 30 kata) dari jawaban buruk: "${bad}" untuk Q:"${question}"`, "Output hanya pelajaran");
}
async function extractStrategy(question, good) {
    return await askGroq(`Ekstrak pola sukses (max 30 kata) dari jawaban baik: "${good}" untuk Q:"${question}"`, "Output hanya pola");
}
async function chatAIWithRalph(question, userId, iter=1, prevLesson="") {
    const recentStrategies = successStrategies.strategies.slice(-2).map(s=>s.strategy).join("\n");
    let prompt = question;
    if (prevLesson) prompt = `${question}\n⚠️ JANGAN: ${prevLesson}`;
    if (recentStrategies) prompt += `\n✅ POLA SUKSES: ${recentStrategies}`;
    let draft = await askGroq(prompt);
    const { isValid, suggestion } = await checkerAgent(question, draft);
    if (isValid || iter >= MAX_RALPH_ITERATIONS) return { answer: draft, iteration: iter };
    const lesson = await extractLesson(question, draft);
    lessons.rules.push({ rule: lesson, source: "ralph", userId, ts: Date.now() });
    await saveLessons();
    const improved = await askGroq(`${question}\n⚠️ SARAN: ${suggestion}`);
    return { answer: improved, iteration: iter+1 };
}

// ==================== PERSONA DINAMIS ====================
function dynamicPrompt(mood, userHistory) {
    const guide = {
        SEDIH: "Tanggapi dengan empati.",
        MARAH: "Tenang, akui perasaan.",
        SENANG: "Gembira, bisa bercanda.",
        BERCANDA: "Balas canda.",
        SERIUS: "Informatif tapi santai.",
        NETRAL: "Campur santai."
    };
    return `Kamu teman ngobrol, pake 'aku/kamu'. Suasana user: ${mood}. Panduan: ${guide[mood]||guide.NETRAL}. Riwayat: ${userHistory||"tidak ada"}`;
}

// ==================== GAMBAR & SUARA ====================
async function generateImage(prompt, retry=0) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch(e) {
        if (retry<3) { await new Promise(r=>setTimeout(r,3000*(retry+1))); return generateImage(prompt, retry+1); }
        return null;
    }
}
async function textToSpeech(text) {
    if (!POLLINATIONS_API_KEY) return null;
    try {
        const resp = await axios.post("https://text.pollinations.ai/openai", {
            model: "openai-audio",
            modalities: ["text","audio"],
            audio: { voice: "echo", format: "mp3" },
            messages: [{ role: "user", content: text }]
        }, {
            headers: { Authorization: `Bearer ${POLLINATIONS_API_KEY}` },
            responseType: 'arraybuffer',
            timeout: 20000
        });
        return Buffer.from(resp.data);
    } catch(e) { console.error("TTS error:", e.message); return null; }
}

// ==================== SELF-IMPROVEMENT ====================
async function selfImprove() {
    if (!GITHUB_TOKEN) return;
    console.log("🧠 Self-improvement...");
    try {
        const fs = require('fs');
        const current = fs.readFileSync(__filename, 'utf8');
        const analysis = await askGroq(`Analisis kode bot ini. Berikan 3 kelemahan dan kode perbaikan singkat. Output JSON: {"weaknesses":["..."],"fixedCode":"..."}`, "Analyst");
        const json = JSON.parse(analysis);
        if (json.fixedCode && json.fixedCode !== current) {
            const get = await axios.get(`https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
            await axios.put(`https://api.github.com/repos/${REPO_NAME}/contents/telebot.js`, {
                message: `Self-improve: ${json.weaknesses.join(", ")}`,
                content: Buffer.from(json.fixedCode).toString('base64'),
                sha: get.data.sha
            }, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
            console.log("✅ Self-improvement pushed");
            stats.lastSelfImprove = Date.now();
            await saveStats();
        }
    } catch(e) { console.error("Self-improve error:", e.message); }
}

// ==================== JAWABAN UTAMA ====================
async function getAnswer(question, userId, mood, history) {
    const userMem = await getUserMemory(userId);
    const rules = lessons.rules.slice(-3).map(r=>`- ${r.rule}`).join("\n");
    const strategies = successStrategies.strategies.slice(-2).map(s=>`- ${s.strategy}`).join("\n");
    const sysPrompt = dynamicPrompt(mood, `User ${userId} sudah ${userMem.interactionCount} chat.`);
    const enhanced = `Pertanyaan: "${question}"\nSuasana: ${mood}\nHindari:\n${rules||"-"}\nGunakan:\n${strategies||"-"}\nRiwayat:\n${history||"-"}\nJawab gaya teman, akhiri dengan pertanyaan balik.`;
    const { answer, iteration } = await chatAIWithRalph(enhanced, userId);
    return { answer, iteration };
}

// ==================== WEBHOOK SERVER ====================
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
            lessons.rules.push({ rule: lesson, source: "user", userId: chatId.toString(), ts: Date.now() });
            await saveLessons();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Makasih, aku belajar 🙏" });
        } else if (last && data === "positive") {
            const strat = await extractStrategy(last.question, last.answer);
            successStrategies.strategies.push({ strategy: strat, keywords: last.question.toLowerCase().split(" ").slice(0,5), ts: Date.now(), userId: chatId.toString() });
            if (successStrategies.strategies.length > 100) successStrategies.strategies = successStrategies.strategies.slice(-100);
            await saveSuccessStrategies();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Seneng membantu! 😊" });
        }
        return res.sendStatus(200);
    }
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const userId = chatId.toString();
        const text = update.message.text;
        stats.conversationCount++;
        if (stats.conversationCount % SELF_IMPROVE_INTERVAL === 0 && GITHUB_TOKEN) await selfImprove();
        await saveStats();
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🧠 *AI v8.0 - Redis Final*\n✅ Memori permanen\n✅ Belajar dari sukses/gagal\n✅ Gambar & suara\n✅ Self-improvement\nKirim pesan biasa!", parse_mode: "Markdown" });
            return res.sendStatus(200);
        }
        if (text.startsWith('/image ')) {
            const prompt = text.slice(7);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🎨 Lagi gambar: "${prompt}"...` });
            const img = await generateImage(prompt);
            if (img) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: img, caption: `✨ ${prompt}` });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal buat gambar." });
            return res.sendStatus(200);
        }
        if (text.startsWith('/tts ')) {
            const t = text.slice(5);
            if (!POLLINATIONS_API_KEY) { await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Fitur suara tidak aktif." }); return res.sendStatus(200); }
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🔊 Membuat suara..." });
            const audio = await textToSpeech(t);
            if (audio) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, { chat_id: chatId, voice: audio.toString('base64'), caption: `🔊 "${t}"` });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal." });
            return res.sendStatus(200);
        }
        let question = text;
        if (text.startsWith('/chat ')) question = text.slice(6);
        const mood = await detectMood(question);
        const short = await loadShortMemory(userId);
        const history = short.slice(-5).map(m => `Kamu: ${m.q}\nAku: ${m.a}`).join("\n");
        const { answer, iteration } = await getAnswer(question, userId, mood, history);
        await saveShortMemory(userId, question, answer, mood);
        await updateUserMemory(userId, question, answer, mood);
        const emoji = { SEDIH:"🥺", MARAH:"😤", SENANG:"😄", BERCANDA:"😜", SERIUS:"🤔", NETRAL:"😊" };
        const reply = `${emoji[mood]||"💬"} *[${mood.toLowerCase()}|R${iteration}]*\n\n${answer}`;
        const sent = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: reply,
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "✅ Membantu", callback_data: "positive" }, { text: "❌ Tidak membantu", callback_data: "negative" }]] }
        });
        lastResponse.set(`${chatId}_${sent.data.result.message_id}`, { question, answer });
        setTimeout(() => lastResponse.delete(`${chatId}_${sent.data.result.message_id}`), 600000);
    }
    res.sendStatus(200);
});

// ==================== START ====================
async function start() {
    await loadRedisData();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`🚀 Bot AI v8.0 berjalan di port ${PORT}`);
        const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
        try {
            await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
            console.log(`✅ Webhook diset ke ${url}`);
        } catch(e) { console.error("Webhook error:", e.message); }
    });
}
start();
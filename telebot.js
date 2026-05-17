const express = require('express');
const axios = require('axios');
const fs = require('fs');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_NAME = process.env.REPO_NAME || "gopan893/telegrambotsaya";
const PORT = process.env.PORT || 3000;
const MAX_RALPH_ITERATIONS = 3;
const SELF_IMPROVE_INTERVAL = 50;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ ERROR: TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan di environment variables.");
    process.exit(1);
}

// ==================== REDIS (Opsional, dengan Fallback) ====================
let redis = null;
let useRedis = false;
try {
    const { Redis } = require('@upstash/redis');
    const REDIS_URL = process.env.REDIS_URL;
    const REDIS_TOKEN = process.env.REDIS_TOKEN;
    if (REDIS_URL && REDIS_TOKEN) {
        redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
        useRedis = true;
        console.log("✅ Redis (Upstash) terhubung");
    } else {
        console.warn("⚠️ REDIS_URL atau REDIS_TOKEN tidak diset. Menggunakan penyimpanan lokal (file JSON). Data akan hilang saat redeploy.");
    }
} catch (err) {
    console.warn("⚠️ Modul @upstash/redis tidak terinstall. Install dengan 'npm install @upstash/redis'. Menggunakan penyimpanan lokal.");
}

// ==================== MEMORI LOKAL (FALLBACK) ====================
const MEMORY_FILE = 'local_memory.json';
let localMemory = { stats: { conversationCount: 0, lastSelfImprove: Date.now() }, lessons: { rules: [] }, successStrategies: { strategies: [] }, userMemories: {}, shortMemories: {} };

function loadLocalMemory() {
    try { if (fs.existsSync(MEMORY_FILE)) localMemory = JSON.parse(fs.readFileSync(MEMORY_FILE)); } catch(e) {}
}
function saveLocalMemory() { fs.writeFileSync(MEMORY_FILE, JSON.stringify(localMemory)); }
loadLocalMemory();

// ==================== FUNGSI MEMORI (Abstraksi) ====================
async function getSet(key, defaultValue = null) {
    if (useRedis) {
        const val = await redis.get(key);
        return val ? JSON.parse(val) : defaultValue;
    } else {
        const parts = key.split('.');
        let obj = localMemory;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        return obj[parts[parts.length-1]] !== undefined ? obj[parts[parts.length-1]] : defaultValue;
    }
}
async function setSet(key, value) {
    if (useRedis) {
        await redis.set(key, JSON.stringify(value));
    } else {
        const parts = key.split('.');
        let obj = localMemory;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length-1]] = value;
        saveLocalMemory();
    }
}
async function hgetSet(hash, field) {
    if (useRedis) {
        const val = await redis.hget(hash, field);
        return val ? JSON.parse(val) : null;
    } else {
        const mem = localMemory.userMemories[hash];
        return mem ? mem[field] : null;
    }
}
async function hsetSet(hash, field, value) {
    if (useRedis) {
        await redis.hset(hash, { [field]: JSON.stringify(value) });
    } else {
        if (!localMemory.userMemories[hash]) localMemory.userMemories[hash] = {};
        localMemory.userMemories[hash][field] = value;
        saveLocalMemory();
    }
}
async function lpushSet(key, value) {
    if (useRedis) {
        await redis.lpush(key, JSON.stringify(value));
    } else {
        if (!localMemory.shortMemories[key]) localMemory.shortMemories[key] = [];
        localMemory.shortMemories[key].unshift(value);
        if (localMemory.shortMemories[key].length > 100) localMemory.shortMemories[key].pop();
        saveLocalMemory();
    }
}
async function lrangeSet(key, start, stop) {
    if (useRedis) {
        const items = await redis.lrange(key, start, stop);
        return items.map(i => JSON.parse(i));
    } else {
        const arr = localMemory.shortMemories[key] || [];
        return arr.slice(start, stop+1);
    }
}
async function ltrimSet(key, start, stop) {
    if (useRedis) {
        await redis.ltrim(key, start, stop);
    } else {
        if (localMemory.shortMemories[key]) {
            localMemory.shortMemories[key] = localMemory.shortMemories[key].slice(start, stop+1);
            saveLocalMemory();
        }
    }
}

// ==================== FUNGSI AI (GROQ) ====================
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
async function extractLesson(question, bad) {
    return await askGroq(`Ekstrak pelajaran (max 30 kata) dari jawaban buruk: "${bad}" untuk Q:"${question}"`, "Output hanya pelajaran");
}
async function extractStrategy(question, good) {
    return await askGroq(`Ekstrak pola sukses (max 30 kata) dari jawaban baik: "${good}" untuk Q:"${question}"`, "Output hanya pola");
}
async function chatAIWithRalph(question, userId, iter=1, prevLesson="") {
    let lessons = await getSet('lessons', { rules: [] });
    let successStrategies = await getSet('successStrategies', { strategies: [] });
    const recentStrategies = successStrategies.strategies.slice(-2).map(s=>s.strategy).join("\n");
    let prompt = question;
    if (prevLesson) prompt = `${question}\n⚠️ JANGAN: ${prevLesson}`;
    if (recentStrategies) prompt += `\n✅ POLA SUKSES: ${recentStrategies}`;
    let draft = await askGroq(prompt);
    const { isValid, suggestion } = await checkerAgent(question, draft);
    if (isValid || iter >= MAX_RALPH_ITERATIONS) return { answer: draft, iteration: iter };
    const lesson = await extractLesson(question, draft);
    lessons.rules.push({ rule: lesson, source: "ralph", userId, ts: Date.now() });
    await setSet('lessons', lessons);
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

// ==================== MEMORI PER USER ====================
async function getUserMemory(userId) {
    if (useRedis) {
        const data = await redis.hgetall(`user:${userId}`);
        if (!data || Object.keys(data).length === 0) {
            const def = { preferences: '{}', lastTopics: '[]', interactionCount: '0', firstSeen: Date.now().toString(), moodHistory: '[]' };
            await redis.hset(`user:${userId}`, def);
            return { preferences: {}, lastTopics: [], interactionCount: 0, firstSeen: Date.now(), moodHistory: [] };
        }
        return {
            preferences: JSON.parse(data.preferences || '{}'),
            lastTopics: JSON.parse(data.lastTopics || '[]'),
            interactionCount: parseInt(data.interactionCount || '0'),
            firstSeen: parseInt(data.firstSeen || Date.now()),
            moodHistory: JSON.parse(data.moodHistory || '[]')
        };
    } else {
        if (!localMemory.userMemories[userId]) {
            localMemory.userMemories[userId] = { preferences: {}, lastTopics: [], interactionCount: 0, firstSeen: Date.now(), moodHistory: [] };
            saveLocalMemory();
        }
        return localMemory.userMemories[userId];
    }
}
async function updateUserMemory(userId, question, answer, mood) {
    let mem = await getUserMemory(userId);
    mem.interactionCount++;
    mem.lastTopics.unshift(question.slice(0,100));
    if (mem.lastTopics.length > 10) mem.lastTopics.pop();
    mem.moodHistory.unshift({ mood, timestamp: Date.now() });
    if (mem.moodHistory.length > 20) mem.moodHistory.pop();
    if (useRedis) {
        await redis.hset(`user:${userId}`, {
            preferences: JSON.stringify(mem.preferences),
            lastTopics: JSON.stringify(mem.lastTopics),
            interactionCount: mem.interactionCount,
            firstSeen: mem.firstSeen,
            moodHistory: JSON.stringify(mem.moodHistory)
        });
    } else {
        localMemory.userMemories[userId] = mem;
        saveLocalMemory();
    }
    return mem;
}
async function saveShortMemory(userId, question, answer, mood) {
    const key = `short:${userId}`;
    await lpushSet(key, { q: question, a: answer, mood, ts: Date.now() });
    await ltrimSet(key, 0, 99);
}
async function loadShortMemory(userId) {
    const key = `short:${userId}`;
    return await lrangeSet(key, 0, 99);
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
            let stats = await getSet('stats', { conversationCount: 0, lastSelfImprove: Date.now() });
            stats.lastSelfImprove = Date.now();
            await setSet('stats', stats);
        }
    } catch(e) { console.error("Self-improve error:", e.message); }
}

// ==================== JAWABAN UTAMA ====================
async function getAnswer(question, userId, mood, history) {
    const userMem = await getUserMemory(userId);
    let lessons = await getSet('lessons', { rules: [] });
    let successStrategies = await getSet('successStrategies', { strategies: [] });
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
            let lessons = await getSet('lessons', { rules: [] });
            lessons.rules.push({ rule: lesson, source: "user", userId: chatId.toString(), ts: Date.now() });
            await setSet('lessons', lessons);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Makasih, aku belajar 🙏" });
        } else if (last && data === "positive") {
            const strat = await extractStrategy(last.question, last.answer);
            let successStrategies = await getSet('successStrategies', { strategies: [] });
            successStrategies.strategies.push({ strategy: strat, keywords: last.question.toLowerCase().split(" ").slice(0,5), ts: Date.now(), userId: chatId.toString() });
            if (successStrategies.strategies.length > 100) successStrategies.strategies = successStrategies.strategies.slice(-100);
            await setSet('successStrategies', successStrategies);
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: update.callback_query.id, text: "Seneng membantu! 😊" });
        }
        return res.sendStatus(200);
    }
    if (update.message && !update.message.from.is_bot) {
        const chatId = update.message.chat.id;
        const userId = chatId.toString();
        const text = update.message.text;
        let stats = await getSet('stats', { conversationCount: 0, lastSelfImprove: Date.now() });
        stats.conversationCount++;
        if (stats.conversationCount % SELF_IMPROVE_INTERVAL === 0 && GITHUB_TOKEN) await selfImprove();
        await setSet('stats', stats);
        if (text === '/start') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🧠 *AI v9.0 - Final Stable*\n✅ Memori permanen (Redis/lokal)\n✅ Belajar dari sukses/gagal\n✅ Gambar & suara\n✅ Self-improvement\nKirim pesan biasa!", parse_mode: "Markdown" });
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

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Bot AI v9.0 berjalan di port ${PORT}`);
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
        console.log(`✅ Webhook diset ke ${url}`);
    } catch(e) { console.error("Webhook error:", e.message); }
});
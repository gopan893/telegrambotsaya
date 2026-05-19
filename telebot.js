const express = require('express');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const { Mistral } = require('@mistralai/mistralai');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 10000;

if (!TELEGRAM_TOKEN) {
    console.error("❌ TELEGRAM_TOKEN tidak ditemukan!");
    process.exit(1);
}
if (!MISTRAL_API_KEY && !GROQ_API_KEY) {
    console.error("❌ Tidak ada API key AI (Mistral atau Groq)!");
    process.exit(1);
}

// ==================== MEMORI PERSISTEN ====================
let redisClient = null;
let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];

async function initRedis() {
    if (!REDIS_URL) return;
    try {
        const Redis = require('ioredis');
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => times > 3 ? null : Math.min(times * 100, 3000)
        });
        await redisClient.ping();
        console.log("✅ Redis terhubung.");
    } catch (e) {
        console.log("⚠️ Redis gagal, pakai file JSON.");
        redisClient = null;
    }
}

async function loadData(key, defaultValue) {
    if (redisClient) {
        try {
            const val = await redisClient.get(key);
            if (val) return JSON.parse(val);
        } catch (e) {}
    }
    try {
        if (fs.existsSync(`${key}.json`)) return JSON.parse(fs.readFileSync(`${key}.json`));
    } catch (e) {}
    return defaultValue;
}

async function saveData(key, data) {
    const str = JSON.stringify(data);
    if (redisClient) await redisClient.set(key, str);
    fs.writeFileSync(`${key}.json`, str);
}

async function loadAllMemories() {
    shortMemory = await loadData('memory', []);
    lessons = await loadData('lessons', { rules: [] });
    userMemory = await loadData('user_memory', {});
    abLog = await loadData('ab_log', []);
    console.log(`📂 Memori: ${shortMemory.length} chat, ${lessons.rules.length} aturan`);
}

function saveAll() {
    saveData('memory', shortMemory.slice(-500));
    saveData('lessons', lessons);
    saveData('user_memory', userMemory);
    saveData('ab_log', abLog.slice(-1000));
}

// ==================== WATCHDOG ====================
setInterval(() => {
    const mem = process.memoryUsage();
    if (mem.heapUsed / mem.heapTotal > 0.95) {
        console.error('⚠️ Memory >95%, exit');
        process.exit(1);
    }
}, 60000);

// ==================== SYSTEM PROMPT DINAMIS (BERDASARKAN NAMA YANG DISIMPAN) ====================
function getSystemPrompt(userId) {
    const botName = userMemory[userId]?.botName || "Bot Desa";
    return `Kamu adalah asisten pribadi bernama "${botName}" yang ramah dan cerdas. 
Aturan:
1. Jawab langsung ke pertanyaan, jangan bertele-tele. Maksimal 3-4 kalimat.
2. Gunakan bahasa Indonesia sehari-hari, panggil dirimu "aku" dan panggil user "kamu". Hindari bahasa formal seperti "saya" dan "anda".
3. Jika tidak tahu jawabannya, katakan "Maaf, aku tidak tahu" — JANGAN mengarang informasi.
4. Jika user bertanya tentang tanggal/waktu terkini, arahkan ke perintah /tanggal atau /jam.
5. Jangan menyebutkan bahwa kamu adalah AI atau model bahasa, kecuali ditanya.
6. Nama kamu adalah "${botName}". Jika user menanyakan namamu, jawab sesuai nama itu.
7. Bersikap sopan dan membantu.`;
}

// ==================== FUNGSI AI DENGAN SYSTEM PROMPT DINAMIS ====================
async function askMistral(prompt, systemPrompt) {
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY tidak diset");
    const client = new Mistral({ apiKey: MISTRAL_API_KEY });
    const response = await client.chat.complete({
        model: "mistral-large-latest",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
    });
    return response.choices[0].message.content;
}

async function askGroq(prompt, systemPrompt) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY tidak diset");
    const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
    }, {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 15000
    });
    return res.data.choices[0].message.content;
}

async function askAI(prompt, systemPrompt) {
    if (MISTRAL_API_KEY) {
        try {
            console.log("🟢 Mistral...");
            const answer = await askMistral(prompt, systemPrompt);
            console.log("✅ Mistral sukses");
            return answer;
        } catch (err) {
            console.error("Mistral gagal:", err.message);
        }
    }
    if (GROQ_API_KEY) {
        try {
            console.log("🟡 Groq...");
            const answer = await askGroq(prompt, systemPrompt);
            console.log("✅ Groq sukses");
            return answer;
        } catch (err) {
            console.error("Groq gagal:", err.message);
        }
    }
    throw new Error("Semua AI gagal.");
}

// ==================== DETEKSI BAHASA SEDERHANA ====================
function simpleDetectLanguage(text) {
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
    if (/[ăâđêôơư]/.test(text)) return 'vi';
    return 'id';
}

// ==================== SAFE SEND MESSAGE ====================
async function safeSendMessage(chatId, text, extra = {}) {
    const payload = { chat_id: chatId, text: text, ...extra };
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, payload);
    } catch (err) {
        if (err.response && err.response.status === 400 && extra.reply_to_message_id) {
            delete extra.reply_to_message_id;
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: text,
                ...extra
            });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: "Maaf, terjadi kesalahan teknis."
            });
        }
    }
}

// ==================== RINGKASAN & REKOMENDASI ====================
async function summarizeChat(userId, history, systemPrompt) {
    if (history.length < 10) return;
    try {
        const summary = await askAI(`Ringkas percakapan ini (maks 100 kata):\n${history}`, systemPrompt);
        if (!userMemory[userId]) userMemory[userId] = {};
        userMemory[userId].summary = summary;
        saveAll();
    } catch (e) {}
}

async function getTopicSuggestion(question, answer, systemPrompt) {
    try {
        const prompt = `Berdasarkan Q: "${question}" dan A: "${answer}", beri 2 pertanyaan lanjutan (format 1. ... 2. ...)`;
        return await askAI(prompt, systemPrompt);
    } catch { return null; }
}

// ==================== TOOLS ====================
function getCurrentTime() {
    return `🕒 Waktu Jepang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Tokyo', hour:'2-digit', minute:'2-digit', second:'2-digit' })}`;
}
function getCurrentDate() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const tanggal = now.toLocaleDateString('id-ID', options);
    return `📅 Hari ini: ${tanggal}`;
}
function calculate(expr) {
    try {
        let clean = expr.replace(/[^0-9+\-*/().%]/g, '');
        if (!clean) return "Format salah";
        return `Hasil: ${expr} = ${eval(clean)}`;
    } catch { return "Error hitung"; }
}
async function searchLocation(query) {
    try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { headers: { 'User-Agent': 'TelegramBot/1.0' } });
        if (!res.data.length) return "Tidak ditemukan";
        const p = res.data[0];
        return `📍 ${p.display_name}\n🗺️ https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}`;
    } catch { return "Error lokasi"; }
}
async function getWeather(city) {
    if (!OPENWEATHER_API_KEY) return "API key cuaca tidak ada";
    try {
        const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`);
        const d = res.data;
        return `🌤️ Cuaca ${d.name}: ${d.main.temp}°C, ${d.weather[0].description}`;
    } catch { return `Kota ${city} tidak ditemukan`; }
}
async function searchWebTavily(query) {
    if (!TAVILY_API_KEY) return "API key Tavily tidak ada";
    try {
        const res = await axios.post('https://api.tavily.com/search', { api_key: TAVILY_API_KEY, query, search_depth: "basic", max_results: 3, include_answer: true });
        let out = `🔍 Hasil untuk: ${query}\n`;
        if (res.data.answer) out += `📝 ${res.data.answer}\n`;
        (res.data.results || []).forEach((item,i) => out += `${i+1}. ${item.title}\n   ${item.content.slice(0,150)}...\n   ${item.url}\n`);
        return out;
    } catch { return "Error web search"; }
}
async function generateImage(prompt, retry=0) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
    try {
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch {
        if (retry < 2) {
            await new Promise(r => setTimeout(r, 3000));
            return generateImage(prompt, retry+1);
        }
        return null;
    }
}
function crackHash(targetHash, maxLen=6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    function brute(cur, len) {
        if (cur.length === len) return crypto.createHash('md5').update(cur).digest('hex') === targetHash ? cur : null;
        for (let i=0; i<chars.length; i++) {
            const r = brute(cur+chars[i], len);
            if (r) return r;
        }
        return null;
    }
    for (let l=1; l<=maxLen; l++) {
        const found = brute('', l);
        if (found) return found;
    }
    return null;
}
async function handleTools(msg) {
    const low = msg.toLowerCase();
    if (low.includes('tanggal') && (low.includes('berapa') || low.includes('hari ini'))) return getCurrentDate();
    if (low.includes('jam') || low.includes('waktu')) return getCurrentTime();
    if ((low.includes('hitung') || low.match(/\d+[\+\-\*\/]\d+/)) && !low.includes('cuaca')) {
        let expr = msg.replace(/[^0-9+\-*/().%]/g, '');
        if (expr) return calculate(expr);
    }
    if (low.includes('alamat') || low.includes('lokasi') || low.includes('dimana')) {
        let q = msg.replace(/alamat|lokasi|dimana|cari tempat/gi, '').trim();
        return q ? await searchLocation(q) : "Sebutkan tempat";
    }
    if (low.includes('cuaca')) {
        let city = msg.replace(/cuaca|weather|di|kota/gi, '').trim();
        return city ? await getWeather(city) : "Contoh: cuaca Tokyo";
    }
    const searchKw = ['cari', 'search', 'google', 'apa itu', 'informação', 'berita'];
    if (searchKw.some(k => low.includes(k))) {
        let q = msg;
        searchKw.forEach(k => q = q.replace(new RegExp(k, 'gi'), ''));
        q = q.trim();
        return q ? await searchWebTavily(q) : "Apa yang ingin dicari?";
    }
    return null;
}

// ==================== MEMORY & A/B ====================
function getCachedAnswer(question) {
    const match = lessons.rules.find(r => question.toLowerCase().includes(r.trigger?.toLowerCase() || ''));
    return match ? match.answer : null;
}
async function getAnswerWithAB(question, userId, systemPrompt) {
    const chosen = Math.random() > 0.5 ? 'santai' : 'formal';
    const prompt = chosen === 'santai' 
        ? `Jawab dengan santai (pake 'aku','kamu'): ${question}` 
        : `Jawab informatif: ${question}`;
    const answer = await askAI(prompt, systemPrompt);
    abLog.push({ userId, question, chosen, answer, timestamp: Date.now() });
    if (abLog.length > 1000) abLog.shift();
    saveAll();
    return { answer, style: chosen };
}
async function getSmartAnswer(question, userId, systemPrompt) {
    const cached = getCachedAnswer(question);
    if (cached) return cached;
    const needsFresh = ['terbaru','berita','update','sekarang','harga','skor'].some(k => question.toLowerCase().includes(k));
    if (needsFresh && TAVILY_API_KEY) {
        const searchRes = await searchWebTavily(question);
        if (searchRes && !searchRes.includes('Error')) {
            const learned = await askAI(`Berdasarkan pencarian: ${searchRes}\nJawab: ${question}`, systemPrompt);
            lessons.rules.push({ trigger: question.slice(0,50), answer: learned, source:'auto', timestamp: Date.now() });
            if (lessons.rules.length > 200) lessons.rules.shift();
            saveAll();
            return learned;
        }
    }
    const similar = shortMemory.filter(m => m.userId === userId).slice(-5).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
    const context = similar ? `Konteks:\n${similar}\n\n` : '';
    const { answer } = await getAnswerWithAB(context + question, userId, systemPrompt);
    shortMemory.push({ userId, q: question, a: answer, timestamp: Date.now() });
    if (shortMemory.length > 500) shortMemory.shift();
    saveAll();
    return answer;
}

// ==================== WEBHOOK SERVER ====================
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.send('OK'));

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        if (cb.data === 'positive') {
            await safeSendMessage(chatId, "👍 Terima kasih!");
        } else {
            await safeSendMessage(chatId, "👎 Gunakan /koreksi untuk mengajari saya.");
        }
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: cb.id });
        return res.sendStatus(200);
    }
    if (!update.message || update.message.from.is_bot) return res.sendStatus(200);
    const chatId = update.message.chat.id;
    const userId = chatId.toString();
    const msg = update.message;
    const text = msg.text;

    // Pastikan userMemory untuk user ini ada
    if (!userMemory[userId]) userMemory[userId] = { botName: "Bot Desa" };

    // ========== PERINTAH ==========
    if (text === '/start') {
        await safeSendMessage(chatId, `🤖 Halo! Aku ${userMemory[userId].botName}, asisten pribadimu. Ketik /help untuk perintah.`, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/help') {
        const help = `/start - mulai\n/help - bantuan\n/stats - statistik\n/rollback - hapus aturan\n/feedback - log A/B\n/image <desc> - gambar\n/crack <hash> - crack\n/hitung <expr> - kalkulator\n/jam - waktu Jepang\n/tanggal - tanggal hari ini\n/cuaca <kota>\n/lokasi <tempat>\n/cari <topik>\n/setname <nama> - ganti nama panggilanku\n/koreksi Q | A - ajari bot`;
        await safeSendMessage(chatId, help, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/stats') {
        const mem = process.memoryUsage();
        const msgText = `Uptime: ${Math.floor(process.uptime()/60)} menit\nMemory: ${(mem.heapUsed/1024/1024).toFixed(2)} MB\nAturan: ${lessons.rules.length}\nChats: ${shortMemory.length}`;
        await safeSendMessage(chatId, msgText, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/rollback') {
        if (lessons.rules.length) {
            lessons.rules.pop();
            saveAll();
            await safeSendMessage(chatId, "🗑️ Aturan terakhir dihapus.", { reply_to_message_id: msg.message_id });
        } else await safeSendMessage(chatId, "Tidak ada aturan.", { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/feedback') {
        const last = abLog.slice(-5).map(l => `${l.style}: ${l.question.slice(0,30)}...`).join('\n');
        await safeSendMessage(chatId, `Feedback terakhir:\n${last || 'Belum ada'}`, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text.startsWith('/image ')) {
        const prompt = text.slice(7);
        await safeSendMessage(chatId, `🎨 Menggambar: ${prompt}...`, { reply_to_message_id: msg.message_id });
        const img = await generateImage(prompt);
        if (img) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: img, caption: `✨ ${prompt}`, reply_to_message_id: msg.message_id });
        } else {
            await safeSendMessage(chatId, "❌ Gagal membuat gambar.", { reply_to_message_id: msg.message_id });
        }
        return res.sendStatus(200);
    }
    if (text.startsWith('/crack ')) {
        const hash = text.slice(7).trim();
        if (hash.length !== 32) {
            await safeSendMessage(chatId, "Hash 32 hex diperlukan.", { reply_to_message_id: msg.message_id });
        } else {
            await safeSendMessage(chatId, "🔓 Memproses... (maks 6 karakter)", { reply_to_message_id: msg.message_id });
            const found = crackHash(hash);
            if (found) {
                await safeSendMessage(chatId, `✅ Password: \`${found}\``, { reply_to_message_id: msg.message_id, parse_mode: "Markdown" });
            } else {
                await safeSendMessage(chatId, "❌ Tidak ditemukan.", { reply_to_message_id: msg.message_id });
            }
        }
        return res.sendStatus(200);
    }
    if (text.startsWith('/koreksi ')) {
        const parts = text.slice(9).split('|');
        if (parts.length < 2) {
            await safeSendMessage(chatId, "Format: /koreksi pertanyaan | jawaban_benar\nContoh: /koreksi siapa presiden Indonesia | Ir. Soekarno", { reply_to_message_id: msg.message_id });
        } else {
            const trigger = parts[0].trim();
            const answer = parts[1].trim();
            if (!answer || answer.length < 3) {
                await safeSendMessage(chatId, "❌ Jawaban terlalu pendek atau tidak valid. Berikan jawaban yang informatif.", { reply_to_message_id: msg.message_id });
            } else {
                lessons.rules.push({ trigger, answer, source: 'user', timestamp: Date.now() });
                if (lessons.rules.length > 200) lessons.rules.shift();
                saveAll();
                await safeSendMessage(chatId, "✅ Terima kasih, saya belajar. Coba tanyakan pertanyaan tersebut sekarang.", { reply_to_message_id: msg.message_id });
            }
        }
        return res.sendStatus(200);
    }
    if (text === '/tanggal') {
        await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    // Perintah untuk mengganti nama asisten
    if (text.startsWith('/setname ')) {
        const newName = text.slice(9).trim();
        if (newName && newName.length > 0 && newName.length < 50) {
            userMemory[userId].botName = newName;
            saveAll();
            await safeSendMessage(chatId, `✅ Nama panggilanku sekarang "${newName}". Senang bisa membantumu!`, { reply_to_message_id: msg.message_id });
        } else {
            await safeSendMessage(chatId, "❌ Nama tidak valid. Gunakan /setname [nama] dengan panjang 1-50 karakter.", { reply_to_message_id: msg.message_id });
        }
        return res.sendStatus(200);
    }

    // ========== TOOLS ==========
    const toolRes = await handleTools(text);
    if (toolRes) {
        await safeSendMessage(chatId, toolRes, { reply_to_message_id: msg.message_id, parse_mode: "Markdown", disable_web_page_preview: true });
        return res.sendStatus(200);
    }

    // ========== CHAT BIASA ==========
    const lang = simpleDetectLanguage(text);
    let prompt;
    if (lang === 'ja') prompt = `Jawab dalam bahasa Jepang: ${text}`;
    else if (lang === 'my') prompt = `Jawab dalam bahasa Myanmar: ${text}`;
    else if (lang === 'ko') prompt = `Jawab dalam bahasa Korea: ${text}`;
    else if (lang === 'vi') prompt = `Jawab dalam bahasa Vietnam: ${text}`;
    else prompt = text;

    const systemPrompt = getSystemPrompt(userId);
    let answer;
    try {
        answer = await getSmartAnswer(prompt, userId, systemPrompt);
    } catch (e) {
        answer = "❌ AI sedang sibuk. Coba lagi nanti.";
    }

    // Ringkasan & rekomendasi
    userMemory[userId].msgCount = (userMemory[userId].msgCount || 0) + 1;
    if (userMemory[userId].msgCount % 20 === 0) {
        const history = shortMemory.filter(m => m.userId === userId).slice(-20).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
        if (history.length > 50) await summarizeChat(userId, history, systemPrompt);
    }
    if (userMemory[userId].msgCount % 5 === 0 && answer.length > 50 && !text.startsWith('/')) {
        try {
            const suggestions = await getTopicSuggestion(text, answer, systemPrompt);
            if (suggestions && suggestions.length > 10 && !suggestions.includes("tidak")) {
                await safeSendMessage(chatId, `💡 Topik lanjutan:\n${suggestions}`, { reply_to_message_id: msg.message_id });
            }
        } catch (e) {}
    }
    saveAll();

    await safeSendMessage(chatId, answer, {
        reply_to_message_id: msg.message_id,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[ { text: "👍", callback_data: "positive" }, { text: "👎", callback_data: "negative" } ]] }
    });
    res.sendStatus(200);
});

// ==================== START SERVER ====================
async function start() {
    await initRedis();
    await loadAllMemories();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`✅ Bot AI (Mistral + Groq fallback) siap di port ${PORT}`);
        let host = process.env.RENDER_EXTERNAL_HOSTNAME;
        if (!host) host = 'telegrambotsaya.onrender.com';
        const url = `https://${host}/webhook/${TELEGRAM_TOKEN}`;
        console.log(`🔄 Mengatur webhook ke: ${url}`);
        try {
            const result = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
            if (result.data.ok) console.log(`✅ Webhook berhasil diset: ${url}`);
            else console.error(`❌ Gagal set webhook: ${result.data.description}`);
        } catch (e) {
            console.error(`❌ Webhook error: ${e.message}`);
        }
    });
}
start();

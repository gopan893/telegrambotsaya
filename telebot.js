const express = require('express');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 10000;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("Missing TELEGRAM_TOKEN or GROQ_API_KEY");
    process.exit(1);
}

let redisClient = null;
let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];

async function initRedis() {
    if (REDIS_URL) {
        try {
            const Redis = require('ioredis');
            redisClient = new Redis(REDIS_URL);
            await redisClient.ping();
            console.log("Redis connected");
        } catch(e) {
            console.log("Redis failed, using JSON");
            redisClient = null;
        }
    } else {
        console.log("No REDIS_URL, using JSON");
    }
}

async function loadData(key, defaultValue) {
    if (redisClient) {
        const val = await redisClient.get(key);
        if (val) return JSON.parse(val);
    }
    try {
        if (fs.existsSync(`${key}.json`)) return JSON.parse(fs.readFileSync(`${key}.json`));
    } catch(e) {}
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
    console.log(`Loaded ${shortMemory.length} chats, ${lessons.rules.length} rules`);
}

function saveAll() {
    saveData('memory', shortMemory.slice(-500));
    saveData('lessons', lessons);
    saveData('user_memory', userMemory);
    saveData('ab_log', abLog.slice(-1000));
}

setInterval(() => {
    if (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > 0.95) {
        console.error("Memory >95%, exiting");
        process.exit(1);
    }
}, 30000);

async function askGroq(prompt) {
    try {
        const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7, max_tokens: 1000
        }, { headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, timeout: 30000 });
        return res.data.choices[0].message.content;
    } catch(e) {
        return "Maaf, AI sedang sibuk. Coba lagi nanti.";
    }
}

const langMap = { ja:'Jepang', my:'Myanmar', fil:'Filipina', ms:'Malaysia', ko:'Korea Selatan', ta:'India', ur:'Pakistan', vi:'Vietnam', en:'Inggris', id:'Indonesia' };
async function detectLanguage(text) {
    const prompt = `Deteksi bahasa teks ini, output hanya kode bahasa (id,en,ja,my,fil,ms,ko,ta,ur,vi): "${text}"`;
    try {
        const res = await askGroq(prompt);
        const lang = res.trim().toLowerCase();
        return langMap[lang] ? lang : 'id';
    } catch { return 'id'; }
}

async function summarizeChat(userId, history) {
    if (history.length < 10) return;
    const summary = await askGroq(`Ringkas percakapan: ${history}`);
    if (!userMemory[userId]) userMemory[userId] = {};
    userMemory[userId].summary = summary;
    saveAll();
}

async function getTopicSuggestion(question, answer) {
    const prompt = `Berdasarkan Q:${question} A:${answer}, beri 2 pertanyaan lanjutan (format "1. ... 2. ...")`;
    return await askGroq(prompt);
}

function getCurrentTime() {
    return `🕒 Waktu Jepang: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Tokyo', hour:'2-digit', minute:'2-digit', second:'2-digit' })}`;
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
async function generateImage(prompt) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
    try { await axios.head(url, { timeout: 15000 }); return url; } catch { return null; }
}
function crackHash(targetHash) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const maxLen = 6;
    function brute(cur, len) {
        if (cur.length === len) return crypto.createHash('md5').update(cur).digest('hex') === targetHash ? cur : null;
        for (let i=0; i<chars.length; i++) { const r = brute(cur+chars[i], len); if (r) return r; }
        return null;
    }
    for (let l=1; l<=maxLen; l++) { const found = brute('', l); if (found) return found; }
    return null;
}
async function handleTools(msg, lang) {
    const low = msg.toLowerCase();
    if (low.includes('jam')||low.includes('waktu')) return getCurrentTime();
    if ((low.includes('hitung')||low.match(/\d+[\+\-\*\/]\d+/)) && !low.includes('cuaca')) {
        let expr = msg.replace(/[^0-9+\-*/().%]/g,'');
        if (expr) return calculate(expr);
    }
    if (low.includes('alamat')||low.includes('lokasi')||low.includes('dimana')) {
        let q = msg.replace(/alamat|lokasi|dimana|cari tempat/gi,'').trim();
        return q ? await searchLocation(q) : "Sebutkan tempat";
    }
    if (low.includes('cuaca')) {
        let city = msg.replace(/cuaca|weather|di|kota/gi,'').trim();
        return city ? await getWeather(city) : "Contoh: cuaca Tokyo";
    }
    const searchKw = ['cari','search','google','apa itu','informasi','berita'];
    if (searchKw.some(k=>low.includes(k))) {
        let q = msg; searchKw.forEach(k=>q=q.replace(new RegExp(k,'gi'),'')); q=q.trim();
        return q ? await searchWebTavily(q) : "Apa yang ingin dicari?";
    }
    return null;
}

async function getSmartAnswer(question, userId) {
    const cached = lessons.rules.find(r => question.toLowerCase().includes(r.trigger?.toLowerCase() || ''));
    if (cached) return cached.answer;
    const needsFresh = ['terbaru','berita','update','sekarang','harga','skor'].some(k=>question.toLowerCase().includes(k));
    if (needsFresh && TAVILY_API_KEY) {
        const searchRes = await searchWebTavily(question);
        if (searchRes && !searchRes.includes('Error')) {
            const learned = await askGroq(`Berdasarkan: ${searchRes}\nJawab: ${question}`);
            lessons.rules.push({ trigger: question.slice(0,50), answer: learned, source:'auto' });
            if (lessons.rules.length>200) lessons.rules.shift();
            saveAll();
            return learned;
        }
    }
    const similar = shortMemory.filter(m=>m.userId===userId).slice(-5).map(m=>`Q: ${m.q}\nA: ${m.a}`).join('\n');
    const context = similar ? `Konteks:\n${similar}\n\n` : '';
    const chosen = Math.random()>0.5?'santai':'formal';
    const prompt = chosen==='santai' ? `Jawab dengan santai (pake 'aku','kamu'): ${context+question}` : `Jawab informatif: ${context+question}`;
    const answer = await askGroq(prompt);
    abLog.push({ userId, question, chosen, answer });
    if (abLog.length>1000) abLog.shift();
    shortMemory.push({ userId, q: question, a: answer });
    if (shortMemory.length>500) shortMemory.shift();
    saveAll();
    return answer;
}

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.send('OK'));

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        if (cb.data === 'positive') await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "👍 Terima kasih!" });
        else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "👎 Gunakan /koreksi untuk mengajari saya." });
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: cb.id });
        return res.sendStatus(200);
    }
    if (!update.message || update.message.from.is_bot) return res.sendStatus(200);
    const chatId = update.message.chat.id;
    const userId = chatId.toString();
    const text = update.message.text;

    if (text === '/start') {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🤖 Bot AI siap. Ketik /help untuk perintah." });
        return res.sendStatus(200);
    }
    if (text === '/help') {
        const help = `/start - mulai\n/help - bantuan\n/stats - statistik\n/rollback - hapus aturan\n/feedback - log A/B\n/image <desc> - gambar\n/crack <hash> - crack MD5\n/hitung <expr> - kalkulator\n/jam - waktu Jepang\n/cuaca <kota>\n/lokasi <tempat>\n/cari <topik>\n/koreksi Q | A - ajari bot`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: help });
        return res.sendStatus(200);
    }
    if (text === '/stats') {
        const mem = process.memoryUsage();
        const msg = `Uptime: ${Math.floor(process.uptime()/60)} menit\nMemory: ${(mem.heapUsed/1024/1024).toFixed(2)} MB\nAturan: ${lessons.rules.length}\nChats: ${shortMemory.length}`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: msg });
        return res.sendStatus(200);
    }
    if (text === '/rollback') {
        if (lessons.rules.length) {
            lessons.rules.pop();
            saveAll();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🗑️ Aturan terakhir dihapus." });
        } else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Tidak ada aturan." });
        return res.sendStatus(200);
    }
    if (text === '/feedback') {
        const last = abLog.slice(-5).map(l => `${l.style}: ${l.question.slice(0,30)}...`).join('\n');
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `Feedback terakhir:\n${last || 'Belum ada'}` });
        return res.sendStatus(200);
    }
    if (text.startsWith('/image ')) {
        const prompt = text.slice(7);
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🎨 Menggambar: ${prompt}...` });
        const img = await generateImage(prompt);
        if (img) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: img });
        else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal membuat gambar." });
        return res.sendStatus(200);
    }
    if (text.startsWith('/crack ')) {
        const hash = text.slice(7).trim();
        if (hash.length !== 32) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Hash 32 hex diperlukan." });
        else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🔓 Memproses..." });
            const found = crackHash(hash);
            if (found) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `✅ Password: ${found}` });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Tidak ditemukan." });
        }
        return res.sendStatus(200);
    }
    if (text.startsWith('/koreksi ')) {
        const parts = text.slice(9).split('|');
        if (parts.length < 2) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Format: /koreksi Q | A" });
        else {
            lessons.rules.push({ trigger: parts[0].trim(), answer: parts[1].trim(), source: 'user' });
            if (lessons.rules.length > 200) lessons.rules.shift();
            saveAll();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Terima kasih, saya belajar." });
        }
        return res.sendStatus(200);
    }

    const userLang = await detectLanguage(text);
    const toolRes = await handleTools(text, userLang);
    if (toolRes) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: toolRes });
        return res.sendStatus(200);
    }

    let answer;
    if (userLang !== 'id' && userLang !== 'en') {
        const prompt = `Jawab dalam bahasa ${langMap[userLang]}: ${text}`;
        answer = await askGroq(prompt);
    } else {
        answer = await getSmartAnswer(text, userId);
    }

    if (!userMemory[userId]) userMemory[userId] = {};
    userMemory[userId].msgCount = (userMemory[userId].msgCount || 0) + 1;
    if (userMemory[userId].msgCount % 20 === 0) {
        const history = shortMemory.filter(m => m.userId === userId).slice(-20).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
        await summarizeChat(userId, history);
    }
    if (userMemory[userId].msgCount % 5 === 0 && answer.length > 50) {
        const suggestions = await getTopicSuggestion(text, answer);
        if (suggestions && suggestions.length > 10 && !suggestions.includes("tidak")) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `💡 Topik lanjutan:\n${suggestions}` });
        }
    }
    saveAll();

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: answer,
        reply_markup: { inline_keyboard: [[ { text: "👍", callback_data: "positive" }, { text: "👎", callback_data: "negative" } ]] }
    });
    res.sendStatus(200);
});

async function start() {
    await initRedis();
    await loadAllMemories();
    app.listen(PORT, '0.0.0.0', async () => {
        console.log(`✅ Bot AI siap di port ${PORT}`);
        const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
        try {
            await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
            console.log(`Webhook set ke ${url}`);
        } catch(e) { console.error("Webhook error"); }
    });
}
start();

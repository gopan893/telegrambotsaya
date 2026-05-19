const express = require('express');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const schedule = require('node-schedule');
const { google } = require('googleapis');
const sharp = require('sharp');
const { Mistral } = require('@mistralai/mistralai');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const REDIS_URL = process.env.REDIS_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const PORT = process.env.PORT || 10000;

if (!TELEGRAM_TOKEN) {
    console.error("❌ TELEGRAM_TOKEN tidak ditemukan!");
    process.exit(1);
}
if (!MISTRAL_API_KEY && !GROQ_API_KEY) {
    console.error("❌ Tidak ada API key AI!");
    process.exit(1);
}

// ==================== MEMORI & REDIS ====================
let redisClient = null;
let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];
let knowledgeBase = [];

async function initRedis() {
    if (!REDIS_URL) return;
    try {
        const Redis = require('ioredis');
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 2,
            retryStrategy: (times) => times > 2 ? null : Math.min(times * 100, 2000)
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
    knowledgeBase = await loadData('knowledge', []);
    console.log(`📂 Memori: ${shortMemory.length} chat, ${lessons.rules.length} aturan, ${knowledgeBase.length} pengetahuan`);
}

function saveAll() {
    saveData('memory', shortMemory.slice(-500));
    saveData('lessons', lessons);
    saveData('user_memory', userMemory);
    saveData('ab_log', abLog.slice(-1000));
    saveData('knowledge', knowledgeBase);
}

// ==================== WATCHDOG ====================
setInterval(() => {
    const mem = process.memoryUsage();
    if (mem.heapUsed / mem.heapTotal > 0.95) {
        console.error('⚠️ Memory >95%, exit');
        process.exit(1);
    }
}, 60000);

// ==================== FUNGSI AI ====================
async function askMistral(prompt) {
    if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY tidak diset");
    const client = new Mistral({ apiKey: MISTRAL_API_KEY });
    const response = await client.chat.complete({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800
    });
    return response.choices[0].message.content;
}

async function askGroq(prompt) {
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY tidak diset");
    const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800
    }, {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 15000
    });
    return res.data.choices[0].message.content;
}

async function askAI(prompt) {
    if (MISTRAL_API_KEY) {
        try {
            console.log("🟢 Mistral...");
            const answer = await askMistral(prompt);
            console.log("✅ Mistral sukses");
            return answer;
        } catch (err) {
            console.error("Mistral gagal:", err.message);
        }
    }
    if (GROQ_API_KEY) {
        try {
            console.log("⚡ Groq...");
            const answer = await askGroq(prompt);
            console.log("✅ Groq sukses");
            return answer;
        } catch (err) {
            console.error("Groq gagal:", err.message);
        }
    }
    throw new Error("Semua AI gagal.");
}

// ==================== DETEKSI BAHASA SEDERHANA (termasuk Jepang) ====================
function simpleDetectLanguage(text) {
    if (!text) return 'id';
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
    if (/[\u1000-\u109F]/.test(text)) return 'my';
    if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
    if (/[ăâđêôơư]/.test(text)) return 'vi';
    return 'id';
}

// ==================== SAFE SEND ====================
async function safeSendMessage(chatId, text, extra = {}) {
    const payload = { chat_id: chatId, text: text, ...extra };
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, payload, { timeout: 8000 });
    } catch (err) {
        if (err.response && err.response.status === 400 && extra.reply_to_message_id) {
            delete extra.reply_to_message_id;
            try {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: text, ...extra }, { timeout: 8000 });
            } catch (e) {}
        } else {
            console.error("Send error:", err.message);
        }
    }
}

// ==================== FUNGSI WAKTU MULTI-ZONA ====================
function getTimeInZone(location) {
    const timezones = {
        'jakarta': 'Asia/Jakarta', 'indonesia': 'Asia/Jakarta', 'jepang': 'Asia/Tokyo', 'tokyo': 'Asia/Tokyo',
        'new york': 'America/New_York', 'london': 'Europe/London', 'paris': 'Europe/Paris', 'dubai': 'Asia/Dubai',
        'riyadh': 'Asia/Riyadh', 'mekkah': 'Asia/Riyadh', 'singapore': 'Asia/Singapore', 'kuala lumpur': 'Asia/Kuala_Lumpur',
        'bangkok': 'Asia/Bangkok', 'seoul': 'Asia/Seoul', 'beijing': 'Asia/Shanghai', 'sydney': 'Australia/Sydney',
        'los angeles': 'America/Los_Angeles', 'chicago': 'America/Chicago', 'moscow': 'Europe/Moscow', 'berlin': 'Europe/Berlin'
    };
    let tz = timezones[location.toLowerCase()] || null;
    if (!tz) {
        for (const [key, value] of Object.entries(timezones)) {
            if (location.toLowerCase().includes(key)) {
                tz = value;
                break;
            }
        }
    }
    if (!tz) return null;
    const now = new Date();
    const options = { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const formatted = now.toLocaleString('id-ID', options);
    return { time: formatted, timezone: tz };
}

function getCurrentTime() {
    const res = getTimeInZone('jakarta');
    return `🕒 Waktu Indonesia (WIB): ${res.time}`;
}
function getCurrentDate() {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return `📅 Hari ini: ${now.toLocaleDateString('id-ID', options)}`;
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
    const searchKw = ['cari', 'search', 'google', 'apa itu', 'informasi', 'berita'];
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
async function getAnswerWithAB(question, userId) {
    const chosen = Math.random() > 0.5 ? 'santai' : 'formal';
    const prompt = chosen === 'santai' 
        ? `Jawab dengan santai (pake 'aku','kamu'): ${question}` 
        : `Jawab informatif: ${question}`;
    const answer = await askAI(prompt);
    abLog.push({ userId, question, chosen, answer, timestamp: Date.now() });
    if (abLog.length > 1000) abLog.shift();
    saveAll();
    return { answer, style: chosen };
}
async function getSmartAnswer(question, userId) {
    const cached = getCachedAnswer(question);
    if (cached) return cached;
    const needsFresh = ['terbaru','berita','update','sekarang','harga','skor'].some(k => question.toLowerCase().includes(k));
    if (needsFresh && TAVILY_API_KEY) {
        const searchRes = await searchWebTavily(question);
        if (searchRes && !searchRes.includes('Error')) {
            const learned = await askAI(`Berdasarkan pencarian: ${searchRes}\nJawab: ${question}`);
            lessons.rules.push({ trigger: question.slice(0,50), answer: learned, source:'auto', timestamp: Date.now() });
            if (lessons.rules.length > 200) lessons.rules.shift();
            saveAll();
            return learned;
        }
    }
    const similar = shortMemory.filter(m => m.userId === userId).slice(-5).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
    const context = similar ? `Konteks:\n${similar}\n\n` : '';
    const { answer } = await getAnswerWithAB(context + question, userId);
    shortMemory.push({ userId, q: question, a: answer, timestamp: Date.now() });
    if (shortMemory.length > 500) shortMemory.shift();
    saveAll();
    return answer;
}

// ==================== SYSTEM PROMPT DINAMIS ====================
function getSystemPrompt(userId) {
    const botName = userMemory[userId]?.botName || "Bot Desa";
    return `Kamu adalah asisten pribadi bernama "${botName}". Gunakan bahasa santai (aku/kamu). Jawab singkat, maks 3 kalimat. Jika tidak tahu, bilang tidak tahu. Nama kamu adalah ${botName}.`;
}

// ==================== GOOGLE CALENDAR OAUTH ====================
let oAuth2Client = null;
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI) {
    oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
    console.log("✅ Google Calendar OAuth2 siap.");
} else {
    console.log("⚠️ Google Calendar OAuth2 tidak dikonfigurasi.");
}

function getAuthUrl(state) {
    if (!oAuth2Client) return null;
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        prompt: 'consent',
        state: state
    });
}

async function getTokensFromCode(code) {
    if (!oAuth2Client) throw new Error("OAuth2 tidak dikonfigurasi");
    const { tokens } = await oAuth2Client.getToken(code);
    return tokens;
}

async function saveUserTokens(userId, tokens) {
    if (!userMemory[userId]) userMemory[userId] = {};
    userMemory[userId].calendarTokens = tokens;
    saveAll();
}

async function getUserTokens(userId) {
    return userMemory[userId]?.calendarTokens || null;
}

async function getCalendarClient(userId) {
    const tokens = await getUserTokens(userId);
    if (!tokens || !oAuth2Client) return null;
    oAuth2Client.setCredentials(tokens);
    return google.calendar({ version: 'v3', auth: oAuth2Client });
}

// ==================== FITUR TAMBAHAN (MOOD, REMINDER, TODO, DLL) ====================
async function handleMood(chatId, userId, text, msg) {
    if (text === '/mood') {
        await safeSendMessage(chatId, "Apa kabarmu hari ini? (senang/biasa/sedih/cemas/energik)", { reply_to_message_id: msg.message_id });
        userMemory[userId].awaitingMood = true;
        return true;
    }
    if (userMemory[userId]?.awaitingMood) {
        const mood = text.toLowerCase();
        const valid = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];
        if (valid.includes(mood)) {
            userMemory[userId].mood = mood;
            userMemory[userId].lastMoodUpdate = Date.now();
            delete userMemory[userId].awaitingMood;
            saveAll();
            await safeSendMessage(chatId, `Terima kasih! Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
        } else {
            await safeSendMessage(chatId, "Pilihan: senang, biasa, sedih, cemas, energik.", { reply_to_message_id: msg.message_id });
        }
        return true;
    }
    return false;
}

async function handleReminder(chatId, userId, text, msg) {
    if (text.startsWith('/remind')) {
        const parts = text.split(' ').slice(1);
        if (parts.length < 3) {
            await safeSendMessage(chatId, "Format: /remind YYYY-MM-DD HH:MM pesan", { reply_to_message_id: msg.message_id });
            return true;
        }
        const dateStr = parts[0];
        const timeStr = parts[1];
        const message = parts.slice(2).join(' ');
        const datetime = new Date(`${dateStr}T${timeStr}:00`);
        if (isNaN(datetime) || datetime <= new Date()) {
            await safeSendMessage(chatId, "Tanggal/waktu tidak valid atau sudah lewat.", { reply_to_message_id: msg.message_id });
            return true;
        }
        const reminderId = Date.now().toString();
        const job = schedule.scheduleJob(datetime, async () => {
            await safeSendMessage(chatId, `⏰ *Pengingat:* ${message}`, { parse_mode: "Markdown" });
            if (userMemory[userId]?.reminders) {
                userMemory[userId].reminders = userMemory[userId].reminders.filter(r => r.id !== reminderId);
                saveAll();
            }
        });
        if (!userMemory[userId].reminders) userMemory[userId].reminders = [];
        userMemory[userId].reminders.push({ id: reminderId, time: datetime.toISOString(), message });
        saveAll();
        await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${datetime.toString()}`, { reply_to_message_id: msg.message_id });
        return true;
    }
    return false;
}

async function handleTodo(chatId, userId, text, msg) {
    if (text === '/todo') {
        const tasks = userMemory[userId]?.todos || [];
        if (tasks.length === 0) {
            await safeSendMessage(chatId, "📝 Daftar tugas kosong. Gunakan /add <tugas>", { reply_to_message_id: msg.message_id });
        } else {
            const list = tasks.map((t, i) => `${i+1}. ${t.done ? '✅' : '❌'} ${t.text}`).join('\n');
            await safeSendMessage(chatId, `📋 *To-Do List:*\n${list}`, { parse_mode: "Markdown", reply_to_message_id: msg.message_id });
        }
        return true;
    }
    if (text.startsWith('/add ')) {
        const taskText = text.slice(5);
        if (!userMemory[userId].todos) userMemory[userId].todos = [];
        userMemory[userId].todos.push({ text: taskText, done: false, createdAt: Date.now() });
        saveAll();
        await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
        return true;
    }
    if (text.startsWith('/done ')) {
        const idx = parseInt(text.slice(6)) - 1;
        if (!userMemory[userId]?.todos || idx < 0 || idx >= userMemory[userId].todos.length) {
            await safeSendMessage(chatId, "Nomor tugas tidak valid.", { reply_to_message_id: msg.message_id });
        } else {
            userMemory[userId].todos[idx].done = true;
            saveAll();
            await safeSendMessage(chatId, `✅ Tugas "${userMemory[userId].todos[idx].text}" selesai.`, { reply_to_message_id: msg.message_id });
        }
        return true;
    }
    if (text === '/cleartodo') {
        if (userMemory[userId]?.todos) {
            userMemory[userId].todos = [];
            saveAll();
            await safeSendMessage(chatId, "🗑️ Semua tugas dihapus.", { reply_to_message_id: msg.message_id });
        }
        return true;
    }
    return false;
}

let quizState = {};
async function handleQuizPoll(chatId, text, msg) {
    if (text.startsWith('/quiz ')) {
        const question = text.slice(6);
        quizState[chatId] = { type: 'quiz', question };
        await safeSendMessage(chatId, "Kirim opsi jawaban (pisahkan dengan koma):", { reply_to_message_id: msg.message_id });
        return true;
    }
    if (quizState[chatId] && quizState[chatId].type === 'quiz') {
        const options = text.split(',').map(o => o.trim()).filter(o => o);
        if (options.length < 2) {
            await safeSendMessage(chatId, "Minimal 2 opsi.", { reply_to_message_id: msg.message_id });
            delete quizState[chatId];
            return true;
        }
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPoll`, {
            chat_id: chatId,
            question: quizState[chatId].question,
            options: options,
            is_anonymous: false,
            type: 'quiz',
            correct_option_id: 0
        });
        delete quizState[chatId];
        return true;
    }
    if (text.startsWith('/poll ')) {
        const question = text.slice(6);
        quizState[chatId] = { type: 'poll', question };
        await safeSendMessage(chatId, "Kirim opsi polling (pisahkan dengan koma):", { reply_to_message_id: msg.message_id });
        return true;
    }
    if (quizState[chatId] && quizState[chatId].type === 'poll') {
        const options = text.split(',').map(o => o.trim()).filter(o => o);
        if (options.length < 2) {
            await safeSendMessage(chatId, "Minimal 2 opsi.", { reply_to_message_id: msg.message_id });
            delete quizState[chatId];
            return true;
        }
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPoll`, {
            chat_id: chatId,
            question: quizState[chatId].question,
            options: options,
            is_anonymous: false
        });
        delete quizState[chatId];
        return true;
    }
    return false;
}

async function handleGroupManagement(chatId, text, msg) {
    if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return false;
    if (text === '/kick' && msg.reply_to_message) {
        const userIdToKick = msg.reply_to_message.from.id;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/kickChatMember`, {
            chat_id: chatId,
            user_id: userIdToKick
        });
        await safeSendMessage(chatId, `User ${msg.reply_to_message.from.first_name} dikeluarkan.`, { reply_to_message_id: msg.message_id });
        return true;
    }
    if (text === '/pin' && msg.reply_to_message) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/pinChatMessage`, {
            chat_id: chatId,
            message_id: msg.reply_to_message.message_id
        });
        await safeSendMessage(chatId, "Pesan disematkan.", { reply_to_message_id: msg.message_id });
        return true;
    }
    return false;
}

async function handleImageEdit(chatId, text, msg) {
    if (text.startsWith('/resize ') && msg.reply_to_message?.photo) {
        const size = text.slice(8).split('x');
        if (size.length !== 2) {
            await safeSendMessage(chatId, "Format: /resize widthxheight (balas foto)", { reply_to_message_id: msg.message_id });
            return true;
        }
        const width = parseInt(size[0]);
        const height = parseInt(size[1]);
        if (isNaN(width) || isNaN(height)) {
            await safeSendMessage(chatId, "Lebar/tinggi tidak valid.", { reply_to_message_id: msg.message_id });
            return true;
        }
        const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length-1].file_id;
        const fileInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const filePath = fileInfo.data.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
        const imageRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const resized = await sharp(imageRes.data).resize(width, height).toBuffer();
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
            chat_id: chatId,
            photo: resized.toString('base64'),
            caption: `Resize ke ${width}x${height}`,
            reply_to_message_id: msg.message_id
        });
        return true;
    }
    return false;
}

async function handleStickerHint(chatId, text, msg) {
    if (text === '/sticker' && msg.reply_to_message?.photo) {
        await safeSendMessage(chatId, "Untuk membuat stiker, gunakan @Stickers bot. Saya belum support pembuatan stiker otomatis.", { reply_to_message_id: msg.message_id });
        return true;
    }
    return false;
}

async function handleKnowledge(chatId, text, msg) {
    if (text.startsWith('/learn ')) {
        const content = text.slice(7);
        knowledgeBase.push({ content, timestamp: Date.now() });
        saveData('knowledge', knowledgeBase);
        await safeSendMessage(chatId, "✅ Pengetahuan ditambahkan.", { reply_to_message_id: msg.message_id });
        return true;
    }
    if (text.startsWith('/askkb ')) {
        const query = text.slice(7).toLowerCase();
        const relevant = knowledgeBase.filter(k => k.content.toLowerCase().includes(query));
        if (relevant.length === 0) {
            await safeSendMessage(chatId, "Tidak ada informasi terkait.", { reply_to_message_id: msg.message_id });
        } else {
            const answer = relevant.slice(-3).map(k => k.content).join('\n\n');
            await safeSendMessage(chatId, `📚 *Basis Pengetahuan:*\n${answer}`, { parse_mode: "Markdown", reply_to_message_id: msg.message_id });
        }
        return true;
    }
    return false;
}

// ==================== NATURAL LANGUAGE PROCESSING (NLP) UNIVERSAL ====================
async function universalNLP(userMessage, userId) {
    const savedPatterns = userMemory[userId]?.nlpPatterns || [];
    const patternHint = savedPatterns.length > 0 
        ? `\n\nPola yang sudah pernah diajarkan (gunakan jika cocok):\n${savedPatterns.map(p => `- "${p.question}" → intent: ${p.intent}`).join('\n')}`
        : '';

    const prompt = `Kamu adalah asisten yang memahami maksud user dari bahasa alami.
Analisis pesan user berikut. Tentukan intent yang paling sesuai dan ekstrak parameter.

Intents yang tersedia:
- TAMBAH_EVENT: user ingin menambahkan jadwal/event (ulang tahun, meeting, janji). Parameter: summary, startDate, startTime (opsional), endDate (opsional), endTime (opsional)
- TAMBAH_TUGAS: user ingin menambahkan tugas ke to-do list. Parameter: task
- TAMBAH_PENGINGAT: user ingin diingatkan di waktu tertentu. Parameter: message, time
- TAMBAH_MOOD: user ingin mencatat suasana hati (senang, biasa, sedih, cemas, energik). Parameter: mood
- CUACA: user ingin tahu cuaca di suatu kota. Parameter: city
- SEARCH: user ingin mencari informasi di web. Parameter: query
- HITUNG: user ingin melakukan perhitungan matematika. Parameter: expression
- JAM: user ingin tahu waktu saat ini. Parameter: location (opsional, nama kota)
- TANGGAL: user ingin tahu tanggal hari ini (tanpa parameter)
- GAMBAR: user ingin membuat gambar dari teks. Parameter: prompt
- LOKASI: user ingin mencari alamat atau lokasi. Parameter: place
- NONE: tidak ada intent yang cocok.

Pesan user: "${userMessage}"${patternHint}

Output hanya JSON. Contoh:
{"intent": "TAMBAH_EVENT", "params": {"summary": "ulang tahun", "startDate": "2026-05-31"}}
{"intent": "JAM", "params": {"location": "Jakarta"}}
{"intent": "CUACA", "params": {"city": "Bandung"}}
{"intent": "NONE"}`;

    try {
        const response = await askAI(prompt);
        const jsonMatch = response.match(/\{.*\}/s);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
        return { intent: "NONE" };
    } catch (e) {
        console.error("NLP error:", e.message);
        return { intent: "NONE" };
    }
}

async function saveNlpPattern(userId, originalQuestion, correctedIntent, correctedParams) {
    if (!userMemory[userId]) userMemory[userId] = {};
    if (!userMemory[userId].nlpPatterns) userMemory[userId].nlpPatterns = [];
    userMemory[userId].nlpPatterns.push({
        question: originalQuestion.toLowerCase(),
        intent: correctedIntent,
        params: correctedParams,
        timestamp: Date.now()
    });
    if (userMemory[userId].nlpPatterns.length > 100) userMemory[userId].nlpPatterns.shift();
    saveAll();
}

async function askClarification(chatId, userId, originalText, msg) {
    await safeSendMessage(chatId, 
        `🤔 Maaf, aku kurang paham dengan "${originalText}". 
Bisa tulis ulang dengan lebih jelas? Contoh:\n
- "Tambah event rapat besok jam 10"
- "Tambah tugas beli susu"
- "Cuaca di Bandung"
- "Ingatkan saya ..."
- "Hitung 25*4"
- "Jam berapa di New York"
- "Gambar kucing"

Atau gunakan perintah /help.`,
        { reply_to_message_id: msg.message_id }
    );
    userMemory[userId].awaitingClarification = originalText;
    saveAll();
}

async function executeUniversalIntent(intent, params, chatId, userId, msg) {
    switch (intent) {
        case "TAMBAH_EVENT":
            if (!oAuth2Client) {
                await safeSendMessage(chatId, "❌ Google Calendar belum dikonfigurasi. Gunakan /auth dulu.", { reply_to_message_id: msg.message_id });
                return true;
            }
            const calendar = await getCalendarClient(userId);
            if (!calendar) {
                await safeSendMessage(chatId, "❌ Belum autentikasi Google Calendar. Gunakan /auth.", { reply_to_message_id: msg.message_id });
                return true;
            }
            let startDate = params.startDate;
            let endDate = params.endDate || startDate;
            const summary = params.summary || "Event";
            const startDateTime = `${startDate}T${params.startTime || "09:00"}:00`;
            const endDateTime = `${endDate}T${params.endTime || "10:00"}:00`;
            try {
                await calendar.events.insert({
                    calendarId: 'primary',
                    resource: {
                        summary: summary,
                        start: { dateTime: new Date(startDateTime).toISOString(), timeZone: 'Asia/Jakarta' },
                        end: { dateTime: new Date(endDateTime).toISOString(), timeZone: 'Asia/Jakarta' }
                    }
                });
                await safeSendMessage(chatId, `✅ Event "${summary}" ditambahkan ke Google Calendar.`, { reply_to_message_id: msg.message_id });
            } catch (err) {
                await safeSendMessage(chatId, "❌ Gagal menambahkan event. Periksa format tanggal.", { reply_to_message_id: msg.message_id });
            }
            return true;

        case "TAMBAH_TUGAS":
            const taskText = params.task;
            if (!userMemory[userId].todos) userMemory[userId].todos = [];
            userMemory[userId].todos.push({ text: taskText, done: false, createdAt: Date.now() });
            saveAll();
            await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
            return true;

        case "TAMBAH_PENGINGAT":
            const message = params.message;
            let time = params.time;
            const remindDate = new Date(time);
            if (isNaN(remindDate) || remindDate <= new Date()) {
                await safeSendMessage(chatId, "❌ Waktu pengingat tidak valid.", { reply_to_message_id: msg.message_id });
                return true;
            }
            const reminderId = Date.now().toString();
            const job = schedule.scheduleJob(remindDate, async () => {
                await safeSendMessage(chatId, `⏰ *Pengingat:* ${message}`, { parse_mode: "Markdown" });
                if (userMemory[userId]?.reminders) {
                    userMemory[userId].reminders = userMemory[userId].reminders.filter(r => r.id !== reminderId);
                    saveAll();
                }
            });
            if (!userMemory[userId].reminders) userMemory[userId].reminders = [];
            userMemory[userId].reminders.push({ id: reminderId, time: remindDate.toISOString(), message });
            saveAll();
            await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${remindDate.toString()}`, { reply_to_message_id: msg.message_id });
            return true;

        case "TAMBAH_MOOD":
            const mood = params.mood;
            const validMoods = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];
            if (validMoods.includes(mood)) {
                userMemory[userId].mood = mood;
                userMemory[userId].lastMoodUpdate = Date.now();
                saveAll();
                await safeSendMessage(chatId, `📝 Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
            } else {
                await safeSendMessage(chatId, "Mood tidak dikenali. Pilihan: senang, biasa, sedih, cemas, energik.", { reply_to_message_id: msg.message_id });
            }
            return true;

        case "CUACA":
            const weather = await getWeather(params.city);
            await safeSendMessage(chatId, weather, { reply_to_message_id: msg.message_id });
            return true;

        case "SEARCH":
            const searchRes = await searchWebTavily(params.query);
            await safeSendMessage(chatId, searchRes, { reply_to_message_id: msg.message_id });
            return true;

        case "HITUNG":
            const calcRes = calculate(params.expression);
            await safeSendMessage(chatId, calcRes, { reply_to_message_id: msg.message_id });
            return true;

        case "JAM": {
            let location = params.location || "jakarta";
            const timeData = getTimeInZone(location);
            if (timeData) {
                await safeSendMessage(chatId, `🕒 Waktu di ${location}: ${timeData.time}`, { reply_to_message_id: msg.message_id });
            } else {
                await safeSendMessage(chatId, `❌ Lokasi "${location}" tidak dikenal. Coba sebutkan kota seperti Jakarta, Tokyo, New York, dll.`, { reply_to_message_id: msg.message_id });
            }
            return true;
        }

        case "TANGGAL":
            await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
            return true;

        case "GAMBAR":
            await safeSendMessage(chatId, `🎨 Menggambar: ${params.prompt}...`, { reply_to_message_id: msg.message_id });
            const img = await generateImage(params.prompt);
            if (img) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: img, caption: `✨ ${params.prompt}`, reply_to_message_id: msg.message_id });
            } else {
                await safeSendMessage(chatId, "❌ Gagal membuat gambar.", { reply_to_message_id: msg.message_id });
            }
            return true;

        case "LOKASI":
            const place = params.place;
            const locRes = await searchLocation(place);
            await safeSendMessage(chatId, locRes, { reply_to_message_id: msg.message_id });
            return true;

        default:
            return false;
    }
}

// ==================== WEBHOOK SERVER ====================
const app = express();
app.use(express.json());

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    if (!code) return res.send('No code provided');
    if (!state) return res.send('Missing state');
    try {
        const tokens = await getTokensFromCode(code);
        await saveUserTokens(state, tokens);
        await safeSendMessage(state, "✅ Autentikasi Google Calendar berhasil! Sekarang kamu bisa menggunakan perintah `/addevent`.", { parse_mode: "Markdown" });
        res.send('Autentikasi berhasil! Silakan kembali ke Telegram.');
    } catch (error) {
        console.error(error);
        res.send('Autentikasi gagal: ' + error.message);
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    if (update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        if (cb.data === 'positive') await safeSendMessage(chatId, "👍 Terima kasih!");
        else await safeSendMessage(chatId, "👎 Gunakan /koreksi untuk mengajari saya.");
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: cb.id });
        return res.sendStatus(200);
    }
    if (!update.message || update.message.from.is_bot) return res.sendStatus(200);
    const chatId = update.message.chat.id;
    const userId = chatId.toString();
    const msg = update.message;
    // ========== PENTING: text bisa undefined jika bukan pesan teks ==========
    const text = msg.text || '';
    
    // Jika tidak ada teks, beri tahu user (opsional)
    if (!text) {
        await safeSendMessage(chatId, "Maaf, saya hanya bisa membaca pesan teks biasa. Silakan kirim pesan dalam bentuk tulisan.");
        return res.sendStatus(200);
    }

    if (!userMemory[userId]) userMemory[userId] = { botName: "Bot Desa" };

    // ========== PERINTAH DASAR ==========
    if (text === '/start') {
        await safeSendMessage(chatId, `🤖 Halo! Aku ${userMemory[userId].botName}. Ketik /help untuk semua perintah.`, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/help') {
        const help = `/start - mulai
/help - bantuan
/stats - statistik
/rollback - hapus aturan
/feedback - log A/B
/image <desc> - gambar
/crack <hash> - crack
/hitung <expr> - kalkulator
/jam - waktu Indonesia
/tanggal - tanggal hari ini
/cuaca <kota>
/lokasi <tempat>
/cari <topik>
/setname <nama> - ganti namaku
/koreksi Q | A - ajari bot

✨ *Fitur Baru:*
/mood - catat suasana hati
/remind YYYY-MM-DD HH:MM pesan - pengingat
/todo - lihat tugas
/add <tugas> - tambah tugas
/done <nomor> - selesaikan tugas
/cleartodo - hapus semua tugas
/quiz <pertanyaan> - buat kuis
/poll <pertanyaan> - buat polling
/kick (balas pesan) - tendang (grup)
/pin (balas pesan) - semat (grup)
/resize widthxheight (balas foto) - ubah ukuran
/sticker (balas foto) - panduan stiker
/learn <teks> - tambah pengetahuan
/askkb <pertanyaan> - tanya pengetahuan
/auth - autentikasi Google Calendar
/addevent Judul | YYYY-MM-DD HH:MM | YYYY-MM-DD HH:MM - tambah event

*Natural Language:* Kamu bisa langsung mengetik dalam bahasa alami, misal:
- "Tambah event rapat besok jam 10"
- "Tambah tugas beli susu"
- "Cuaca di Bandung"
- "Jam berapa di New York"
- "Gambar kucing lucu"`;
        await safeSendMessage(chatId, help, { parse_mode: "Markdown", reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text === '/stats') {
        const mem = process.memoryUsage();
        const msgText = `Uptime: ${Math.floor(process.uptime()/60)} menit\nMemory: ${(mem.heapUsed/1024/1024).toFixed(2)} MB\nAturan: ${lessons.rules.length}\nChats: ${shortMemory.length}\nPengetahuan: ${knowledgeBase.length}`;
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
            await safeSendMessage(chatId, "Format: /koreksi pertanyaan | jawaban_benar", { reply_to_message_id: msg.message_id });
        } else {
            const trigger = parts[0].trim();
            const answer = parts[1].trim();
            if (!answer || answer.length < 3) {
                await safeSendMessage(chatId, "❌ Jawaban terlalu pendek.", { reply_to_message_id: msg.message_id });
            } else {
                lessons.rules.push({ trigger, answer, source: 'user', timestamp: Date.now() });
                if (lessons.rules.length > 200) lessons.rules.shift();
                saveAll();
                await safeSendMessage(chatId, "✅ Terima kasih, saya belajar.", { reply_to_message_id: msg.message_id });
            }
        }
        return res.sendStatus(200);
    }
    if (text === '/tanggal') {
        await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text.startsWith('/setname ')) {
        const newName = text.slice(9).trim();
        if (newName && newName.length < 50) {
            userMemory[userId].botName = newName;
            saveAll();
            await safeSendMessage(chatId, `✅ Namaku sekarang "${newName}".`, { reply_to_message_id: msg.message_id });
        } else {
            await safeSendMessage(chatId, "❌ Nama tidak valid.", { reply_to_message_id: msg.message_id });
        }
        return res.sendStatus(200);
    }

    // ========== FITUR TAMBAHAN ==========
    if (await handleMood(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleReminder(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleTodo(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleQuizPoll(chatId, text, msg)) return res.sendStatus(200);
    if (await handleGroupManagement(chatId, text, msg)) return res.sendStatus(200);
    if (await handleImageEdit(chatId, text, msg)) return res.sendStatus(200);
    if (await handleStickerHint(chatId, text, msg)) return res.sendStatus(200);
    if (await handleKnowledge(chatId, text, msg)) return res.sendStatus(200);

    // ========== GOOGLE CALENDAR ==========
    if (text === '/auth') {
        if (!oAuth2Client) {
            await safeSendMessage(chatId, "❌ Fitur Google Calendar belum dikonfigurasi.", { reply_to_message_id: msg.message_id });
            return res.sendStatus(200);
        }
        const authUrl = getAuthUrl(userId);
        if (!authUrl) {
            await safeSendMessage(chatId, "❌ Gagal membuat link autentikasi.", { reply_to_message_id: msg.message_id });
            return res.sendStatus(200);
        }
        await safeSendMessage(chatId, `🔐 Klik tautan untuk autentikasi Google Calendar:\n${authUrl}\n\nSetelah login, kamu akan diarahkan kembali.`, { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }
    if (text.startsWith('/addevent ')) {
        const calendar = await getCalendarClient(userId);
        if (!calendar) {
            await safeSendMessage(chatId, "❌ Belum autentikasi. Gunakan /auth dulu.", { reply_to_message_id: msg.message_id });
            return res.sendStatus(200);
        }
        const parts = text.slice(10).split('|');
        if (parts.length < 3) {
            await safeSendMessage(chatId, "Format: /addevent Judul | YYYY-MM-DD HH:MM | YYYY-MM-DD HH:MM", { reply_to_message_id: msg.message_id });
            return res.sendStatus(200);
        }
        const summary = parts[0].trim();
        const startStr = parts[1].trim();
        const endStr = parts[2].trim();
        const startDateTime = new Date(startStr.replace(' ', 'T') + ':00');
        const endDateTime = new Date(endStr.replace(' ', 'T') + ':00');
        if (isNaN(startDateTime) || isNaN(endDateTime)) {
            await safeSendMessage(chatId, "Format tanggal/waktu salah.", { reply_to_message_id: msg.message_id });
            return res.sendStatus(200);
        }
        try {
            await calendar.events.insert({
                calendarId: 'primary',
                resource: {
                    summary: summary,
                    start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Jakarta' },
                    end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Jakarta' }
                }
            });
            await safeSendMessage(chatId, `✅ Event "${summary}" ditambahkan ke Google Calendar.`, { reply_to_message_id: msg.message_id });
        } catch (err) {
            console.error(err);
            await safeSendMessage(chatId, "❌ Gagal menambahkan event.", { reply_to_message_id: msg.message_id });
        }
        return res.sendStatus(200);
    }

    // ========== TOOLS ==========
    const toolRes = await handleTools(text);
    if (toolRes) {
        await safeSendMessage(chatId, toolRes, { parse_mode: "Markdown", disable_web_page_preview: true, reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
    }

    // ========== NATURAL LANGUAGE PROCESSING ==========
    // Cek apakah user sedang merespon klarifikasi
    if (userMemory[userId]?.awaitingClarification) {
        const originalQuestion = userMemory[userId].awaitingClarification;
        delete userMemory[userId].awaitingClarification;
        saveAll();
        const clarificationNLP = await universalNLP(text, userId);
        if (clarificationNLP.intent !== "NONE") {
            await saveNlpPattern(userId, originalQuestion, clarificationNLP.intent, clarificationNLP.params);
            await safeSendMessage(chatId, `✅ Terima kasih! Aku akan mengingat bahwa "${originalQuestion}" berarti ${clarificationNLP.intent}. Lain kali aku akan langsung paham.`, { reply_to_message_id: msg.message_id });
            await executeUniversalIntent(clarificationNLP.intent, clarificationNLP.params, chatId, userId, msg);
        } else {
            await safeSendMessage(chatId, "Maaf, masih kurang jelas. Gunakan perintah /help.", { reply_to_message_id: msg.message_id });
        }
        return res.sendStatus(200);
    }

    // NLP untuk semua pesan
    const nlpResult = await universalNLP(text, userId);
    if (nlpResult.intent !== "NONE") {
        const executed = await executeUniversalIntent(nlpResult.intent, nlpResult.params, chatId, userId, msg);
        if (executed) return res.sendStatus(200);
    } else {
        // Jika tidak dikenali dan pesan cukup panjang, minta klarifikasi
        if (text.length > 5 && !text.startsWith('/')) {
            await askClarification(chatId, userId, text, msg);
            return res.sendStatus(200);
        }
    }

    // ========== FALLBACK: CHAT BIASA DENGAN AI ==========
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
        answer = await getSmartAnswer(prompt, userId);
    } catch (e) {
        answer = "❌ AI sedang sibuk. Coba lagi nanti.";
    }

    // Ringkasan & rekomendasi
    userMemory[userId].msgCount = (userMemory[userId].msgCount || 0) + 1;
    if (userMemory[userId].msgCount % 20 === 0) {
        const history = shortMemory.filter(m => m.userId === userId).slice(-20).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
        if (history.length > 50) {
            try {
                const summary = await askAI(`Ringkas percakapan ini (maks 100 kata):\n${history}`);
                userMemory[userId].summary = summary;
                saveAll();
            } catch (e) {}
        }
    }
    if (userMemory[userId].msgCount % 5 === 0 && answer.length > 50 && !text.startsWith('/')) {
        try {
            const suggestions = await askAI(`Berdasarkan Q: "${text}" dan A: "${answer}", beri 2 pertanyaan lanjutan (format 1. ... 2. ...)`);
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
        console.log(`✅ Bot AI Super lengkap (NLP Universal) berjalan di port ${PORT}`);
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

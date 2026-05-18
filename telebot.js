const express = require('express');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

// ==================== KONFIGURASI ====================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const REDIS_URL = process.env.REDIS_URL;
const PORT = process.env.PORT || 10000;

if (!TELEGRAM_TOKEN || !GROQ_API_KEY) {
    console.error("❌ TELEGRAM_TOKEN atau GROQ_API_KEY tidak ditemukan!");
    process.exit(1);
}

// ==================== MEMORI PERSISTEN (REDIS + FILE FALLBACK) ====================
let redisClient = null;
if (REDIS_URL) {
    try {
        const Redis = require('ioredis');
        redisClient = new Redis(REDIS_URL);
        console.log("✅ Redis Cloud terhubung. Data persisten.");
    } catch(e) { console.log("⚠️ Redis gagal, fallback file JSON."); }
}

async function saveData(key, data) {
    const str = JSON.stringify(data);
    if (redisClient) await redisClient.set(key, str);
    fs.writeFileSync(`${key}.json`, str);
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

let shortMemory = await loadData('memory', []);
let lessons = await loadData('lessons', { rules: [] });
let userMemory = await loadData('user_memory', {});
let abLog = await loadData('ab_log', []);

function saveAll() {
    saveData('memory', shortMemory.slice(-500));
    saveData('lessons', lessons);
    saveData('user_memory', userMemory);
    saveData('ab_log', abLog.slice(-1000));
}

// ==================== COOLDOWN & RATE LIMITER ====================
const cooldowns = new Map();
const imageCooldown = new Map();

function checkCooldown(userId, type = 'default') {
    const now = Date.now();
    const map = type === 'image' ? imageCooldown : cooldowns;
    const last = map.get(userId) || 0;
    const limit = type === 'image' ? 10000 : 5000;
    if (now - last < limit) return limit - (now - last);
    map.set(userId, now);
    return 0;
}

// ==================== WATCHDOG & SELF-HEALING ====================
setInterval(() => {
    const mem = process.memoryUsage();
    if (mem.heapUsed / mem.heapTotal > 0.95) {
        console.error('⚠️ Memory usage >95%. Exiting...');
        process.exit(1);
    }
    const start = Date.now();
    setImmediate(() => {
        if (Date.now() - start > 1000) {
            console.error('⚠️ Event loop lag detected. Exiting...');
            process.exit(1);
        }
    });
}, 30000);

// ==================== FUNGSI AI (GROQ) & FALLBACK HF ====================
async function askGroq(prompt) {
    try {
        const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7, max_tokens: 1000
        }, { headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, timeout: 30000 });
        return res.data.choices[0].message.content;
    } catch(e) {
        console.error("Groq error, coba HF fallback");
        try {
            const HF_TOKEN = process.env.HF_TOKEN;
            if (HF_TOKEN) {
                const res = await axios.post("https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3", { inputs: prompt }, { headers: { Authorization: `Bearer ${HF_TOKEN}` }, timeout: 30000 });
                return res.data[0].generated_text;
            }
        } catch(e2) { console.error("HF juga error"); }
        return "Maaf, AI sedang sibuk. Coba lagi nanti.";
    }
}

// ==================== DETEKSI BAHASA & KETIDAKPUASAN ====================
const langMap = {
    'ja':'Jepang','my':'Myanmar','fil':'Filipina','ms':'Malaysia','ko':'Korea Selatan',
    'ta':'India (Tamil)','ur':'Pakistan (Urdu)','vi':'Vietnam','en':'Inggris','id':'Indonesia'
};
async function detectLanguage(text) {
    const prompt = `Deteksi bahasa dari teks berikut. Output hanya kode bahasa ISO 639-1 (id,en,ja,my,fil,ms,ko,ta,ur,vi). Teks: "${text}"`;
    try {
        const res = await askGroq(prompt);
        const lang = res.trim().toLowerCase();
        return langMap[lang] ? lang : 'id';
    } catch { return 'id'; }
}
async function detectDissatisfaction(text) {
    const prompt = `Apakah teks berikut menunjukkan KETIDAKPUASAN terhadap jawaban AI? Teks: "${text}" Kriteria: mengeluh, mengatakan salah/tidak tepat, meminta koreksi, nada marah/kecewa. Output hanya: PUAS atau TIDAK_PUAS`;
    const res = await askGroq(prompt);
    return res.trim().toUpperCase() === 'TIDAK_PUAS';
}

// ==================== RINGKASAN PERCAKAPAN OTOMATIS ====================
async function summarizeChat(userId, chatHistory) {
    if (chatHistory.length < 10) return chatHistory;
    const prompt = `Ringkas percakapan berikut menjadi paragraf pendek (maks 100 kata) tanpa kehilangan informasi penting:\n${chatHistory}`;
    const summary = await askGroq(prompt);
    if (!userMemory[userId]) userMemory[userId] = {};
    userMemory[userId].summary = summary;
    userMemory[userId].lastSummary = Date.now();
    saveAll();
    return summary;
}

// ==================== REKOMENDASI TOPIK LANJUTAN ====================
async function getTopicSuggestion(question, answer) {
    const prompt = `Berdasarkan pertanyaan "${question}" dan jawaban "${answer}", berikan 2 pertanyaan lanjutan yang relevan (masing-masing maks 10 kata). Output format: "1. ... 2. ..."`;
    const suggestions = await askGroq(prompt);
    return suggestions;
}

// ==================== WEB SEARCH DENGAN TAVILY ====================
async function searchWebTavily(query) {
    if (!TAVILY_API_KEY) {
        return "❌ Web search: API key Tavily tidak ditemukan. Tambahkan TAVILY_API_KEY di environment variables.";
    }
    try {
        const response = await axios.post('https://api.tavily.com/search', {
            api_key: TAVILY_API_KEY,
            query: query,
            search_depth: "basic",
            max_results: 3,
            include_answer: true
        }, { timeout: 15000 });
        
        let output = `🔍 *Hasil pencarian Tavily untuk:* "${query}"\n\n`;
        if (response.data.answer) {
            output += `📝 *Rangkuman:* ${response.data.answer}\n\n`;
        }
        const results = response.data.results || [];
        if (results.length === 0) return "Tidak ada hasil ditemukan.";
        results.forEach((item, i) => {
            output += `${i+1}. *${item.title}*\n   ${item.content.slice(0, 150)}...\n   [Link](${item.url})\n\n`;
        });
        return output;
    } catch (error) {
        console.error("Tavily error:", error.message);
        return "❌ Gagal mencari di web. Coba lagi nanti.";
    }
}

// ==================== TOOLS LAINNYA ====================
function getCurrentTime(lang='id') {
    const now = new Date();
    const opt = { timeZone: 'Asia/Tokyo', weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' };
    if (lang === 'ja') return `🕒 現在の日本時間:\n${now.toLocaleString('ja-JP', opt)}`;
    if (lang === 'en') return `🕒 *Current time in Japan (JST)*:\n${now.toLocaleString('en-US', opt)}`;
    return `🕒 *Waktu Jepang (JST)*:\n${now.toLocaleString('id-ID', opt)}`;
}
function calculate(expr) {
    try {
        let clean = expr.replace(/[^0-9+\-*/().%]/g, '');
        if (!clean) return "❌ Tidak ada angka/operator.";
        return `🧮 Hasil: ${expr} = ${eval(clean)}`;
    } catch { return "❌ Format salah. Contoh: 5*3, (4+6)*2"; }
}
async function searchLocation(query) {
    try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { headers: { 'User-Agent': 'TelegramBot/1.0' } });
        if (!res.data.length) return "Lokasi tidak ditemukan.";
        const p = res.data[0];
        return `📍 *${p.display_name.split(',')[0]}*\n📌 ${p.display_name}\n🗺️ [Peta](https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon})`;
    } catch { return "❌ Gagal cari lokasi."; }
}
async function getWeather(city) {
    if (!OPENWEATHER_API_KEY) return "❌ Cuaca: API key tidak ada.";
    try {
        const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`);
        const d = res.data;
        return `🌤️ *Cuaca ${d.name}*\n🌡️ ${d.main.temp}°C\n💧 ${d.main.humidity}%\n🌬️ ${d.wind.speed} m/s\n📝 ${d.weather[0].description}`;
    } catch { return `Kota "${city}" tidak ditemukan.`; }
}
async function generateImage(prompt) {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
    try {
        await axios.head(url, { timeout: 15000 });
        return url;
    } catch (error) {
        console.error(`❌ Gambar gagal: ${error.message}`);
        return null;
    }
}
function crackHash(targetHash, maxLen=6) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    function brute(cur,len) {
        if(cur.length===len) return crypto.createHash('md5').update(cur).digest('hex')===targetHash?cur:null;
        for(let i=0;i<chars.length;i++) { const r=brute(cur+chars[i],len); if(r) return r; }
        return null;
    }
    for(let l=1;l<=maxLen;l++) { const f=brute('',l); if(f) return f; }
    return null;
}
async function handleTools(msg, lang='id') {
    const low = msg.toLowerCase();
    if(low.includes('jam')||low.includes('waktu')) return getCurrentTime(lang);
    if((low.includes('hitung')||low.match(/\d+[\+\-\*\/]\d+/))&&!low.includes('cuaca')) {
        let expr = msg.replace(/[^0-9+\-*/().%]/g,'');
        if(expr) return calculate(expr);
    }
    if(low.includes('alamat')||low.includes('lokasi')||low.includes('dimana')) {
        let q = msg.replace(/alamat|lokasi|dimana|cari tempat/gi,'').trim();
        return q ? await searchLocation(q) : "Sebutkan nama tempat.";
    }
    if(low.includes('cuaca')) {
        let city = msg.replace(/cuaca|weather|di|kota/gi,'').trim();
        return city ? await getWeather(city) : "Contoh: cuaca Tokyo";
    }
    const searchKw = ['cari','search','google','apa itu','informasi','berita','tavily'];
    if(searchKw.some(k=>low.includes(k))) {
        let q = msg; searchKw.forEach(k=>q=q.replace(new RegExp(k,'gi'),'')); q=q.trim();
        return q ? await searchWebTavily(q) : "Apa yang ingin dicari?";
    }
    return null;
}

// ==================== A/B TESTING & MEMORY ====================
function getCachedAnswer(question) {
    const match = lessons.rules.find(r => question.toLowerCase().includes(r.trigger?.toLowerCase()||''));
    return match ? match.answer : null;
}
async function getAnswerWithAB(question, userId) {
    const styles = ['formal','santai'];
    const chosen = Math.random()>0.5?'santai':'formal';
    const prompt = chosen==='santai' 
        ? `Jawab dengan gaya santai kayak teman (pake 'aku','kamu','gak','dong'): ${question}`
        : `Jawab secara jelas dan informatif: ${question}`;
    const answer = await askGroq(prompt);
    abLog.push({ userId, question, chosen, answer, timestamp: Date.now() });
    if(abLog.length>1000) abLog.shift();
    saveAll();
    return { answer, style: chosen };
}
async function getSmartAnswer(question, userId) {
    const cached = getCachedAnswer(question);
    if(cached) return cached;
    const needsFresh = ['terbaru','berita','update','sekarang','harga','skor'].some(k=>question.toLowerCase().includes(k));
    if(needsFresh && TAVILY_API_KEY) {
        const searchRes = await searchWebTavily(question);
        if(searchRes && !searchRes.includes('Gagal') && !searchRes.includes('API key')) {
            // Ekstrak jawaban dari hasil pencarian (optional)
            const learned = await askGroq(`Berdasarkan hasil pencarian berikut: ${searchRes}\nJawab pertanyaan: ${question}`);
            lessons.rules.push({ trigger: question.slice(0,50), answer: learned, source:'auto_learn', timestamp: Date.now() });
            if(lessons.rules.length>200) lessons.rules.shift();
            saveAll();
            return learned;
        }
    }
    const similar = shortMemory.filter(m=>m.userId===userId).slice(-5).map(m=>`Q: ${m.q}\nA: ${m.a}`).join('\n');
    const context = similar ? `Konteks sebelumnya:\n${similar}\n\n` : '';
    const { answer } = await getAnswerWithAB(context+question, userId);
    shortMemory.push({ userId, q: question, a: answer, timestamp: Date.now() });
    if(shortMemory.length>500) shortMemory.shift();
    saveAll();
    return answer;
}

// ==================== WEBHOOK SERVER ====================
const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
    const update = req.body;
    // Callback feedback
    if(update.callback_query) {
        const cb = update.callback_query;
        const chatId = cb.message.chat.id;
        if(cb.data==='positive') {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "👍 Terima kasih! Saya akan ingat ini." });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "👎 Maaf, silakan /koreksi pertanyaan | jawaban_benar untuk mengajari saya." });
        }
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, { callback_query_id: cb.id });
        res.sendStatus(200);
        return;
    }
    if(!update.message || update.message.from.is_bot) { res.sendStatus(200); return; }
    
    const chatId = update.message.chat.id;
    const userId = chatId.toString();
    const text = update.message.text;
    
    // Cooldown untuk semua perintah (kecuali /start, /help, /image punya sendiri)
    if (!text.startsWith('/start') && !text.startsWith('/help') && !text.startsWith('/image')) {
        const cooldown = checkCooldown(userId, 'default');
        if (cooldown > 0) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `⏳ Tunggu ${Math.ceil(cooldown/1000)} detik sebelum perintah berikutnya.` });
            res.sendStatus(200);
            return;
        }
    }
    
    // Perintah /image dengan cooldown khusus
    if (text.startsWith('/image ')) {
        const cooldownImg = checkCooldown(userId, 'image');
        if (cooldownImg > 0) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `⏳ Tunggu ${Math.ceil(cooldownImg/1000)} detik sebelum perintah gambar berikutnya.` });
            res.sendStatus(200);
            return;
        }
        const prompt = text.slice(7);
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🎨 Menggambar: "${prompt}"...` });
        const imgUrl = await generateImage(prompt);
        if (imgUrl) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { chat_id: chatId, photo: imgUrl, caption: `✨ Hasil: ${prompt}` });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Gagal membuat gambar. Coba lagi nanti." });
        }
        res.sendStatus(200);
        return;
    }
    
    // Deteksi bahasa & ketidakpuasan
    const userLang = await detectLanguage(text);
    console.log(`🌐 Bahasa: ${userLang} | User: ${userId}`);
    const lastMsg = shortMemory.filter(m=>m.userId===userId).slice(-1)[0];
    if(lastMsg && await detectDissatisfaction(text)) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🙏 Maaf jika jawaban saya kurang tepat. Gunakan /koreksi pertanyaan | jawaban_benar untuk mengajari saya." });
        res.sendStatus(200);
        return;
    }
    
    // Tools
    const toolRes = await handleTools(text, userLang);
    if(toolRes) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: toolRes, parse_mode: "Markdown", disable_web_page_preview: true });
        res.sendStatus(200);
        return;
    }
    
    // Perintah teks khusus
    if (text === '/start') {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🤖 *Ultimate Bot v12* - Multibahasa, belajar, web search (Tavily).\nKetik /help untuk bantuan." });
        res.sendStatus(200);
        return;
    }
    if (text === '/help' || text.toLowerCase().includes('bantuan') || text.toLowerCase().includes('perintah')) {
        const helpText = `📋 *Daftar Perintah*
/start - Mulai
/help - Bantuan ini
/stats - Statistik bot
/rollback - Hapus aturan terakhir
/feedback - 5 feedback terakhir
/image <desc> - Buat gambar
/crack <hash> - Crack MD5 (6 char)
/hitung <expr> - Kalkulator
/jam - Waktu Jepang
/cuaca <kota> - Cuaca
/lokasi <tempat> - Cari alamat
/cari <topik> - Web search (Tavily)
/koreksi Q | A - Ajari bot
Kirim pesan biasa, saya jawab dalam bahasa Anda.`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: helpText, parse_mode: "Markdown" });
        res.sendStatus(200);
        return;
    }
    if (text === '/stats') {
        const mem = process.memoryUsage();
        const statsMsg = `📊 *Statistik*\nUptime: ${Math.floor(process.uptime()/60)} menit\nMemory: ${(mem.heapUsed/1024/1024).toFixed(2)} MB\nAturan: ${lessons.rules.length}\nMemory chat: ${shortMemory.length}`;
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: statsMsg, parse_mode: "Markdown" });
        res.sendStatus(200);
        return;
    }
    if (text === '/rollback') {
        if (lessons.rules.length) {
            const removed = lessons.rules.pop();
            saveAll();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `🗑️ Hapus: "${removed.trigger?.slice(0,50)}"` });
        } else { await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Tidak ada aturan." }); }
        res.sendStatus(200);
        return;
    }
    if (text === '/feedback') {
        const last = abLog.slice(-5).map(l => `${l.style}: ${l.question.slice(0,30)}...`).join('\n');
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `📝 Feedback terakhir:\n${last || 'Belum ada'}`, parse_mode: "Markdown" });
        res.sendStatus(200);
        return;
    }
    if (text.startsWith('/koreksi ')) {
        const parts = text.slice(9).split('|');
        if (parts.length<2) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Format: /koreksi pertanyaan | jawaban_benar" });
        } else {
            lessons.rules.push({ trigger: parts[0].trim(), answer: parts[1].trim(), source: 'user', timestamp: Date.now() });
            if(lessons.rules.length>200) lessons.rules.shift();
            saveAll();
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "✅ Terima kasih! Saya belajar." });
        }
        res.sendStatus(200);
        return;
    }
    if (text.startsWith('/crack ')) {
        const hash = text.slice(7).trim();
        if (hash.length !== 32) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "Hash MD5 harus 32 hex." });
        } else {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "🔓 Memproses (6 karakter)... bisa lama." });
            const found = crackHash(hash,6);
            if(found) await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `✅ Password: \`${found}\``, parse_mode: "Markdown" });
            else await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: "❌ Tidak ditemukan." });
        }
        res.sendStatus(200);
        return;
    }
    
    // Chat biasa dengan ringkasan & rekomendasi
    let answer;
    if (userLang !== 'id' && userLang !== 'en') {
        const prompt = `Jawab dalam bahasa ${langMap[userLang]||'Indonesia'}: ${text}`;
        answer = await askGroq(prompt);
    } else {
        answer = await getSmartAnswer(text, userId);
    }
    
    // Counter untuk ringkasan & rekomendasi
    if (!userMemory[userId]) userMemory[userId] = {};
    userMemory[userId].msgCount = (userMemory[userId].msgCount || 0) + 1;
    if (userMemory[userId].msgCount % 20 === 0) {
        const history = shortMemory.filter(m => m.userId === userId).slice(-20).map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n');
        await summarizeChat(userId, history);
    }
    if (userMemory[userId].msgCount % 5 === 0 && answer.length > 50 && !text.startsWith('/')) {
        const suggestions = await getTopicSuggestion(text, answer);
        if (suggestions && !suggestions.includes("tidak ada") && suggestions.length > 10) {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text: `💡 *Topik lanjutan:*\n${suggestions}`, parse_mode: "Markdown" });
        }
    }
    saveAll();
    
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: answer,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [[ { text: "👍 Membantu", callback_data: "positive" }, { text: "👎 Tidak membantu", callback_data: "negative" } ]] }
    });
    res.sendStatus(200);
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Ultimate Bot v12 (Tavily) berjalan di port ${PORT}`);
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/webhook/${TELEGRAM_TOKEN}`;
    try {
        await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${url}`);
        console.log(`📂 Webhook diset ke ${url}`);
    } catch(e) { console.error("Webhook error:", e.message); }
});
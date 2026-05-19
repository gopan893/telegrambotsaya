const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const schedule = require('node-schedule');
const { google } = require('googleapis');
const sharp = require('sharp');
const FormData = require('form-data');
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

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_DIR = process.cwd();

// ==================== APP ====================
const app = express();
app.use(express.json({ limit: '2mb' }));

// ==================== MEMORI ====================
let redisClient = null;
let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];
let knowledgeBase = [];

// ==================== AI CLIENT ====================
const mistralClient = MISTRAL_API_KEY ? new Mistral({ apiKey: MISTRAL_API_KEY }) : null;

// ==================== REDIS ====================
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
    } catch (_) {}
  }

  try {
    const filePath = path.join(FILE_DIR, `${key}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (_) {}

  return defaultValue;
}

async function saveData(key, data) {
  const str = JSON.stringify(data, null, 2);

  if (redisClient) {
    try {
      await redisClient.set(key, str);
    } catch (e) {
      console.error(`Redis save ${key} gagal:`, e.message);
    }
  }

  try {
    fs.writeFileSync(path.join(FILE_DIR, `${key}.json`), str, 'utf-8');
  } catch (e) {
    console.error(`File save ${key} gagal:`, e.message);
  }
}

async function loadAllMemories() {
  shortMemory = await loadData('memory', []);
  lessons = await loadData('lessons', { rules: [] });
  userMemory = await loadData('user_memory', {});
  abLog = await loadData('ab_log', []);
  knowledgeBase = await loadData('knowledge', []);

  console.log(`📂 Memori: ${shortMemory.length} chat, ${lessons.rules.length} aturan, ${knowledgeBase.length} pengetahuan`);
}

async function saveAll() {
  await Promise.all([
    saveData('memory', shortMemory.slice(-500)),
    saveData('lessons', lessons),
    saveData('user_memory', userMemory),
    saveData('ab_log', abLog.slice(-1000)),
    saveData('knowledge', knowledgeBase),
  ]);
}

function ensureUser(userId) {
  if (!userMemory[userId]) {
    userMemory[userId] = {
      botName: "Bot Desa",
      todos: [],
      reminders: [],
      nlpPatterns: [],
      msgCount: 0
    };
  } else {
    userMemory[userId].botName ||= "Bot Desa";
    userMemory[userId].todos ||= [];
    userMemory[userId].reminders ||= [];
    userMemory[userId].nlpPatterns ||= [];
    userMemory[userId].msgCount ||= 0;
  }
  return userMemory[userId];
}

// ==================== WATCHDOG ====================
setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.heapUsed / mem.heapTotal > 0.95) {
    console.error('⚠️ Memory >95%, exit');
    process.exit(1);
  }
}, 60000);

// ==================== TELEGRAM HELPERS ====================
async function telegramPost(method, payload) {
  return axios.post(`${TELEGRAM_API}/${method}`, payload, { timeout: 20000 });
}

async function safeSendMessage(chatId, text, extra = {}) {
  const payload = { chat_id: chatId, text, ...extra };

  try {
    await telegramPost('sendMessage', payload);
    return true;
  } catch (err) {
    // fallback kalau reply_to / parse_mode bikin error
    try {
      const retry = { ...payload };
      delete retry.reply_to_message_id;
      delete retry.parse_mode;
      await telegramPost('sendMessage', retry);
      return true;
    } catch (e) {
      console.error("Send error:", e.response?.data || e.message);
      return false;
    }
  }
}

function splitText(text, maxLen = 3900) {
  if (!text || text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut < 1000) cut = maxLen;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendChunkedMessage(chatId, text, extra = {}) {
  const chunks = splitText(String(text || ''));
  for (let i = 0; i < chunks.length; i++) {
    await safeSendMessage(chatId, chunks[i], i === 0 ? extra : {});
  }
}

async function sendPhotoUrl(chatId, photoUrl, caption = '', extra = {}) {
  try {
    await telegramPost('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      ...extra
    });
    return true;
  } catch (e) {
    console.error("Send photo URL error:", e.response?.data || e.message);
    return false;
  }
}

async function sendPhotoBuffer(chatId, buffer, caption = '', replyToMessageId = null) {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  if (replyToMessageId) form.append('reply_to_message_id', String(replyToMessageId));
  form.append('photo', buffer, {
    filename: 'image.jpg',
    contentType: 'image/jpeg'
  });

  try {
    await axios.post(`${TELEGRAM_API}/sendPhoto`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
    return true;
  } catch (e) {
    console.error("Send photo buffer error:", e.response?.data || e.message);
    return false;
  }
}

// ==================== WAKTU / LOKASI / UTIL ====================
function getTimeInZone(location) {
  const timezones = {
    'jakarta': 'Asia/Jakarta', 'indonesia': 'Asia/Jakarta',
    'jepang': 'Asia/Tokyo', 'tokyo': 'Asia/Tokyo',
    'new york': 'America/New_York', 'london': 'Europe/London',
    'paris': 'Europe/Paris', 'dubai': 'Asia/Dubai',
    'riyadh': 'Asia/Riyadh', 'mekkah': 'Asia/Riyadh',
    'singapore': 'Asia/Singapore', 'kuala lumpur': 'Asia/Kuala_Lumpur',
    'bangkok': 'Asia/Bangkok', 'seoul': 'Asia/Seoul',
    'beijing': 'Asia/Shanghai', 'sydney': 'Australia/Sydney',
    'los angeles': 'America/Los_Angeles', 'chicago': 'America/Chicago',
    'moscow': 'Europe/Moscow', 'berlin': 'Europe/Berlin'
  };

  if (!location) return null;
  const q = location.toLowerCase().trim();

  let tz = timezones[q] || null;
  if (!tz) {
    for (const [key, value] of Object.entries(timezones)) {
      if (q.includes(key)) {
        tz = value;
        break;
      }
    }
  }

  if (!tz) return null;

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return {
    time: formatter.format(new Date()),
    timezone: tz
  };
}

function getCurrentTime() {
  const res = getTimeInZone('jakarta');
  return `🕒 Waktu Indonesia (WIB): ${res.time}`;
}

function getCurrentDate() {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  return `📅 Hari ini: ${formatter.format(new Date())}`;
}

function calculate(expr) {
  try {
    const clean = String(expr).replace(/[^0-9+\-*/().%]/g, '');
    if (!clean) return "Format salah";
    const result = Function(`"use strict"; return (${clean})`)();
    return `Hasil: ${expr} = ${result}`;
  } catch {
    return "Error hitung";
  }
}

function parseJakartaDateTime(dateStr, timeStr = '09:00') {
  if (!dateStr) return null;
  const t = String(timeStr).trim();
  const normalizedTime = t.length === 5 ? `${t}:00` : t;
  const dt = new Date(`${dateStr}T${normalizedTime}+07:00`);
  return isNaN(dt) ? null : dt;
}

async function searchLocation(query) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TelegramBot/1.0' }, timeout: 15000 }
    );

    if (!res.data.length) return "Tidak ditemukan";

    const p = res.data[0];
    return `📍 ${p.display_name}\n🗺️ https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}`;
  } catch (e) {
    return "Error lokasi";
  }
}

async function getWeather(city) {
  if (!OPENWEATHER_API_KEY) return "API key cuaca tidak ada";
  try {
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=id`,
      { timeout: 15000 }
    );
    const d = res.data;
    return `🌤️ Cuaca ${d.name}: ${d.main.temp}°C, ${d.weather[0].description}`;
  } catch {
    return `Kota ${city} tidak ditemukan`;
  }
}

async function searchWebTavily(query) {
  if (!TAVILY_API_KEY) return "API key Tavily tidak ada";
  try {
    const res = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: true
      },
      { timeout: 20000 }
    );

    let out = `🔍 Hasil untuk: ${query}\n`;
    if (res.data.answer) out += `\n📝 ${res.data.answer}\n`;

    (res.data.results || []).forEach((item, i) => {
      const content = (item.content || item.snippet || '').toString().slice(0, 180);
      out += `\n${i + 1}. ${item.title}\n   ${content}${content.length >= 180 ? '...' : ''}\n   ${item.url}\n`;
    });

    return out.trim();
  } catch (e) {
    return "Error web search";
  }
}

async function generateImage(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
  return url;
}

function simpleDetectLanguage(text) {
  if (!text) return 'id';
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
  if (/[\u1000-\u109F]/.test(text)) return 'my';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[ăâđêôơư]/.test(text)) return 'vi';
  return 'id';
}

// ==================== AI ====================
async function askMistral(systemPrompt, userPrompt) {
  if (!mistralClient) throw new Error("MISTRAL tidak diset");
  const response = await mistralClient.chat.complete({
    model: "mistral-large-latest",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  });

  const content = response?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map(x => x.text || x.content || '').join('');
  return content || '';
}

async function askGroq(systemPrompt, userPrompt) {
  if (!GROQ_API_KEY) throw new Error("GROQ tidak diset");
  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 20000
    }
  );
  return res.data.choices[0].message.content;
}

async function askAI(systemPrompt, userPrompt) {
  if (MISTRAL_API_KEY) {
    try {
      console.log("🟢 Mistral...");
      const answer = await askMistral(systemPrompt, userPrompt);
      console.log("✅ Mistral sukses");
      return answer;
    } catch (err) {
      console.error("Mistral gagal:", err.message);
    }
  }

  if (GROQ_API_KEY) {
    try {
      console.log("⚡ Groq...");
      const answer = await askGroq(systemPrompt, userPrompt);
      console.log("✅ Groq sukses");
      return answer;
    } catch (err) {
      console.error("Groq gagal:", err.message);
    }
  }

  throw new Error("Semua AI gagal.");
}

function getSystemPrompt(userId) {
  const botName = ensureUser(userId).botName || "Bot Desa";
  return `Kamu adalah asisten pribadi bernama "${botName}".
Gunakan bahasa Indonesia santai, pakai "aku" dan "kamu".
Jawab singkat, jelas, dan maksimal 3 kalimat.
Kalau tidak tahu, bilang tidak tahu.
Jangan mengaku sebagai manusia.
`;
}

function getCachedAnswer(question) {
  const q = question.toLowerCase();
  const match = lessons.rules.find(r => {
    const trig = (r.trigger || '').toLowerCase().trim();
    return trig && q.includes(trig);
  });
  return match ? match.answer : null;
}

async function getAnswerWithAB(question, userId, systemPrompt) {
  const chosen = Math.random() > 0.5 ? 'santai' : 'formal';
  const stylePrompt = chosen === 'santai'
    ? `Jawab dengan santai, gunakan "aku" dan "kamu".`
    : `Jawab dengan gaya informatif dan sopan.`;

  const answer = await askAI(
    systemPrompt,
    `${stylePrompt}\n\nPertanyaan user:\n${question}`
  );

  abLog.push({ userId, question, chosen, answer, timestamp: Date.now() });
  if (abLog.length > 1000) abLog.shift();
  await saveAll();

  return { answer, style: chosen };
}

async function getSmartAnswer(question, userId, systemPrompt) {
  const cached = getCachedAnswer(question);
  if (cached) return cached;

  const qLower = question.toLowerCase();
  const needsFresh = ['terbaru', 'berita', 'update', 'sekarang', 'harga', 'skor'].some(k => qLower.includes(k));

  if (needsFresh && TAVILY_API_KEY) {
    const searchRes = await searchWebTavily(question);
    if (searchRes && !searchRes.includes('Error')) {
      const learnedPrompt = `${question}\n\nHasil pencarian web:\n${searchRes}\n\nJawab singkat berdasarkan data di atas.`;
      const learned = await askAI(systemPrompt, learnedPrompt);
      lessons.rules.push({ trigger: question.slice(0, 50), answer: learned, source: 'auto', timestamp: Date.now() });
      if (lessons.rules.length > 200) lessons.rules.shift();
      await saveAll();
      return learned;
    }
  }

  const similar = shortMemory
    .filter(m => m.userId === userId)
    .slice(-5)
    .map(m => `Q: ${m.q}\nA: ${m.a}`)
    .join('\n\n');

  const context = similar ? `Konteks percakapan terakhir:\n${similar}\n\n` : '';
  const { answer } = await getAnswerWithAB(context + question, userId, systemPrompt);

  shortMemory.push({ userId, q: question, a: answer, timestamp: Date.now() });
  if (shortMemory.length > 500) shortMemory.shift();
  await saveAll();

  return answer;
}

// ==================== GOOGLE CALENDAR ====================
function createOAuthClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return null;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

function getAuthUrl(state) {
  const client = createOAuthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    state
  });
}

async function getTokensFromCode(code) {
  const client = createOAuthClient();
  if (!client) throw new Error("OAuth2 tidak dikonfigurasi");
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function saveUserTokens(userId, tokens) {
  ensureUser(userId);
  userMemory[userId].calendarTokens = tokens;
  await saveAll();
}

async function getUserTokens(userId) {
  return userMemory[userId]?.calendarTokens || null;
}

async function getCalendarClient(userId) {
  const tokens = await getUserTokens(userId);
  if (!tokens) return null;

  const client = createOAuthClient();
  if (!client) return null;

  client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: client });
}

// ==================== FITUR TAMBAHAN ====================
async function handleMood(chatId, userId, text, msg) {
  const u = ensureUser(userId);

  if (text === '/mood') {
    await safeSendMessage(chatId, "Apa kabarmu hari ini? (senang/biasa/sedih/cemas/energik)", { reply_to_message_id: msg.message_id });
    u.awaitingMood = true;
    await saveAll();
    return true;
  }

  if (u.awaitingMood) {
    const mood = text.toLowerCase().trim();
    const valid = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];

    if (valid.includes(mood)) {
      u.mood = mood;
      u.lastMoodUpdate = Date.now();
      delete u.awaitingMood;
      await saveAll();
      await safeSendMessage(chatId, `Terima kasih! Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
    } else {
      await safeSendMessage(chatId, "Pilihan: senang, biasa, sedih, cemas, energik.", { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

async function handleReminder(chatId, userId, text, msg) {
  const u = ensureUser(userId);

  if (text.startsWith('/remind')) {
    const parts = text.split(' ').slice(1);
    if (parts.length < 3) {
      await safeSendMessage(chatId, "Format: /remind YYYY-MM-DD HH:MM pesan", { reply_to_message_id: msg.message_id });
      return true;
    }

    const dateStr = parts[0];
    const timeStr = parts[1];
    const message = parts.slice(2).join(' ');

    const datetime = parseJakartaDateTime(dateStr, timeStr);
    if (!datetime || datetime <= new Date()) {
      await safeSendMessage(chatId, "Tanggal/waktu tidak valid atau sudah lewat.", { reply_to_message_id: msg.message_id });
      return true;
    }

    const reminderId = Date.now().toString();

    schedule.scheduleJob(datetime, async () => {
      await safeSendMessage(chatId, `⏰ Pengingat: ${message}`);
      const current = ensureUser(userId);
      current.reminders = (current.reminders || []).filter(r => r.id !== reminderId);
      await saveAll();
    });

    u.reminders.push({ id: reminderId, time: datetime.toISOString(), message });
    await saveAll();

    await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${datetime.toString()}`, { reply_to_message_id: msg.message_id });
    return true;
  }

  return false;
}

async function handleTodo(chatId, userId, text, msg) {
  const u = ensureUser(userId);

  if (text === '/todo') {
    const tasks = u.todos || [];
    if (tasks.length === 0) {
      await safeSendMessage(chatId, "📝 Daftar tugas kosong. Gunakan /add <tugas>", { reply_to_message_id: msg.message_id });
    } else {
      const list = tasks.map((t, i) => `${i + 1}. ${t.done ? '✅' : '❌'} ${t.text}`).join('\n');
      await sendChunkedMessage(chatId, `📋 To-Do List:\n${list}`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (text.startsWith('/add ')) {
    const taskText = text.slice(5).trim();
    if (!taskText) {
      await safeSendMessage(chatId, "Isi tugasnya dulu.", { reply_to_message_id: msg.message_id });
      return true;
    }
    u.todos.push({ text: taskText, done: false, createdAt: Date.now() });
    await saveAll();
    await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
    return true;
  }

  if (text.startsWith('/done ')) {
    const idx = parseInt(text.slice(6)) - 1;
    if (!u.todos || idx < 0 || idx >= u.todos.length) {
      await safeSendMessage(chatId, "Nomor tugas tidak valid.", { reply_to_message_id: msg.message_id });
    } else {
      u.todos[idx].done = true;
      await saveAll();
      await safeSendMessage(chatId, `✅ Tugas "${u.todos[idx].text}" selesai.`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (text === '/cleartodo') {
    u.todos = [];
    await saveAll();
    await safeSendMessage(chatId, "🗑️ Semua tugas dihapus.", { reply_to_message_id: msg.message_id });
    return true;
  }

  return false;
}

let quizState = {};

async function handleQuizPoll(chatId, text, msg) {
  if (text.startsWith('/quiz ')) {
    const question = text.slice(6).trim();
    if (!question) {
      await safeSendMessage(chatId, "Ketik pertanyaan kuisnya dulu.", { reply_to_message_id: msg.message_id });
      return true;
    }
    quizState[chatId] = { type: 'quiz', question };
    await safeSendMessage(chatId, "Kirim opsi jawaban (pisahkan dengan koma):", { reply_to_message_id: msg.message_id });
    return true;
  }

  if (quizState[chatId] && quizState[chatId].type === 'quiz') {
    const options = text.split(',').map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
      await safeSendMessage(chatId, "Minimal 2 opsi.", { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }
    if (options.length > 10) {
      await safeSendMessage(chatId, "Maksimal 10 opsi.", { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }

    await telegramPost('sendPoll', {
      chat_id: chatId,
      question: quizState[chatId].question,
      options,
      is_anonymous: false,
      type: 'quiz',
      correct_option_id: 0
    });

    delete quizState[chatId];
    return true;
  }

  if (text.startsWith('/poll ')) {
    const question = text.slice(6).trim();
    if (!question) {
      await safeSendMessage(chatId, "Ketik pertanyaan pollingnya dulu.", { reply_to_message_id: msg.message_id });
      return true;
    }
    quizState[chatId] = { type: 'poll', question };
    await safeSendMessage(chatId, "Kirim opsi polling (pisahkan dengan koma):", { reply_to_message_id: msg.message_id });
    return true;
  }

  if (quizState[chatId] && quizState[chatId].type === 'poll') {
    const options = text.split(',').map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
      await safeSendMessage(chatId, "Minimal 2 opsi.", { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }
    if (options.length > 10) {
      await safeSendMessage(chatId, "Maksimal 10 opsi.", { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }

    await telegramPost('sendPoll', {
      chat_id: chatId,
      question: quizState[chatId].question,
      options,
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
    try {
      await telegramPost('banChatMember', {
        chat_id: chatId,
        user_id: userIdToKick
      });
      await safeSendMessage(chatId, `User ${msg.reply_to_message.from.first_name} dikeluarkan.`, { reply_to_message_id: msg.message_id });
    } catch (e) {
      await safeSendMessage(chatId, "Gagal mengeluarkan user. Pastikan bot punya izin admin.", { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (text === '/pin' && msg.reply_to_message) {
    try {
      await telegramPost('pinChatMessage', {
        chat_id: chatId,
        message_id: msg.reply_to_message.message_id
      });
      await safeSendMessage(chatId, "Pesan disematkan.", { reply_to_message_id: msg.message_id });
    } catch (e) {
      await safeSendMessage(chatId, "Gagal pin pesan. Pastikan bot punya izin admin.", { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

async function handleImageEdit(chatId, text, msg) {
  if (text.startsWith('/resize ') && msg.reply_to_message?.photo) {
    const size = text.slice(8).toLowerCase().split('x');
    if (size.length !== 2) {
      await safeSendMessage(chatId, "Format: /resize widthxheight (balas foto)", { reply_to_message_id: msg.message_id });
      return true;
    }

    const width = parseInt(size[0]);
    const height = parseInt(size[1]);

    if (isNaN(width) || isNaN(height) || width < 1 || height < 1) {
      await safeSendMessage(chatId, "Lebar/tinggi tidak valid.", { reply_to_message_id: msg.message_id });
      return true;
    }

    const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;

    try {
      const fileInfo = await telegramPost('getFile', { file_id: fileId });
      const filePath = fileInfo.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

      const imageRes = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const resized = await sharp(imageRes.data)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      await sendPhotoBuffer(chatId, resized, `Resize ke ${width}x${height}`, msg.message_id);
    } catch (e) {
      console.error("Resize error:", e.message);
      await safeSendMessage(chatId, "Gagal memproses gambar.", { reply_to_message_id: msg.message_id });
    }

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
    const content = text.slice(7).trim();
    if (!content) {
      await safeSendMessage(chatId, "Isi pengetahuan yang mau disimpan.", { reply_to_message_id: msg.message_id });
      return true;
    }
    knowledgeBase.push({ content, timestamp: Date.now() });
    if (knowledgeBase.length > 1000) knowledgeBase.shift();
    await saveAll();
    await safeSendMessage(chatId, "✅ Pengetahuan ditambahkan.", { reply_to_message_id: msg.message_id });
    return true;
  }

  if (text.startsWith('/askkb ')) {
    const query = text.slice(7).trim().toLowerCase();
    if (!query) {
      await safeSendMessage(chatId, "Tulis pertanyaannya.", { reply_to_message_id: msg.message_id });
      return true;
    }

    const relevant = knowledgeBase.filter(k => k.content.toLowerCase().includes(query));
    if (relevant.length === 0) {
      await safeSendMessage(chatId, "Tidak ada informasi terkait.", { reply_to_message_id: msg.message_id });
    } else {
      const answer = relevant.slice(-3).map(k => `- ${k.content}`).join('\n\n');
      await sendChunkedMessage(chatId, `📚 Basis Pengetahuan:\n${answer}`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

// ==================== NLP UNIVERSAL ====================
function extractJsonObject(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

async function universalNLP(userMessage, userId) {
  const savedPatterns = userMemory[userId]?.nlpPatterns || [];
  const today = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const patternHint = savedPatterns.length > 0
    ? `\n\nPola yang sudah pernah diajarkan:\n${savedPatterns.map(p => `- "${p.question}" -> ${p.intent}`).join('\n')}`
    : '';

  const prompt = `Kamu adalah parser intent untuk asisten Telegram.
Hari ini: ${today}

Tugasmu: tentukan intent dari pesan user dan ekstrak parameternya.

Intent yang tersedia:
- TAMBAH_EVENT: user ingin menambahkan event/jadwal
  params: summary, startDate, startTime, endDate, endTime
- TAMBAH_TUGAS: user ingin menambahkan tugas
  params: task
- TAMBAH_PENGINGAT: user ingin diingatkan pada waktu tertentu
  params: message, time
- TAMBAH_MOOD: user ingin mencatat mood
  params: mood
- CUACA: user ingin tahu cuaca
  params: city
- SEARCH: user ingin cari informasi web
  params: query
- HITUNG: user ingin menghitung
  params: expression
- JAM: user ingin tahu jam
  params: location
- TANGGAL: user ingin tahu tanggal hari ini
  params: {}
- GAMBAR: user ingin membuat gambar
  params: prompt
- LOKASI: user ingin mencari tempat/alamat
  params: place
- NONE: jika tidak cocok

Pesan user:
"${userMessage}"${patternHint}

Output harus JSON saja, tanpa teks lain.
Contoh:
{"intent":"TAMBAH_TUGAS","params":{"task":"beli susu"}}
{"intent":"CUACA","params":{"city":"Bandung"}}
{"intent":"NONE"}`;

  try {
    const response = await askAI(
      "Kamu hanya boleh mengeluarkan JSON valid untuk klasifikasi intent.",
      prompt
    );

    const parsed = extractJsonObject(response);
    if (!parsed || !parsed.intent) return { intent: "NONE" };
    return parsed;
  } catch (e) {
    console.error("NLP error:", e.message);
    return { intent: "NONE" };
  }
}

async function saveNlpPattern(userId, originalQuestion, correctedIntent, correctedParams) {
  const u = ensureUser(userId);
  u.nlpPatterns.push({
    question: originalQuestion.toLowerCase(),
    intent: correctedIntent,
    params: correctedParams,
    timestamp: Date.now()
  });
  if (u.nlpPatterns.length > 100) u.nlpPatterns.shift();
  await saveAll();
}

async function askClarification(chatId, userId, originalText, msg) {
  await safeSendMessage(
    chatId,
    `🤔 Maaf, aku kurang paham dengan:\n"${originalText}"\n\nCoba tulis lebih jelas, misalnya:\n- Tambah event rapat besok jam 10\n- Tambah tugas beli susu\n- Cuaca di Bandung\n- Ingatkan saya besok jam 8\n- Hitung 25*4\n- Jam berapa di New York\n- Gambar kucing lucu`,
    { reply_to_message_id: msg.message_id }
  );

  const u = ensureUser(userId);
  u.awaitingClarification = originalText;
  await saveAll();
}

async function executeUniversalIntent(intent, params, chatId, userId, msg) {
  const u = ensureUser(userId);

  switch (intent) {
    case "TAMBAH_EVENT": {
      const summary = params.summary || "Event";
      const startDate = params.startDate;
      const startTime = params.startTime || "09:00";
      const endDate = params.endDate || startDate;
      const endTime = params.endTime || "10:00";

      if (!startDate) {
        await safeSendMessage(chatId, "❌ Tanggal event belum jelas.", { reply_to_message_id: msg.message_id });
        return true;
      }

      const startDT = parseJakartaDateTime(startDate, startTime);
      const endDT = parseJakartaDateTime(endDate, endTime) || new Date(startDT.getTime() + 60 * 60 * 1000);

      if (!startDT || !endDT) {
        await safeSendMessage(chatId, "❌ Format tanggal/waktu event tidak valid.", { reply_to_message_id: msg.message_id });
        return true;
      }

      const calendar = await getCalendarClient(userId);
      if (!calendar) {
        await safeSendMessage(chatId, "❌ Google Calendar belum terautentikasi. Gunakan /auth dulu.", { reply_to_message_id: msg.message_id });
        return true;
      }

      try {
        await calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary,
            start: { dateTime: startDT.toISOString(), timeZone: 'Asia/Jakarta' },
            end: { dateTime: endDT.toISOString(), timeZone: 'Asia/Jakarta' }
          }
        });

        await safeSendMessage(chatId, `✅ Event "${summary}" ditambahkan ke Google Calendar.`, { reply_to_message_id: msg.message_id });
      } catch (err) {
        console.error("Calendar insert error:", err.response?.data || err.message);
        await safeSendMessage(chatId, "❌ Gagal menambahkan event. Periksa format tanggal.", { reply_to_message_id: msg.message_id });
      }

      return true;
    }

    case "TAMBAH_TUGAS": {
      const taskText = params.task;
      if (!taskText) {
        await safeSendMessage(chatId, "❌ Tugasnya belum jelas.", { reply_to_message_id: msg.message_id });
        return true;
      }
      u.todos.push({ text: taskText, done: false, createdAt: Date.now() });
      await saveAll();
      await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
      return true;
    }

    case "TAMBAH_PENGINGAT": {
      const message = params.message;
      const time = params.time;

      if (!message || !time) {
        await safeSendMessage(chatId, "❌ Pesan atau waktu pengingat belum lengkap.", { reply_to_message_id: msg.message_id });
        return true;
      }

      const remindDate = new Date(time);
      if (isNaN(remindDate) || remindDate <= new Date()) {
        await safeSendMessage(chatId, "❌ Waktu pengingat tidak valid.", { reply_to_message_id: msg.message_id });
        return true;
      }

      const reminderId = Date.now().toString();

      schedule.scheduleJob(remindDate, async () => {
        await safeSendMessage(chatId, `⏰ Pengingat: ${message}`);
        const current = ensureUser(userId);
        current.reminders = (current.reminders || []).filter(r => r.id !== reminderId);
        await saveAll();
      });

      u.reminders.push({ id: reminderId, time: remindDate.toISOString(), message });
      await saveAll();

      await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${remindDate.toString()}`, { reply_to_message_id: msg.message_id });
      return true;
    }

    case "TAMBAH_MOOD": {
      const mood = (params.mood || '').toLowerCase();
      const validMoods = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];

      if (validMoods.includes(mood)) {
        u.mood = mood;
        u.lastMoodUpdate = Date.now();
        await saveAll();
        await safeSendMessage(chatId, `📝 Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, "Mood tidak dikenali. Pilihan: senang, biasa, sedih, cemas, energik.", { reply_to_message_id: msg.message_id });
      }
      return true;
    }

    case "CUACA": {
      const weather = await getWeather(params.city);
      await safeSendMessage(chatId, weather, { reply_to_message_id: msg.message_id });
      return true;
    }

    case "SEARCH": {
      const searchRes = await searchWebTavily(params.query);
      await sendChunkedMessage(chatId, searchRes, { reply_to_message_id: msg.message_id });
      return true;
    }

    case "HITUNG": {
      const calcRes = calculate(params.expression);
      await safeSendMessage(chatId, calcRes, { reply_to_message_id: msg.message_id });
      return true;
    }

    case "JAM": {
      const location = params.location || "jakarta";
      const timeData = getTimeInZone(location);

      if (timeData) {
        await safeSendMessage(chatId, `🕒 Waktu di ${location}: ${timeData.time}`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, `❌ Lokasi "${location}" tidak dikenal. Coba Jakarta, Tokyo, New York, dll.`, { reply_to_message_id: msg.message_id });
      }
      return true;
    }

    case "TANGGAL": {
      await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
      return true;
    }

    case "GAMBAR": {
      const prompt = params.prompt;
      if (!prompt) {
        await safeSendMessage(chatId, "❌ Prompt gambar belum ada.", { reply_to_message_id: msg.message_id });
        return true;
      }

      await safeSendMessage(chatId, `🎨 Membuat gambar: ${prompt}...`, { reply_to_message_id: msg.message_id });
      const img = await generateImage(prompt);
      const ok = await sendPhotoUrl(chatId, img, `✨ ${prompt}`);
      if (!ok) await safeSendMessage(chatId, "❌ Gagal membuat gambar.", { reply_to_message_id: msg.message_id });
      return true;
    }

    case "LOKASI": {
      const place = params.place;
      if (!place) {
        await safeSendMessage(chatId, "❌ Nama lokasi belum ada.", { reply_to_message_id: msg.message_id });
        return true;
      }
      const locRes = await searchLocation(place);
      await safeSendMessage(chatId, locRes, { reply_to_message_id: msg.message_id });
      return true;
    }

    default:
      return false;
  }
}

// ==================== HELPERS COMMAND ====================
async function handleHelp(chatId, msg) {
  const help = `/start - mulai
/help - bantuan
/stats - statistik
/rollback - hapus aturan terakhir
/feedback - log A/B
/image <deskripsi> - buat gambar
/hitung <expr> - kalkulator
/jam - waktu Indonesia
/tanggal - tanggal hari ini
/cuaca <kota>
/lokasi <tempat>
/cari <topik>
/setname <nama> - ganti nama bot
/koreksi Q | A - ajari bot

Fitur:
- /mood
- /remind YYYY-MM-DD HH:MM pesan
- /todo
- /add <tugas>
- /done <nomor>
- /cleartodo
- /quiz <pertanyaan>
- /poll <pertanyaan>
- /kick (balas pesan) [grup]
- /pin (balas pesan) [grup]
- /resize widthxheight (balas foto)
- /sticker (balas foto)
- /learn <teks>
- /askkb <pertanyaan>
- /auth
- /addevent Judul | YYYY-MM-DD HH:MM | YYYY-MM-DD HH:MM

Kamu juga bisa langsung pakai bahasa alami:
- "Tambah event rapat besok jam 10"
- "Tambah tugas beli susu"
- "Cuaca di Bandung"
- "Jam berapa di New York"
- "Gambar kucing lucu"`;

  await sendChunkedMessage(chatId, help, { reply_to_message_id: msg.message_id });
}

// ==================== WEBHOOK ====================
app.get('/health', (req, res) => res.send('OK'));

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) return res.send('No code provided');
  if (!state) return res.send('Missing state');

  try {
    const tokens = await getTokensFromCode(code);
    await saveUserTokens(String(state), tokens);

    // state = userId / chatId di private chat
    await safeSendMessage(String(state), "✅ Autentikasi Google Calendar berhasil! Sekarang kamu bisa pakai /addevent.");
    res.send('Autentikasi berhasil! Silakan kembali ke Telegram.');
  } catch (error) {
    console.error(error);
    res.send('Autentikasi gagal: ' + error.message);
  }
});

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;

    // callback button
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;

      if (cb.data === 'positive') {
        await safeSendMessage(chatId, "👍 Terima kasih!");
      } else if (cb.data === 'negative') {
        await safeSendMessage(chatId, "👎 Gunakan /koreksi untuk mengajari saya.");
      }

      try {
        await telegramPost('answerCallbackQuery', { callback_query_id: cb.id });
      } catch (_) {}

      return res.sendStatus(200);
    }

    if (!update.message) return res.sendStatus(200);
    if (update.message.from?.is_bot) return res.sendStatus(200);

    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = (msg.text || '').trim();

    ensureUser(userId);

    if (!text) {
      await safeSendMessage(chatId, "Maaf, saya hanya bisa membaca pesan teks biasa saat ini.");
      return res.sendStatus(200);
    }

    // ===== COMMAND DASAR =====
    if (text === '/start') {
      const botName = ensureUser(userId).botName;
      await safeSendMessage(chatId, `🤖 Halo! Aku ${botName}. Ketik /help untuk semua perintah.`, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (text === '/help') {
      await handleHelp(chatId, msg);
      return res.sendStatus(200);
    }

    if (text === '/stats') {
      const mem = process.memoryUsage();
      const msgText = `Uptime: ${Math.floor(process.uptime() / 60)} menit
Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
Aturan: ${lessons.rules.length}
Chats: ${shortMemory.length}
Pengetahuan: ${knowledgeBase.length}`;
      await safeSendMessage(chatId, msgText, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (text === '/rollback') {
      if (lessons.rules.length) {
        lessons.rules.pop();
        await saveAll();
        await safeSendMessage(chatId, "🗑️ Aturan terakhir dihapus.", { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, "Tidak ada aturan.", { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (text === '/feedback') {
      const last = abLog.slice(-5).map(l => `${l.style}: ${l.question.slice(0, 30)}...`).join('\n');
      await safeSendMessage(chatId, `Feedback terakhir:\n${last || 'Belum ada'}`, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (text.startsWith('/image ')) {
      const prompt = text.slice(7).trim();
      if (!prompt) {
        await safeSendMessage(chatId, "Tulis deskripsi gambarnya dulu.", { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
      }
      const img = await generateImage(prompt);
      const ok = await sendPhotoUrl(chatId, img, `✨ ${prompt}`);
      if (!ok) await safeSendMessage(chatId, "❌ Gagal membuat gambar.", { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    // /koreksi Q | A
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
          await saveAll();
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
        ensureUser(userId).botName = newName;
        await saveAll();
        await safeSendMessage(chatId, `✅ Namaku sekarang "${newName}".`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, "❌ Nama tidak valid.", { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    // ===== FITUR TAMBAHAN =====
    if (await handleMood(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleReminder(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleTodo(chatId, userId, text, msg)) return res.sendStatus(200);
    if (await handleQuizPoll(chatId, text, msg)) return res.sendStatus(200);
    if (await handleGroupManagement(chatId, text, msg)) return res.sendStatus(200);
    if (await handleImageEdit(chatId, text, msg)) return res.sendStatus(200);
    if (await handleStickerHint(chatId, text, msg)) return res.sendStatus(200);
    if (await handleKnowledge(chatId, text, msg)) return res.sendStatus(200);

    // ===== GOOGLE CALENDAR =====
    if (text === '/auth') {
      if (msg.chat.type !== 'private') {
        await safeSendMessage(chatId, "Untuk keamanan, gunakan /auth di chat pribadi dengan bot ini.");
        return res.sendStatus(200);
      }

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        await safeSendMessage(chatId, "❌ Fitur Google Calendar belum dikonfigurasi.");
        return res.sendStatus(200);
      }

      const authUrl = getAuthUrl(userId);
      if (!authUrl) {
        await safeSendMessage(chatId, "❌ Gagal membuat link autentikasi.");
        return res.sendStatus(200);
      }

      await safeSendMessage(chatId, `🔐 Klik tautan untuk autentikasi Google Calendar:\n${authUrl}\n\nSetelah login, kamu akan diarahkan kembali.`);
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

      const startDateTime = new Date(startStr.replace(' ', 'T') + ':00+07:00');
      const endDateTime = new Date(endStr.replace(' ', 'T') + ':00+07:00');

      if (isNaN(startDateTime) || isNaN(endDateTime)) {
        await safeSendMessage(chatId, "Format tanggal/waktu salah.", { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
      }

      try {
        await calendar.events.insert({
          calendarId: 'primary',
          resource: {
            summary,
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Jakarta' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Jakarta' }
          }
        });

        await safeSendMessage(chatId, `✅ Event "${summary}" ditambahkan ke Google Calendar.`, { reply_to_message_id: msg.message_id });
      } catch (err) {
        console.error(err.response?.data || err.message);
        await safeSendMessage(chatId, "❌ Gagal menambahkan event.", { reply_to_message_id: msg.message_id });
      }

      return res.sendStatus(200);
    }

    // ===== TOOLS =====
    const toolRes = await handleTools(text);
    if (toolRes) {
      await sendChunkedMessage(chatId, toolRes, {
        reply_to_message_id: msg.message_id,
        disable_web_page_preview: true
      });
      return res.sendStatus(200);
    }

    // ===== NILAI KLARIFIKASI =====
    const u = ensureUser(userId);

    if (u.awaitingClarification) {
      const originalQuestion = u.awaitingClarification;
      delete u.awaitingClarification;
      await saveAll();

      const clarificationNLP = await universalNLP(text, userId);
      if (clarificationNLP.intent !== "NONE") {
        await saveNlpPattern(userId, originalQuestion, clarificationNLP.intent, clarificationNLP.params);
        await safeSendMessage(chatId, `✅ Terima kasih! Aku akan mengingat maksud "${originalQuestion}".`, { reply_to_message_id: msg.message_id });
        await executeUniversalIntent(clarificationNLP.intent, clarificationNLP.params || {}, chatId, userId, msg);
      } else {
        await safeSendMessage(chatId, "Maaf, masih kurang jelas. Gunakan /help.", { reply_to_message_id: msg.message_id });
      }

      return res.sendStatus(200);
    }

    // ===== NLP UNIVERSAL =====
    const nlpResult = await universalNLP(text, userId);

    if (nlpResult.intent && nlpResult.intent !== "NONE") {
      const executed = await executeUniversalIntent(nlpResult.intent, nlpResult.params || {}, chatId, userId, msg);
      if (executed) return res.sendStatus(200);
    } else {
      if (text.length > 5 && !text.startsWith('/')) {
        await askClarification(chatId, userId, text, msg);
        return res.sendStatus(200);
      }
    }

    // ===== FALLBACK CHAT AI =====
    const lang = simpleDetectLanguage(text);
    let prompt = text;

    if (lang === 'ja') prompt = `Jawab dalam bahasa Jepang: ${text}`;
    else if (lang === 'my') prompt = `Jawab dalam bahasa Myanmar: ${text}`;
    else if (lang === 'ko') prompt = `Jawab dalam bahasa Korea: ${text}`;
    else if (lang === 'vi') prompt = `Jawab dalam bahasa Vietnam: ${text}`;

    const systemPrompt = getSystemPrompt(userId);
    let answer;

    try {
      answer = await getSmartAnswer(prompt, userId, systemPrompt);
    } catch (e) {
      console.error(e);
      answer = "❌ AI sedang sibuk. Coba lagi nanti.";
    }

    u.msgCount = (u.msgCount || 0) + 1;

    // Ringkasan percakapan tiap 20 pesan
    if (u.msgCount % 20 === 0) {
      const history = shortMemory
        .filter(m => m.userId === userId)
        .slice(-20)
        .map(m => `Q: ${m.q}\nA: ${m.a}`)
        .join('\n\n');

      if (history.length > 50) {
        try {
          const summary = await askAI(
            getSystemPrompt(userId),
            `Ringkas percakapan ini maksimal 100 kata:\n\n${history}`
          );
          u.summary = summary;
          await saveAll();
        } catch (_) {}
      }
    }

    // Saran topik lanjutan
    if (u.msgCount % 5 === 0 && answer.length > 50 && !text.startsWith('/')) {
      try {
        const suggestions = await askAI(
          getSystemPrompt(userId),
          `Berdasarkan pertanyaan user:\n"${text}"\n\nDan jawaban:\n"${answer}"\n\nBeri 2 pertanyaan lanjutan singkat, format:\n1. ...\n2. ...`
        );

        if (suggestions && suggestions.length > 10 && !suggestions.toLowerCase().includes("tidak")) {
          await safeSendMessage(chatId, `💡 Topik lanjutan:\n${suggestions}`, { reply_to_message_id: msg.message_id });
        }
      } catch (_) {}
    }

    await saveAll();

    await sendChunkedMessage(chatId, answer, {
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [[
          { text: "👍", callback_data: "positive" },
          { text: "👎", callback_data: "negative" }
        ]]
      }
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(200);
  }
});

// ==================== TOOL ROUTER ====================
async function handleTools(msg) {
  const low = msg.toLowerCase();

  if (low.includes('tanggal') && (low.includes('berapa') || low.includes('hari ini'))) {
    return getCurrentDate();
  }

  if (low.includes('jam') || low.includes('waktu')) {
    return getCurrentTime();
  }

  if ((low.includes('hitung') || low.match(/\d+[\+\-\*\/]\d+/)) && !low.includes('cuaca')) {
    const expr = msg.replace(/[^0-9+\-*/().%]/g, '');
    if (expr) return calculate(expr);
  }

  if (low.includes('alamat') || low.includes('lokasi') || low.includes('dimana')) {
    const q = msg.replace(/alamat|lokasi|dimana|cari tempat/gi, '').trim();
    return q ? await searchLocation(q) : "Sebutkan tempat";
  }

  if (low.includes('cuaca')) {
    const city = msg.replace(/cuaca|weather|di|kota/gi, '').trim();
    return city ? await getWeather(city) : "Contoh: cuaca Tokyo";
  }

  const searchKw = ['cari', 'search', 'google', 'apa itu', 'informasi', 'berita'];
  if (searchKw.some(k => low.includes(k))) {
    let q = msg;
    searchKw.forEach(k => {
      q = q.replace(new RegExp(k, 'gi'), '');
    });
    q = q.trim();
    return q ? await searchWebTavily(q) : "Apa yang ingin dicari?";
  }

  return null;
}

// ==================== ERROR HANDLER ====================
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

// ==================== START SERVER ====================
async function start() {
  await initRedis();
  await loadAllMemories();

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Bot AI berjalan di port ${PORT}`);

    let host = process.env.RENDER_EXTERNAL_HOSTNAME;
    if (!host) host = 'telegrambotsaya.onrender.com';

    const url = `https://${host}/webhook/${TELEGRAM_TOKEN}`;
    console.log(`🔄 Mengatur webhook ke: ${url}`);

    try {
      const result = await axios.get(`${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(url)}`);
      if (result.data.ok) console.log(`✅ Webhook berhasil diset: ${url}`);
      else console.error(`❌ Gagal set webhook: ${result.data.description}`);
    } catch (e) {
      console.error(`❌ Webhook error: ${e.message}`);
    }
  });
}

start();

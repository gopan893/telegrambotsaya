const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Optional dependencies agar bot tidak langsung crash kalau modul belum terpasang
let scheduleLib = null;
let googleLib = null;
let sharpLib = null;
let FormDataLib = null;
let MistralClass = null;

try { scheduleLib = require('node-schedule'); } catch (_) {}
try { ({ google: googleLib } = require('googleapis')); } catch (_) {}
try { sharpLib = require('sharp'); } catch (_) {}
try { FormDataLib = require('form-data'); } catch (_) {}
try { ({ Mistral: MistralClass } = require('@mistralai/mistralai')); } catch (_) {}

const {
  TELEGRAM_TOKEN,
  MISTRAL_API_KEY,
  GROQ_API_KEY,
  TAVILY_API_KEY,
  OPENWEATHER_API_KEY,
  REDIS_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  PORT = 10000,
  RENDER_EXTERNAL_HOSTNAME
} = process.env;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_TOKEN tidak ditemukan!');
  process.exit(1);
}

if (!MISTRAL_API_KEY && !GROQ_API_KEY) {
  console.error('❌ Tidak ada API key AI! Set minimal MISTRAL_API_KEY atau GROQ_API_KEY.');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const FILE_DIR = process.cwd();

// ==================== APP ====================
const app = express();
app.use(express.json({ limit: '2mb' }));

let server = null;

// ==================== MEMORY ====================
let redisClient = null;
let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];
let knowledgeBase = [];
let quizState = {};
const reminderJobs = new Map();

// ==================== AI CLIENT ====================
const mistralClient = (MISTRAL_API_KEY && MistralClass)
  ? new MistralClass({ apiKey: MISTRAL_API_KEY })
  : null;

// ==================== UTIL ====================
function nowMs() {
  return Date.now();
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

function getCommandBase(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('/')) return null;
  const first = t.split(/\s+/)[0];
  return first.split('@')[0].toLowerCase();
}

function getCommandArgs(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('/')) return '';
  const i = t.indexOf(' ');
  return i === -1 ? '' : t.slice(i + 1).trim();
}

function cleanupSpaces(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function isLikelyActionRequest(text) {
  const q = String(text || '').toLowerCase();
  const kws = [
    'tambah', 'buat', 'jadwalkan', 'ingatkan', 'pengingat', 'remind',
    'cuaca', 'hitung', 'jam', 'waktu', 'tanggal', 'lokasi', 'alamat',
    'cari', 'search', 'gambar', 'image', 'mood', 'tugas', 'todo',
    'event', 'agenda', 'poll', 'quiz'
  ];
  return kws.some(k => q.includes(k));
}

function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function parseFlexibleDateTime(input, fallbackTime = '09:00') {
  if (!input) return null;
  const s = String(input).trim();

  // ISO atau format yang sudah lengkap
  if (s.includes('T')) {
    const d = new Date(s);
    return isValidDate(d) ? d : null;
  }

  // YYYY-MM-DD HH:MM
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (m) {
    return parseJakartaDateTime(m[1], m[2] || fallbackTime);
  }

  const d = new Date(s);
  return isValidDate(d) ? d : null;
}

// ==================== REDIS / STORAGE ====================
async function initRedis() {
  if (!REDIS_URL) return;

  try {
    const Redis = require('ioredis');
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 2000))
    });

    await redisClient.ping();
    console.log('✅ Redis terhubung.');
  } catch (e) {
    console.log('⚠️ Redis gagal, pakai file JSON.');
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
      return JSON.parse(await fsp.readFile(filePath, 'utf-8'));
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
    await fsp.writeFile(path.join(FILE_DIR, `${key}.json`), str, 'utf-8');
  } catch (e) {
    console.error(`File save ${key} gagal:`, e.message);
  }
}

async function saveAll() {
  await Promise.all([
    saveData('memory', shortMemory.slice(-500)),
    saveData('lessons', lessons),
    saveData('user_memory', userMemory),
    saveData('ab_log', abLog.slice(-1000)),
    saveData('knowledge', knowledgeBase.slice(-1000)),
  ]);
}

let saveChain = Promise.resolve();
function persist() {
  saveChain = saveChain
    .then(() => saveAll())
    .catch((err) => console.error('Save error:', err.message));
  return saveChain;
}

function ensureUser(userId) {
  if (!userMemory[userId]) {
    userMemory[userId] = {
      botName: 'Bot Desa',
      todos: [],
      reminders: [],
      nlpPatterns: [],
      msgCount: 0,
      summary: '',
    };
  } else {
    userMemory[userId].botName ||= 'Bot Desa';
    userMemory[userId].todos ||= [];
    userMemory[userId].reminders ||= [];
    userMemory[userId].nlpPatterns ||= [];
    userMemory[userId].msgCount ||= 0;
    userMemory[userId].summary ||= '';
  }
  return userMemory[userId];
}

function cleanupStaleUserState(u) {
  if (!u) return;
  if (u.awaitingClarificationAt && nowMs() - u.awaitingClarificationAt > 10 * 60 * 1000) {
    delete u.awaitingClarification;
    delete u.awaitingClarificationAt;
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

// ==================== WATCHDOG ====================
setInterval(() => {
  const mem = process.memoryUsage();
  const ratio = mem.heapUsed / mem.heapTotal;

  if (ratio > 0.98) {
    console.error('⚠️ Memory >98%, exit untuk mencegah crash total.');
    process.exit(1);
  } else if (ratio > 0.9) {
    console.warn(`⚠️ Memory tinggi: ${(ratio * 100).toFixed(1)}%`);
  }
}, 60000);

// ==================== TELEGRAM HELPERS ====================
async function telegramPost(method, payload) {
  return axios.post(`${TELEGRAM_API}/${method}`, payload, { timeout: 20000 });
}

async function safeSendMessage(chatId, text, extra = {}) {
  const msg = String(text || '').trim();
  if (!msg) return false;

  const payload = { chat_id: chatId, text: msg, ...extra };

  try {
    await telegramPost('sendMessage', payload);
    return true;
  } catch (err) {
    try {
      const retry = { ...payload };
      delete retry.reply_to_message_id;
      delete retry.parse_mode;
      await telegramPost('sendMessage', retry);
      return true;
    } catch (e) {
      console.error('Send error:', e.response?.data || e.message);
      return false;
    }
  }
}

function splitText(text, maxLen = 3900) {
  const s = String(text || '');
  if (s.length <= maxLen) return [s];

  const chunks = [];
  let remaining = s;

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
    console.error('Send photo URL error:', e.response?.data || e.message);
    return false;
  }
}

async function sendPhotoBuffer(chatId, buffer, caption = '', replyToMessageId = null) {
  if (!FormDataLib) {
    console.error('FormData belum terpasang, upload buffer foto tidak bisa.');
    return false;
  }

  const form = new FormDataLib();
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
    console.error('Send photo buffer error:', e.response?.data || e.message);
    return false;
  }
}

// ==================== WAKTU / LOKASI / UTIL ====================
function getTimeInZone(location) {
  const timezones = {
    'jakarta': 'Asia/Jakarta',
    'indonesia': 'Asia/Jakarta',
    'jepang': 'Asia/Tokyo',
    'tokyo': 'Asia/Tokyo',
    'new york': 'America/New_York',
    'london': 'Europe/London',
    'paris': 'Europe/Paris',
    'dubai': 'Asia/Dubai',
    'riyadh': 'Asia/Riyadh',
    'mekkah': 'Asia/Riyadh',
    'singapore': 'Asia/Singapore',
    'kuala lumpur': 'Asia/Kuala_Lumpur',
    'bangkok': 'Asia/Bangkok',
    'seoul': 'Asia/Seoul',
    'beijing': 'Asia/Shanghai',
    'sydney': 'Australia/Sydney',
    'los angeles': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'moscow': 'Europe/Moscow',
    'berlin': 'Europe/Berlin'
  };

  if (!location) return null;
  const q = String(location).toLowerCase().trim();

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

function getCurrentTime(location = 'jakarta') {
  const res = getTimeInZone(location);
  if (!res) return `❌ Lokasi "${location}" tidak dikenal. Coba Jakarta, Tokyo, New York, dll.`;
  return `🕒 Waktu di ${location}: ${res.time}`;
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
    const clean = String(expr)
      .replace(/[^0-9+\-*/().%\s]/g, '')
      .replace(/\s+/g, '');

    if (!clean || !/[0-9]/.test(clean)) return 'Format salah';

    const result = Function(`"use strict"; return (${clean})`)();
    return `Hasil: ${expr} = ${result}`;
  } catch {
    return 'Error hitung';
  }
}

function parseJakartaDateTime(dateStr, timeStr = '09:00') {
  if (!dateStr) return null;

  const date = String(dateStr).trim();
  const time = String(timeStr).trim();

  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const dt = new Date(`${date}T${normalizedTime}+07:00`);
  return isValidDate(dt) ? dt : null;
}

async function searchLocation(query) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'TelegramBot/1.0' },
        timeout: 15000
      }
    );

    if (!res.data.length) return 'Tidak ditemukan';

    const p = res.data[0];
    return `📍 ${p.display_name}\n🗺️ https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}`;
  } catch (e) {
    return 'Error lokasi';
  }
}

async function getWeather(city) {
  if (!OPENWEATHER_API_KEY) return 'API key cuaca tidak ada';

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
  if (!TAVILY_API_KEY) return 'API key Tavily tidak ada';

  try {
    const res = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true
      },
      { timeout: 20000 }
    );

    let out = `🔍 Hasil untuk: ${query}\n`;
    if (res.data.answer) out += `\n📝 ${res.data.answer}\n`;

    (res.data.results || []).forEach((item, i) => {
      const content = String(item.content || item.snippet || '').slice(0, 180);
      out += `\n${i + 1}. ${item.title}\n   ${content}${content.length >= 180 ? '...' : ''}\n   ${item.url}\n`;
    });

    return out.trim();
  } catch (e) {
    return 'Error web search';
  }
}

async function generateImage(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
}

function simpleDetectLanguage(text) {
  if (!text) return 'id';
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return 'ja';
  if (/[\u1000-\u109F]/.test(text)) return 'my';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  if (/[ăâđêôơư]/i.test(text)) return 'vi';
  return 'id';
}

// ==================== AI ====================
async function askMistral(systemPrompt, userPrompt) {
  if (!mistralClient) throw new Error('MISTRAL tidak diset atau package belum ada');

  const response = await mistralClient.chat.complete({
    model: 'mistral-large-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  });

  const content = response?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) return content.map(x => x.text || x.content || '').join('');
  return content || '';
}

async function askGroq(systemPrompt, userPrompt) {
  if (!GROQ_API_KEY) throw new Error('GROQ tidak diset');

  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    },
    {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 20000
    }
  );

  return res.data.choices?.[0]?.message?.content || '';
}

async function askAI(systemPrompt, userPrompt) {
  if (MISTRAL_API_KEY) {
    try {
      console.log('🟢 Mistral...');
      const answer = await askMistral(systemPrompt, userPrompt);
      console.log('✅ Mistral sukses');
      return answer;
    } catch (err) {
      console.error('Mistral gagal:', err.message);
    }
  }

  if (GROQ_API_KEY) {
    try {
      console.log('⚡ Groq...');
      const answer = await askGroq(systemPrompt, userPrompt);
      console.log('✅ Groq sukses');
      return answer;
    } catch (err) {
      console.error('Groq gagal:', err.message);
    }
  }

  throw new Error('Semua AI gagal.');
}

function getSystemPrompt(userId) {
  const botName = ensureUser(userId).botName || 'Bot Desa';
  return `Kamu adalah asisten pribadi bernama "${botName}".
Gunakan bahasa Indonesia santai, pakai "aku" dan "kamu".
Jawab singkat, jelas, dan maksimal 3 kalimat.
Kalau tidak tahu, bilang tidak tahu.
Jangan mengaku sebagai manusia.`;
}

function getCachedAnswer(question) {
  const q = String(question || '').toLowerCase();

  const sortedRules = [...lessons.rules].sort(
    (a, b) => String(b.trigger || '').length - String(a.trigger || '').length
  );

  const match = sortedRules.find(r => {
    const trig = String(r.trigger || '').toLowerCase().trim();
    return trig && q.includes(trig);
  });

  return match ? match.answer : null;
}

async function getAnswerWithAB(question, userId, systemPrompt) {
  const chosen = Math.random() > 0.5 ? 'santai' : 'formal';
  const stylePrompt = chosen === 'santai'
    ? 'Jawab dengan santai, gunakan "aku" dan "kamu".'
    : 'Jawab dengan gaya informatif dan sopan.';

  const answer = await askAI(
    systemPrompt,
    `${stylePrompt}\n\nPertanyaan user:\n${question}`
  );

  abLog.push({ userId, question, chosen, answer, timestamp: nowMs() });
  if (abLog.length > 1000) abLog.shift();
  await persist();

  return { answer, style: chosen };
}

async function getSmartAnswer(question, userId, systemPrompt) {
  const cached = getCachedAnswer(question);
  if (cached) return cached;

  const qLower = String(question || '').toLowerCase();
  const needsFresh = ['terbaru', 'berita', 'update', 'sekarang', 'harga', 'skor'].some(k => qLower.includes(k));

  if (needsFresh && TAVILY_API_KEY) {
    const searchRes = await searchWebTavily(question);
    if (searchRes && !searchRes.includes('Error')) {
      const learnedPrompt = `${question}\n\nHasil pencarian web:\n${searchRes}\n\nJawab singkat berdasarkan data di atas.`;
      const learned = await askAI(systemPrompt, learnedPrompt);

      lessons.rules.push({
        trigger: question.slice(0, 50),
        answer: learned,
        source: 'auto',
        timestamp: nowMs()
      });

      if (lessons.rules.length > 200) lessons.rules.shift();
      await persist();
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

  shortMemory.push({ userId, q: question, a: answer, timestamp: nowMs() });
  if (shortMemory.length > 500) shortMemory.shift();
  await persist();

  return answer;
}

// ==================== GOOGLE CALENDAR ====================
function createOAuthClient() {
  if (!googleLib || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return null;
  return new googleLib.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
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
  if (!client) throw new Error('OAuth2 tidak dikonfigurasi');
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function saveUserTokens(userId, tokens) {
  ensureUser(userId);
  userMemory[userId].calendarTokens = tokens;
  await persist();
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
  return googleLib.calendar({ version: 'v3', auth: client });
}

async function addCalendarEvent(userId, summary, startDT, endDT) {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return { ok: false, reason: 'auth' };

  await calendar.events.insert({
    calendarId: 'primary',
    resource: {
      summary,
      start: { dateTime: startDT.toISOString(), timeZone: 'Asia/Jakarta' },
      end: { dateTime: endDT.toISOString(), timeZone: 'Asia/Jakarta' }
    }
  });

  return { ok: true };
}

// ==================== REMINDER ====================
function scheduleReminderJob(userId, reminder) {
  if (!scheduleLib) return false;

  const when = new Date(reminder.time);
  if (!isValidDate(when) || when <= new Date()) return false;

  if (reminderJobs.has(reminder.id)) {
    try { reminderJobs.get(reminder.id).cancel(); } catch (_) {}
    reminderJobs.delete(reminder.id);
  }

  const job = scheduleLib.scheduleJob(when, async () => {
    const chatId = reminder.chatId || userId;
    await safeSendMessage(chatId, `⏰ Pengingat: ${reminder.message}`);

    const u = ensureUser(userId);
    u.reminders = (u.reminders || []).filter(r => r.id !== reminder.id);
    reminderJobs.delete(reminder.id);
    await persist();
  });

  if (job) reminderJobs.set(reminder.id, job);
  return !!job;
}

async function restoreAllReminders() {
  if (!scheduleLib) {
    console.warn('⚠️ node-schedule tidak terpasang, reminder tidak akan aktif.');
    return;
  }

  for (const job of reminderJobs.values()) {
    try { job.cancel(); } catch (_) {}
  }
  reminderJobs.clear();

  let changed = false;
  const now = new Date();

  for (const [userId, u] of Object.entries(userMemory)) {
    const reminders = Array.isArray(u.reminders) ? u.reminders : [];
    const keep = [];

    for (const r of reminders) {
      const when = new Date(r.time);
      if (isValidDate(when) && when > now) {
        scheduleReminderJob(userId, r);
        keep.push(r);
      } else {
        changed = true;
      }
    }

    u.reminders = keep;
  }

  if (changed) await persist();
}

// ==================== FITUR TAMBAHAN ====================
async function handleMood(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);
  cleanupStaleUserState(u);

  if (cmd === '/mood') {
    await safeSendMessage(chatId, 'Apa kabarmu hari ini? (senang/biasa/sedih/cemas/energik)', { reply_to_message_id: msg.message_id });
    u.awaitingMood = true;
    await persist();
    return true;
  }

  if (u.awaitingMood && !cmd) {
    const mood = String(msg.text || args || '').toLowerCase().trim();
    const valid = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];

    if (valid.includes(mood)) {
      u.mood = mood;
      u.lastMoodUpdate = nowMs();
      delete u.awaitingMood;
      await persist();
      await safeSendMessage(chatId, `Terima kasih! Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
    } else {
      await safeSendMessage(chatId, 'Pilihan: senang, biasa, sedih, cemas, energik.', { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

function parseReminderFromArgs(args) {
  const parts = cleanupSpaces(args).split(' ');
  if (parts.length < 3) return null;

  const dateStr = parts[0];
  const timeStr = parts[1];
  const message = parts.slice(2).join(' ').trim();

  return { dateStr, timeStr, message };
}

async function handleReminder(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);

  if (cmd === '/remind') {
    const data = parseReminderFromArgs(args);
    if (!data) {
      await safeSendMessage(chatId, 'Format: /remind YYYY-MM-DD HH:MM pesan', { reply_to_message_id: msg.message_id });
      return true;
    }

    const datetime = parseJakartaDateTime(data.dateStr, data.timeStr);
    if (!isValidDate(datetime) || datetime <= new Date()) {
      await safeSendMessage(chatId, 'Tanggal/waktu tidak valid atau sudah lewat.', { reply_to_message_id: msg.message_id });
      return true;
    }

    const reminderId = String(nowMs());
    const reminder = {
      id: reminderId,
      chatId,
      time: datetime.toISOString(),
      message: data.message
    };

    u.reminders.push(reminder);
    const scheduled = scheduleReminderJob(userId, reminder);
    await persist();

    if (!scheduled) {
      await safeSendMessage(chatId, '⚠️ Pengingat tersimpan, tetapi scheduler tidak aktif di server ini.', { reply_to_message_id: msg.message_id });
      return true;
    }

    await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${datetime.toString()}`, { reply_to_message_id: msg.message_id });
    return true;
  }

  return false;
}

async function handleTodo(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);

  if (cmd === '/todo') {
    const tasks = u.todos || [];
    if (tasks.length === 0) {
      await safeSendMessage(chatId, '📝 Daftar tugas kosong. Gunakan /add <tugas>', { reply_to_message_id: msg.message_id });
    } else {
      const list = tasks.map((t, i) => `${i + 1}. ${t.done ? '✅' : '❌'} ${t.text}`).join('\n');
      await sendChunkedMessage(chatId, `📋 To-Do List:\n${list}`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (cmd === '/add') {
    const taskText = args.trim();
    if (!taskText) {
      await safeSendMessage(chatId, 'Isi tugasnya dulu.', { reply_to_message_id: msg.message_id });
      return true;
    }

    u.todos.push({ text: taskText, done: false, createdAt: nowMs() });
    await persist();
    await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
    return true;
  }

  if (cmd === '/done') {
    const idx = parseInt(args, 10) - 1;
    if (!u.todos || Number.isNaN(idx) || idx < 0 || idx >= u.todos.length) {
      await safeSendMessage(chatId, 'Nomor tugas tidak valid.', { reply_to_message_id: msg.message_id });
    } else {
      u.todos[idx].done = true;
      await persist();
      await safeSendMessage(chatId, `✅ Tugas "${u.todos[idx].text}" selesai.`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (cmd === '/cleartodo') {
    u.todos = [];
    await persist();
    await safeSendMessage(chatId, '🗑️ Semua tugas dihapus.', { reply_to_message_id: msg.message_id });
    return true;
  }

  return false;
}

async function handleQuizPoll(chatId, cmd, args, msg) {
  if (cmd === '/quiz') {
    const question = args.trim();
    if (!question) {
      await safeSendMessage(chatId, 'Ketik pertanyaan kuisnya dulu.', { reply_to_message_id: msg.message_id });
      return true;
    }
    quizState[chatId] = { type: 'quiz', question, createdAt: nowMs() };
    await safeSendMessage(chatId, 'Kirim opsi jawaban (pisahkan dengan koma):', { reply_to_message_id: msg.message_id });
    return true;
  }

  if (cmd === '/poll') {
    const question = args.trim();
    if (!question) {
      await safeSendMessage(chatId, 'Ketik pertanyaan pollingnya dulu.', { reply_to_message_id: msg.message_id });
      return true;
    }
    quizState[chatId] = { type: 'poll', question, createdAt: nowMs() };
    await safeSendMessage(chatId, 'Kirim opsi polling (pisahkan dengan koma):', { reply_to_message_id: msg.message_id });
    return true;
  }

  // Jika sedang menunggu opsi dan user mengirim pesan biasa
  if (quizState[chatId] && !cmd) {
    const state = quizState[chatId];
    const options = String(msg.text || '').split(',').map(o => o.trim()).filter(Boolean);

    if (options.length < 2) {
      await safeSendMessage(chatId, 'Minimal 2 opsi.', { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }

    if (options.length > 10) {
      await safeSendMessage(chatId, 'Maksimal 10 opsi.', { reply_to_message_id: msg.message_id });
      delete quizState[chatId];
      return true;
    }

    await telegramPost('sendPoll', {
      chat_id: chatId,
      question: state.question,
      options,
      is_anonymous: false,
      ...(state.type === 'quiz' ? { type: 'quiz', correct_option_id: 0 } : {})
    });

    delete quizState[chatId];
    return true;
  }

  return false;
}

async function handleGroupManagement(chatId, cmd, args, msg) {
  if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') return false;

  if (cmd === '/kick' && msg.reply_to_message) {
    const userIdToKick = msg.reply_to_message.from.id;
    try {
      await telegramPost('banChatMember', {
        chat_id: chatId,
        user_id: userIdToKick
      });
      await safeSendMessage(chatId, `User ${msg.reply_to_message.from.first_name} dikeluarkan.`, { reply_to_message_id: msg.message_id });
    } catch (e) {
      await safeSendMessage(chatId, 'Gagal mengeluarkan user. Pastikan bot punya izin admin.', { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  if (cmd === '/pin' && msg.reply_to_message) {
    try {
      await telegramPost('pinChatMessage', {
        chat_id: chatId,
        message_id: msg.reply_to_message.message_id
      });
      await safeSendMessage(chatId, 'Pesan disematkan.', { reply_to_message_id: msg.message_id });
    } catch (e) {
      await safeSendMessage(chatId, 'Gagal pin pesan. Pastikan bot punya izin admin.', { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

async function handleImageEdit(chatId, cmd, args, msg) {
  if (cmd === '/resize' && msg.reply_to_message?.photo) {
    if (!sharpLib) {
      await safeSendMessage(chatId, 'Fitur resize belum aktif karena package sharp belum terpasang.', { reply_to_message_id: msg.message_id });
      return true;
    }

    const size = args.toLowerCase().split('x');
    if (size.length !== 2) {
      await safeSendMessage(chatId, 'Format: /resize widthxheight (balas foto)', { reply_to_message_id: msg.message_id });
      return true;
    }

    const width = parseInt(size[0], 10);
    const height = parseInt(size[1], 10);

    if (Number.isNaN(width) || Number.isNaN(height) || width < 1 || height < 1) {
      await safeSendMessage(chatId, 'Lebar/tinggi tidak valid.', { reply_to_message_id: msg.message_id });
      return true;
    }

    const fileId = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1].file_id;

    try {
      const fileInfo = await telegramPost('getFile', { file_id: fileId });
      const filePath = fileInfo.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

      const imageRes = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const resized = await sharpLib(imageRes.data)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      await sendPhotoBuffer(chatId, resized, `Resize ke ${width}x${height}`, msg.message_id);
    } catch (e) {
      console.error('Resize error:', e.message);
      await safeSendMessage(chatId, 'Gagal memproses gambar.', { reply_to_message_id: msg.message_id });
    }

    return true;
  }

  return false;
}

async function handleStickerHint(chatId, cmd, args, msg) {
  if (cmd === '/sticker' && msg.reply_to_message?.photo) {
    await safeSendMessage(
      chatId,
      'Untuk membuat stiker, gunakan @Stickers bot. Saya belum support pembuatan stiker otomatis.',
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }
  return false;
}

async function handleKnowledge(chatId, cmd, args, msg) {
  if (cmd === '/learn') {
    const content = args.trim();
    if (!content) {
      await safeSendMessage(chatId, 'Isi pengetahuan yang mau disimpan.', { reply_to_message_id: msg.message_id });
      return true;
    }

    knowledgeBase.push({ content, timestamp: nowMs() });
    if (knowledgeBase.length > 1000) knowledgeBase.shift();
    await persist();
    await safeSendMessage(chatId, '✅ Pengetahuan ditambahkan.', { reply_to_message_id: msg.message_id });
    return true;
  }

  if (cmd === '/askkb') {
    const query = args.trim().toLowerCase();
    if (!query) {
      await safeSendMessage(chatId, 'Tulis pertanyaannya.', { reply_to_message_id: msg.message_id });
      return true;
    }

    const relevant = knowledgeBase.filter(k => String(k.content || '').toLowerCase().includes(query));
    if (relevant.length === 0) {
      await safeSendMessage(chatId, 'Tidak ada informasi terkait.', { reply_to_message_id: msg.message_id });
    } else {
      const answer = relevant.slice(-3).map(k => `- ${k.content}`).join('\n\n');
      await sendChunkedMessage(chatId, `📚 Basis Pengetahuan:\n${answer}`, { reply_to_message_id: msg.message_id });
    }
    return true;
  }

  return false;
}

// ==================== NLP UNIVERSAL ====================
function heuristicIntent(userMessage) {
  const q = String(userMessage || '').toLowerCase().trim();

  if (!q) return { intent: 'NONE', params: {} };

  // Hitung
  if (q.includes('hitung') || /^[0-9\s()+\-*/%.]+$/.test(q)) {
    const expr = q.includes('hitung')
      ? q.replace(/.*hitung/i, '').trim()
      : q;

    const clean = expr.replace(/[^0-9+\-*/().%]/g, '');
    if (clean) return { intent: 'HITUNG', params: { expression: clean } };
  }

  // Tanggal
  if (q.includes('tanggal') && (q.includes('hari ini') || q.includes('sekarang') || q.includes('berapa'))) {
    return { intent: 'TANGGAL', params: {} };
  }

  // Jam
  if (q.includes('jam') || q.includes('waktu')) {
    let location = q
      .replace(/(jam|waktu|di|pukul|sekarang|berapa|di mana|dimana)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    location = location || 'jakarta';
    return { intent: 'JAM', params: { location } };
  }

  // Cuaca
  if (q.includes('cuaca') || q.includes('weather')) {
    let city = q
      .replace(/(cuaca|weather|di|kota|bagaimana|sekarang|bagaimanakah)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    city = city || 'jakarta';
    return { intent: 'CUACA', params: { city } };
  }

  // Lokasi
  if (q.includes('lokasi') || q.includes('alamat') || q.includes('dimana') || q.includes('di mana')) {
    let place = q
      .replace(/(cari|lokasi|alamat|dimana|di mana|tempat|tunjukkan|lihat|di|adalah)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (place) return { intent: 'LOKASI', params: { place } };
  }

  // Search
  const searchKw = ['cari', 'search', 'google', 'apa itu', 'informasi', 'berita'];
  if (searchKw.some(k => q.includes(k))) {
    let query = q;
    searchKw.forEach(k => { query = query.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '); });
    query = query.replace(/\s+/g, ' ').trim();
    if (query) return { intent: 'SEARCH', params: { query } };
  }

  // Gambar
  if (q.includes('gambar') || q.includes('buat image') || q.includes('buat gambar') || q.includes('image')) {
    let prompt = q
      .replace(/(buat gambar|gambar|buat image|image|gambar kan|render)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (prompt) return { intent: 'GAMBAR', params: { prompt } };
  }

  // Tugas
  if ((q.includes('tugas') || q.includes('todo')) && /(tambah|buat|catat|ingat|save)/.test(q)) {
    let task = q
      .replace(/(tambah tugas|buat tugas|catat tugas|ingatkan tugas|save tugas|tugas|todo|tambahkan|buat|catat|ingat|save)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (task) return { intent: 'TAMBAH_TUGAS', params: { task } };
  }

  // Mood
  if (q.includes('mood') || q.includes('suasana hati')) {
    for (const mood of ['senang', 'biasa', 'sedih', 'cemas', 'energik']) {
      if (q.includes(mood)) return { intent: 'TAMBAH_MOOD', params: { mood } };
    }
  }

  return null;
}

async function universalNLP(userMessage, userId) {
  const heuristic = heuristicIntent(userMessage);
  if (heuristic) return heuristic;

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
      'Kamu hanya boleh mengeluarkan JSON valid untuk klasifikasi intent.',
      prompt
    );

    const parsed = extractJsonObject(response);
    if (!parsed || !parsed.intent) return { intent: 'NONE', params: {} };

    const validIntents = [
      'TAMBAH_EVENT', 'TAMBAH_TUGAS', 'TAMBAH_PENGINGAT',
      'TAMBAH_MOOD', 'CUACA', 'SEARCH', 'HITUNG',
      'JAM', 'TANGGAL', 'GAMBAR', 'LOKASI', 'NONE'
    ];

    if (!validIntents.includes(parsed.intent)) return { intent: 'NONE', params: {} };
    return { intent: parsed.intent, params: parsed.params || {} };
  } catch (e) {
    console.error('NLP error:', e.message);
    return { intent: 'NONE', params: {} };
  }
}

async function saveNlpPattern(userId, originalQuestion, correctedIntent, correctedParams) {
  const u = ensureUser(userId);
  u.nlpPatterns.push({
    question: String(originalQuestion || '').toLowerCase(),
    intent: correctedIntent,
    params: correctedParams,
    timestamp: nowMs()
  });
  if (u.nlpPatterns.length > 100) u.nlpPatterns.shift();
  await persist();
}

async function askClarification(chatId, userId, originalText, msg) {
  await safeSendMessage(
    chatId,
    `🤔 Maaf, aku kurang paham dengan:\n"${originalText}"\n\nCoba tulis lebih jelas, misalnya:\n- Tambah event rapat besok jam 10\n- Tambah tugas beli susu\n- Cuaca di Bandung\n- Ingatkan saya besok jam 8\n- Hitung 25*4\n- Jam berapa di New York\n- Gambar kucing lucu`,
    { reply_to_message_id: msg.message_id }
  );

  const u = ensureUser(userId);
  u.awaitingClarification = originalText;
  u.awaitingClarificationAt = nowMs();
  await persist();
}

async function scheduleReminderFromParams(chatId, userId, message, timeValue, msg) {
  const u = ensureUser(userId);

  if (!message || !timeValue) {
    await safeSendMessage(chatId, '❌ Pesan atau waktu pengingat belum lengkap.', { reply_to_message_id: msg.message_id });
    return true;
  }

  const reminderDate = parseFlexibleDateTime(timeValue, '09:00');
  if (!isValidDate(reminderDate) || reminderDate <= new Date()) {
    await safeSendMessage(chatId, '❌ Waktu pengingat tidak valid.', { reply_to_message_id: msg.message_id });
    return true;
  }

  const reminderId = String(nowMs());
  const reminder = {
    id: reminderId,
    chatId,
    time: reminderDate.toISOString(),
    message
  };

  u.reminders.push(reminder);
  const scheduled = scheduleReminderJob(userId, reminder);
  await persist();

  if (!scheduled) {
    await safeSendMessage(chatId, '⚠️ Pengingat tersimpan, tetapi scheduler tidak aktif di server ini.', { reply_to_message_id: msg.message_id });
    return true;
  }

  await safeSendMessage(chatId, `✅ Pengingat dijadwalkan pada ${reminderDate.toString()}`, { reply_to_message_id: msg.message_id });
  return true;
}

async function executeUniversalIntent(intent, params, chatId, userId, msg) {
  const u = ensureUser(userId);

  switch (intent) {
    case 'TAMBAH_EVENT': {
      const summary = params.summary || 'Event';
      const startDate = params.startDate;
      const startTime = params.startTime || '09:00';
      const endDate = params.endDate || startDate;
      const endTime = params.endTime || '10:00';

      if (!startDate) {
        await safeSendMessage(chatId, '❌ Tanggal event belum jelas.', { reply_to_message_id: msg.message_id });
        return true;
      }

      const startDT = parseFlexibleDateTime(`${startDate} ${startTime}`, '09:00');
      const endDT = parseFlexibleDateTime(`${endDate || startDate} ${endTime}`, '10:00')
        || (startDT ? new Date(startDT.getTime() + 60 * 60 * 1000) : null);

      if (!isValidDate(startDT) || !isValidDate(endDT)) {
        await safeSendMessage(chatId, '❌ Format tanggal/waktu event tidak valid.', { reply_to_message_id: msg.message_id });
        return true;
      }

      const calendar = await getCalendarClient(userId);
      if (!calendar) {
        await safeSendMessage(chatId, '❌ Google Calendar belum terautentikasi. Gunakan /auth dulu.', { reply_to_message_id: msg.message_id });
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
        console.error('Calendar insert error:', err.response?.data || err.message);
        await safeSendMessage(chatId, '❌ Gagal menambahkan event. Periksa format tanggal.', { reply_to_message_id: msg.message_id });
      }

      return true;
    }

    case 'TAMBAH_TUGAS': {
      const taskText = params.task;
      if (!taskText) {
        await safeSendMessage(chatId, '❌ Tugasnya belum jelas.', { reply_to_message_id: msg.message_id });
        return true;
      }

      u.todos.push({ text: taskText, done: false, createdAt: nowMs() });
      await persist();
      await safeSendMessage(chatId, `✅ Tugas "${taskText}" ditambahkan.`, { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'TAMBAH_PENGINGAT': {
      return await scheduleReminderFromParams(chatId, userId, params.message, params.time, msg);
    }

    case 'TAMBAH_MOOD': {
      const mood = String(params.mood || '').toLowerCase();
      const validMoods = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];

      if (validMoods.includes(mood)) {
        u.mood = mood;
        u.lastMoodUpdate = nowMs();
        await persist();
        await safeSendMessage(chatId, `📝 Suasana hatimu "${mood}" tercatat.`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, 'Mood tidak dikenali. Pilihan: senang, biasa, sedih, cemas, energik.', { reply_to_message_id: msg.message_id });
      }
      return true;
    }

    case 'CUACA': {
      const weather = await getWeather(params.city || 'jakarta');
      await safeSendMessage(chatId, weather, { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'SEARCH': {
      const searchRes = await searchWebTavily(params.query || '');
      await sendChunkedMessage(chatId, searchRes, { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'HITUNG': {
      const calcRes = calculate(params.expression || '');
      await safeSendMessage(chatId, calcRes, { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'JAM': {
      const location = params.location || 'jakarta';
      const timeData = getTimeInZone(location);

      if (timeData) {
        await safeSendMessage(chatId, `🕒 Waktu di ${location}: ${timeData.time}`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, `❌ Lokasi "${location}" tidak dikenal. Coba Jakarta, Tokyo, New York, dll.`, { reply_to_message_id: msg.message_id });
      }
      return true;
    }

    case 'TANGGAL': {
      await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'GAMBAR': {
      const prompt = params.prompt;
      if (!prompt) {
        await safeSendMessage(chatId, '❌ Prompt gambar belum ada.', { reply_to_message_id: msg.message_id });
        return true;
      }

      await safeSendMessage(chatId, `🎨 Membuat gambar: ${prompt}...`, { reply_to_message_id: msg.message_id });
      const img = await generateImage(prompt);
      const ok = await sendPhotoUrl(chatId, img, `✨ ${prompt}`);
      if (!ok) await safeSendMessage(chatId, '❌ Gagal membuat gambar.', { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'LOKASI': {
      const place = params.place;
      if (!place) {
        await safeSendMessage(chatId, '❌ Nama lokasi belum ada.', { reply_to_message_id: msg.message_id });
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

// ==================== HELP ====================
async function handleHelp(chatId, msg) {
  const help = `/start - mulai
/help - bantuan
/stats - statistik
/rollback - hapus aturan terakhir
/feedback - log A/B
/image <deskripsi> - buat gambar
/hitung <expr> - kalkulator
/jam [lokasi]
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

// ==================== TOOLS ROUTER ====================
async function handleTools(msgText) {
  const low = String(msgText || '').toLowerCase();

  if (low.includes('tanggal') && (low.includes('berapa') || low.includes('hari ini') || low.includes('sekarang'))) {
    return getCurrentDate();
  }

  if (low.includes('jam') || low.includes('waktu')) {
    let q = low
      .replace(/(jam|waktu|di|pukul|berapa|sekarang|hari ini|hari\s+ini)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    q = q || 'jakarta';
    return getCurrentTime(q);
  }

  if ((low.includes('hitung') || low.match(/\d+[\+\-\*\/]\d+/)) && !low.includes('cuaca')) {
    const expr = String(msgText || '').replace(/[^0-9+\-*/().%]/g, '');
    if (expr) return calculate(expr);
  }

  if (low.includes('alamat') || low.includes('lokasi') || low.includes('dimana') || low.includes('di mana')) {
    const q = String(msgText || '')
      .replace(/alamat|lokasi|dimana|di mana|cari tempat|di|tempat/gi, '')
      .trim();
    return q ? await searchLocation(q) : 'Sebutkan tempat';
  }

  if (low.includes('cuaca')) {
    const city = String(msgText || '')
      .replace(/cuaca|weather|di|kota|bagaimana|sekarang/gi, '')
      .trim();
    return city ? await getWeather(city) : 'Contoh: cuaca Tokyo';
  }

  const searchKw = ['cari', 'search', 'google', 'apa itu', 'informasi', 'berita'];
  if (searchKw.some(k => low.includes(k))) {
    let q = String(msgText || '');
    searchKw.forEach(k => {
      q = q.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    });
    q = q.trim();
    return q ? await searchWebTavily(q) : 'Apa yang ingin dicari?';
  }

  return null;
}

// ==================== COMMAND HANDLER HELPERS ====================
function isUnknownCommand(cmd) {
  const known = new Set([
    '/start', '/help', '/stats', '/rollback', '/feedback', '/image', '/hitung',
    '/jam', '/tanggal', '/cuaca', '/lokasi', '/cari', '/setname', '/koreksi',
    '/mood', '/remind', '/todo', '/add', '/done', '/cleartodo', '/quiz', '/poll',
    '/kick', '/pin', '/resize', '/sticker', '/learn', '/askkb', '/auth', '/addevent'
  ]);
  return cmd && !known.has(cmd);
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

    await safeSendMessage(String(state), '✅ Autentikasi Google Calendar berhasil! Sekarang kamu bisa pakai /addevent.');
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
        await safeSendMessage(chatId, '👍 Terima kasih!');
      } else if (cb.data === 'negative') {
        await safeSendMessage(chatId, '👎 Gunakan /koreksi untuk mengajari saya.');
      }

      try {
        await telegramPost('answerCallbackQuery', { callback_query_id: cb.id });
      } catch (_) {}

      return res.sendStatus(200);
    }

    if (!update.message) return res.sendStatus(200);
    if (update.message.from?.is_bot) return res.sendStatus(200);
    if (update.message.edited_message) return res.sendStatus(200);

    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const text = String(msg.text || '').trim();
    const cmd = getCommandBase(text);
    const args = getCommandArgs(text);

    ensureUser(userId);
    const u = ensureUser(userId);
    cleanupStaleUserState(u);

    if (!text) {
      await safeSendMessage(chatId, 'Maaf, saya hanya bisa membaca pesan teks biasa saat ini.');
      return res.sendStatus(200);
    }

    // ===== COMMAND DASAR =====
    if (cmd === '/start') {
      const botName = ensureUser(userId).botName;
      await safeSendMessage(chatId, `🤖 Halo! Aku ${botName}. Ketik /help untuk semua perintah.`, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (cmd === '/help') {
      await handleHelp(chatId, msg);
      return res.sendStatus(200);
    }

    if (cmd === '/stats') {
      const mem = process.memoryUsage();
      const msgText = `Uptime: ${Math.floor(process.uptime() / 60)} menit
Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
Aturan: ${lessons.rules.length}
Histori chat: ${shortMemory.length}
Pengetahuan: ${knowledgeBase.length}
Reminder aktif: ${(u.reminders || []).length}`;
      await safeSendMessage(chatId, msgText, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (cmd === '/rollback') {
      if (lessons.rules.length) {
        lessons.rules.pop();
        await persist();
        await safeSendMessage(chatId, '🗑️ Aturan terakhir dihapus.', { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, 'Tidak ada aturan.', { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (cmd === '/feedback') {
      const last = abLog.slice(-5).map(l => `${l.style}: ${String(l.question || '').slice(0, 30)}...`).join('\n');
      await safeSendMessage(chatId, `Feedback terakhir:\n${last || 'Belum ada'}`, { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (cmd === '/image') {
      const prompt = args.trim();
      if (!prompt) {
        await safeSendMessage(chatId, 'Tulis deskripsi gambarnya dulu.', { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
      }
      const img = await generateImage(prompt);
      const ok = await sendPhotoUrl(chatId, img, `✨ ${prompt}`);
      if (!ok) await safeSendMessage(chatId, '❌ Gagal membuat gambar.', { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    // /koreksi Q | A
    if (cmd === '/koreksi') {
      const parts = args.split('|');
      if (parts.length < 2) {
        await safeSendMessage(chatId, 'Format: /koreksi pertanyaan | jawaban_benar', { reply_to_message_id: msg.message_id });
      } else {
        const trigger = parts[0].trim();
        const answer = parts.slice(1).join('|').trim();

        if (!answer || answer.length < 3) {
          await safeSendMessage(chatId, '❌ Jawaban terlalu pendek.', { reply_to_message_id: msg.message_id });
        } else {
          lessons.rules.push({ trigger, answer, source: 'user', timestamp: nowMs() });
          if (lessons.rules.length > 200) lessons.rules.shift();
          await persist();
          await safeSendMessage(chatId, '✅ Terima kasih, saya belajar.', { reply_to_message_id: msg.message_id });
        }
      }
      return res.sendStatus(200);
    }

    if (cmd === '/tanggal') {
      await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (cmd === '/setname') {
      const newName = args.trim();
      if (newName && newName.length < 50) {
        ensureUser(userId).botName = newName;
        await persist();
        await safeSendMessage(chatId, `✅ Namaku sekarang "${newName}".`, { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, '❌ Nama tidak valid.', { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (cmd === '/hitung') {
      if (!args) {
        await safeSendMessage(chatId, 'Contoh: /hitung 25*4', { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, calculate(args), { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (cmd === '/jam') {
      const location = args || 'jakarta';
      await safeSendMessage(chatId, getCurrentTime(location), { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    if (cmd === '/cuaca') {
      const city = args.trim();
      if (!city) {
        await safeSendMessage(chatId, 'Contoh: /cuaca Bandung', { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, await getWeather(city), { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (cmd === '/lokasi') {
      const place = args.trim();
      if (!place) {
        await safeSendMessage(chatId, 'Contoh: /lokasi Monas', { reply_to_message_id: msg.message_id });
      } else {
        await safeSendMessage(chatId, await searchLocation(place), { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    if (cmd === '/cari') {
      const query = args.trim();
      if (!query) {
        await safeSendMessage(chatId, 'Contoh: /cari sejarah Jakarta', { reply_to_message_id: msg.message_id });
      } else {
        await sendChunkedMessage(chatId, await searchWebTavily(query), { reply_to_message_id: msg.message_id });
      }
      return res.sendStatus(200);
    }

    // ===== FITUR TAMBAHAN =====
    if (await handleMood(chatId, userId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleReminder(chatId, userId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleTodo(chatId, userId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleQuizPoll(chatId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleGroupManagement(chatId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleImageEdit(chatId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleStickerHint(chatId, cmd, args, msg)) return res.sendStatus(200);
    if (await handleKnowledge(chatId, cmd, args, msg)) return res.sendStatus(200);

    // ===== GOOGLE CALENDAR =====
    if (cmd === '/auth') {
      if (msg.chat.type !== 'private') {
        await safeSendMessage(chatId, 'Untuk keamanan, gunakan /auth di chat pribadi dengan bot ini.');
        return res.sendStatus(200);
      }

      if (!googleLib || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        await safeSendMessage(chatId, '❌ Fitur Google Calendar belum dikonfigurasi atau package googleapis belum terpasang.');
        return res.sendStatus(200);
      }

      const authUrl = getAuthUrl(userId);
      if (!authUrl) {
        await safeSendMessage(chatId, '❌ Gagal membuat link autentikasi.');
        return res.sendStatus(200);
      }

      await safeSendMessage(chatId, `🔐 Klik tautan untuk autentikasi Google Calendar:\n${authUrl}\n\nSetelah login, kamu akan diarahkan kembali.`);
      return res.sendStatus(200);
    }

    if (cmd === '/addevent') {
      const calendar = await getCalendarClient(userId);
      if (!calendar) {
        await safeSendMessage(chatId, '❌ Belum autentikasi. Gunakan /auth dulu.', { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
      }

      const parts = args.split('|');
      if (parts.length < 3) {
        await safeSendMessage(chatId, 'Format: /addevent Judul | YYYY-MM-DD HH:MM | YYYY-MM-DD HH:MM', { reply_to_message_id: msg.message_id });
        return res.sendStatus(200);
      }

      const summary = parts[0].trim();
      const startStr = parts[1].trim();
      const endStr = parts[2].trim();

      const startDateTime = parseFlexibleDateTime(startStr, '09:00');
      const endDateTime = parseFlexibleDateTime(endStr, '10:00');

      if (!isValidDate(startDateTime) || !isValidDate(endDateTime)) {
        await safeSendMessage(chatId, 'Format tanggal/waktu salah.', { reply_to_message_id: msg.message_id });
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
        await safeSendMessage(chatId, '❌ Gagal menambahkan event.', { reply_to_message_id: msg.message_id });
      }

      return res.sendStatus(200);
    }

    // ===== UNKNOWN COMMAND =====
    if (isUnknownCommand(cmd)) {
      await safeSendMessage(chatId, 'Perintah tidak dikenal. Ketik /help untuk daftar perintah.', { reply_to_message_id: msg.message_id });
      return res.sendStatus(200);
    }

    // ===== TOOLS (fallback natural language) =====
    const toolRes = await handleTools(text);
    if (toolRes) {
      await sendChunkedMessage(chatId, toolRes, {
        reply_to_message_id: msg.message_id,
        disable_web_page_preview: true
      });
      return res.sendStatus(200);
    }

    // ===== NLP UNIVERSAL =====
    const nlpResult = await universalNLP(text, userId);

    if (nlpResult.intent && nlpResult.intent !== 'NONE') {
      const executed = await executeUniversalIntent(nlpResult.intent, nlpResult.params || {}, chatId, userId, msg);
      if (executed) return res.sendStatus(200);
    } else if (isLikelyActionRequest(text)) {
      await askClarification(chatId, userId, text, msg);
      return res.sendStatus(200);
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
      answer = '❌ AI sedang sibuk. Coba lagi nanti.';
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
          await persist();
        } catch (_) {}
      }
    }

    // Saran topik lanjutan
    if (u.msgCount % 5 === 0 && String(answer || '').length > 50 && !cmd) {
      try {
        const suggestions = await askAI(
          getSystemPrompt(userId),
          `Berdasarkan pertanyaan user:\n"${text}"\n\nDan jawaban:\n"${answer}"\n\nBeri 2 pertanyaan lanjutan singkat, format:\n1. ...\n2. ...`
        );

        if (suggestions && suggestions.length > 10 && !suggestions.toLowerCase().includes('tidak')) {
          await safeSendMessage(chatId, `💡 Topik lanjutan:\n${suggestions}`, { reply_to_message_id: msg.message_id });
        }
      } catch (_) {}
    }

    await persist();

    await sendChunkedMessage(chatId, answer, {
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [[
          { text: '👍', callback_data: 'positive' },
          { text: '👎', callback_data: 'negative' }
        ]]
      }
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.sendStatus(200);
  }
});

// ==================== ERROR HANDLER ====================
process.on('unhandledRejection', (err) => {
  console.error('UnhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UncaughtException:', err);
});

async function shutdown() {
  try {
    console.log('🛑 Shutdown...');
    await persist().catch(() => {});
    if (redisClient) {
      try { await redisClient.quit(); } catch (_) {}
    }
    if (server) {
      try {
        await new Promise(resolve => server.close(resolve));
      } catch (_) {}
    }
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ==================== START SERVER ====================
async function start() {
  await initRedis();
  await loadAllMemories();
  await restoreAllReminders();

  server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ Bot AI berjalan di port ${PORT}`);

    let host = RENDER_EXTERNAL_HOSTNAME;
    if (!host) host = 'telegrambotsaya.onrender.com';

    const url = `https://${host}/webhook/${TELEGRAM_TOKEN}`;
    console.log(`🔄 Mengatur webhook ke: ${url}`);

    try {
      const result = await axios.post(
        `${TELEGRAM_API}/setWebhook`,
        {
          url,
          drop_pending_updates: false,
          allowed_updates: ['message', 'callback_query']
        },
        { timeout: 20000 }
      );

      if (result.data.ok) console.log(`✅ Webhook berhasil diset: ${url}`);
      else console.error(`❌ Gagal set webhook: ${result.data.description}`);
    } catch (e) {
      console.error(`❌ Webhook error: ${e.message}`);
    }
  });
}

start();

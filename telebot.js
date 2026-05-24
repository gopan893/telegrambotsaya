import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Telegraf } from 'telegraf';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. HELPER FUNCTIONS (Di atas agar aman dari Hoisting Render)
// ==========================================
function resolveLocalPath(value) {
  if (path.isAbsolute(value)) return value;
  return path.join(__dirname, value);
}

function boolFromEnv(key, fallback) {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberFromEnv(key, fallback) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function mustGetAnyEnv(keys) {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }
  console.error(`Salah satu environment variable wajib diisi: ${keys.join(' atau ')}.`);
  process.exit(1);
}

// ==========================================
// 2. KONFIGURASI UTAMA & FALLBACK STRATEGY
// ==========================================
const config = {
  telegramToken: mustGetAnyEnv(['TELEGRAM_TOKEN', 'TELEGRAM_BOT_TOKEN']),
  primaryProvider: (process.env.AI_PROVIDER || 'mistral').toLowerCase(),
  
  // Mapping semua API Key dari .env Bos Alfan
  keys: {
    mistral: process.env.MISTRAL_API_KEY || '',
    huggingface: process.env.HUGGINGFACE_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || ''
  },
  
  // Mapping model default untuk masing-masing provider
  models: {
    mistral: process.env.MISTRAL_MODEL || 'mistral-large-latest',
    huggingface: process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct',
    deepseek: 'deepseek-chat',
    gemini: 'gemini-1.5-flash',
    groq: 'llama3-70b-8192',
    openai: 'gpt-4o-mini'
  },

  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 1800),
  autoMemory: boolFromEnv('AUTO_MEMORY', true),
  adminIds: new Set((process.env.OWNER_CHAT_ID || process.env.ADMIN_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)),
  rateLimitMessages: numberFromEnv('RATE_LIMIT_MESSAGES', 10),
  rateLimitWindowMs: numberFromEnv('RATE_LIMIT_WINDOW_SECONDS', 60) * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

// Logika Fallback Cerdas: Ambil provider utama, lalu sisa provider yang punya API key disusun jadi cadangan
const availableProviders = Object.keys(config.keys).filter(k => config.keys[k]);
const fallbackStrategy = [
  config.primaryProvider, 
  ...availableProviders.filter(p => p !== config.primaryProvider)
];

if (fallbackStrategy.length === 0) {
  console.error('TIDAK ADA API KEY YANG DITEMUKAN! Bot tidak bisa berjalan.');
  process.exit(1);
}

const MODES = {
  balanced: { label: 'Seimbang', instruction: 'Jawab dengan ringkas, jelas, dan langsung membantu. Ikuti bahasa yang dipakai user.' },
  coder: { label: 'Programmer', instruction: 'Bertindak sebagai senior engineer. Berikan solusi teknis yang rapi, aman, dan siap diterapkan. Sertakan kode.' },
  teacher: { label: 'Guru', instruction: 'Jelaskan bertahap dengan contoh sederhana. Pastikan user paham alasan di balik jawaban.' },
  business: { label: 'Bisnis', instruction: 'Fokus pada strategi, eksekusi, penjualan, efisiensi, risiko, dan prioritas yang menghasilkan dampak.' },
  creative: { label: 'Kreatif', instruction: 'Berikan ide yang segar, variatif, dan praktis. Tetap konkret dan bisa dijalankan.' },
  strict: { label: 'Tegas', instruction: 'Jawab sangat langsung, minim basa-basi, dan utamakan keputusan atau langkah berikutnya.' }
};

const SYSTEM_CORE = `
Kamu adalah AI asisten tingkat tinggi untuk pemilik bot Telegram ini (Alfan).
Prinsip utama:
- Bantu user menyelesaikan pekerjaan nyata, bukan hanya menjawab secara umum.
- Jika pertanyaan ambigu, ambil asumsi paling masuk akal dan jelaskan singkat.
- Simpan dan gunakan memori hanya untuk informasi berguna, lindungi privasi dengan ketat.
- Berikan prioritas pada efisiensi waktu, manajemen risiko, dan output terapan.
- Selalu balas dengan bahasa utama yang dipakai user di pesan terakhir (Otomatis mendeteksi Indonesia, Inggris, atau Jepang).
`.trim();

// ==========================================
// 3. INISIALISASI BOT & SERVER
// ==========================================
const bot = new Telegraf(config.telegramToken);
const rateLimiter = new Map();
let state = await loadState();

state.metrics.startedAt ||= new Date().toISOString();
await saveState();

bot.start(async (ctx) => {
  touchUser(ctx);
  await ctx.reply(`AI sudah aktif.\nMode utama: ${config.primaryProvider.toUpperCase()}\nFitur Fallback otomatis: AKTIF (${fallbackStrategy.length} penyedia siaga).\n\nKirim pesan untuk mulai.`);
});

bot.help(async (ctx) => {
  touchUser(ctx);
  await ctx.reply('Command:\n/mode - ubah persona\n/memory - tampilkan memori\n/memory_add [teks] - tambah memori manual\n/memory_clear - hapus memori\n/forget - reset konteks\n/stats - statistik admin');
});

bot.command('mode', async (ctx) => {
  touchUser(ctx);
  const userId = getUserId(ctx);
  const requested = getCommandPayload(ctx).trim().toLowerCase();

  if (!requested) {
    const current = getUserProfile(userId).mode || 'balanced';
    const lines = Object.entries(MODES).map(([key, mode]) => `${key === current ? '*' : '-'} ${key}: ${mode.label}`);
    await ctx.reply(`Mode saat ini: ${current}\n\n${lines.join('\n')}\n\nUbah dengan: /mode coder`);
    return;
  }
  if (!MODES[requested]) return ctx.reply(`Mode "${requested}" tidak tersedia.`);
  
  getUserProfile(userId).mode = requested;
  await saveState();
  await ctx.reply(`Mode AI diubah ke ${requested} (${MODES[requested].label}).`);
});

bot.command(['memory', 'memory_add', 'memory_clear', 'forget', 'stats'], async (ctx) => {
  touchUser(ctx);
  const cmd = ctx.message.text.split(' ')[0].substring(1);
  const userId = getUserId(ctx);
  
  if (cmd === 'memory') {
    const mems = getUserProfile(userId).memories;
    if (!mems.length) return ctx.reply('Belum ada memori.');
    return ctx.reply(`Memori kamu:\n${mems.map((m, i) => `${i + 1}. ${m.text}`).join('\n')}`);
  }
  
  if (cmd === 'memory_add') {
    const text = getCommandPayload(ctx).trim();
    if (!text) return ctx.reply('Kirim: /memory_add [teks memori]');
    addMemory(userId, text, 'manual');
    await saveState();
    return ctx.reply('Memori ditambahkan.');
  }
  
  if (cmd === 'memory_clear') {
    getUserProfile(userId).memories = [];
    await saveState();
    return ctx.reply('Memori dihapus.');
  }
  
  if (cmd === 'forget') {
    getChatState(getChatId(ctx)).recent = [];
    await saveState();
    return ctx.reply('Konteks chat direset.');
  }

  if (cmd === 'stats' && isAdmin(ctx)) {
    const uptime = Math.round((Date.now() - Date.parse(state.metrics.startedAt)) / 1000);
    return ctx.reply(`Stats:\n- User: ${Object.keys(state.users).length}\n- Pesan: ${state.metrics.messagesHandled}\n- Error: ${state.metrics.errors}\n- Urutan Fallback AI: ${fallbackStrategy.join(' > ')}\n- Uptime: ${formatDuration(uptime)}`);
  }
});

bot.on('text', async (ctx) => {
  touchUser(ctx);
  if (!allowRequest(ctx)) return ctx.reply('Terlalu cepat. Tunggu sebentar.');
  const messageText = extractMessageText(ctx);
  if (!messageText) return ctx.reply('Kirim teks.');

  const thinkingMsg = await ctx.reply('Sedang menganalisis...');

  try {
    const answer = await answerUser(ctx, messageText);
    await safeDeleteMessage(ctx, thinkingMsg.message_id);
    await replyLong(ctx, answer || 'Maaf, saya kesulitan mencari jawaban yang tepat.');
  } catch (error) {
    state.metrics.errors += 1;
    await saveState();
    console.error(error);
    await safeDeleteMessage(ctx, thinkingMsg.message_id);
    await ctx.reply('Sistem sedang padat dan semua jalur AI (Fallback) gagal. Mohon ulangi beberapa detik lagi.');
  }
});

bot.catch(async (error, ctx) => {
  state.metrics.errors += 1;
  await saveState();
  console.error('Bot error:', error);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Health check listening on port ${PORT}`);
});

await bot.launch();
console.log(`🔥 Bot aktif! Jalur prioritas AI: ${fallbackStrategy.join(' -> ')}`);

// ==========================================
// 4. UNIFIED AI PROVIDER ROUTER (CIRCUIT BREAKER)
// ==========================================
async function callAIProvider(providerName, messages, maxTokens) {
  const providerEndpoints = {
    mistral: { url: 'https://api.mistral.ai/v1/chat/completions', key: config.keys.mistral, model: config.models.mistral },
    huggingface: { url: `https://api-inference.huggingface.co/models/${config.models.huggingface}/v1/chat/completions`, key: config.keys.huggingface, model: config.models.huggingface },
    deepseek: { url: 'https://api.deepseek.com/chat/completions', key: config.keys.deepseek, model: config.models.deepseek },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: config.keys.gemini, model: config.models.gemini },
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: config.keys.groq, model: config.models.groq },
    openai: { url: 'https://api.openai.com/v1/chat/completions', key: config.keys.openai, model: config.models.openai }
  };

  const target = providerEndpoints[providerName];
  if (!target || !target.key) throw new Error(`Provider ${providerName} tidak memiliki API Key.`);

  const response = await fetch(target.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${target.key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: target.model,
      messages: messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`${providerName} HTTP ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ==========================================
// 5. CORE LOGIC
// ==========================================
async function answerUser(ctx, messageText) {
  const userId = getUserId(ctx);
  const chatId = getChatId(ctx);
  const profile = getUserProfile(userId);
  const chat = getChatState(chatId);
  const modeKey = profile.mode || 'balanced';
  const mode = MODES[modeKey] || MODES.balanced;
  const replyLanguage = detectReplyLanguage(messageText);
  const localKnowledge = await retrieveLocalKnowledge(messageText);

  const userInput = [
    `Mandatory reply language:\n${replyLanguage.instruction}`,
    `User message:\n${messageText}`,
    localKnowledge ? `\nRelevant local knowledge:\n${localKnowledge}` : '',
    chat.recent.length ? `\nRecent conversation summary:\n${formatRecent(chat.recent)}` : ''
  ].filter(Boolean).join('\n\n');

  const instructions = buildInstructions(profile, mode, replyLanguage);
  let answer = '';
  let lastError = null;
  let successfulProvider = '';

  // AUTOMATIC FALLBACK LOOP
  for (const provider of fallbackStrategy) {
    try {
      answer = await callAIProvider(provider, [
        { role: 'system', content: instructions },
        { role: 'user', content: userInput }
      ], config.maxOutputTokens);
      
      successfulProvider = provider;
      break; // Jika sukses, hentikan perulangan (jangan panggil provider lain)
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ [FALLBACK] Provider ${provider.toUpperCase()} gagal. Melompat ke provider selanjutnya...`);
    }
  }

  if (!answer) {
    throw lastError || new Error('Semua provider gagal.');
  }

  rememberRecent(chat, 'user', messageText);
  rememberRecent(chat, 'assistant', answer);
  state.metrics.messagesHandled += 1;

  if (config.autoMemory && messageText) {
    await maybeLearnMemory(userId, messageText, answer);
  }

  await saveState();
  return answer;
}

async function maybeLearnMemory(userId, userMessage, assistantAnswer) {
  if (userMessage.length < 12) return;
  const profile = getUserProfile(userId);
  const existing = profile.memories.map((m) => m.text).join('\n');
  const prompt = `Ekstrak preferensi/fakta jangka panjang user (hindari data rahasia/password). Balas array JSON. \nExisting:\n${existing||'-'}\nUser:${userMessage}\nAssistant:${assistantAnswer}`;

  let memoryText = '';
  for (const provider of fallbackStrategy) {
    try {
      memoryText = await callAIProvider(provider, [{ role: 'user', content: prompt }], 300);
      break; // Stop mencoba jika sukses
    } catch (e) { /* Silent fail */ }
  }

  try {
    const parsed = JSON.parse(stripCodeFence(memoryText || '[]'));
    if (Array.isArray(parsed)) parsed.forEach(item => typeof item === 'string' && item.trim() && addMemory(userId, item.trim(), 'auto'));
  } catch {}
}

function buildInstructions(profile, mode, replyLanguage) {
  const memoryLines = profile.memories.slice(-30).map((m) => `- ${m.text}`).join('\n');
  return [SYSTEM_CORE, `Mode aktif: ${mode.label}. ${mode.instruction}`, `Language rule: ${replyLanguage.instruction}`, memoryLines ? `Memori user:\n${memoryLines}` : 'Belum ada memori user.', 'Gunakan satu bahasa utama, jangan dicampur kecuali diminta.'].join('\n\n');
}

function detectReplyLanguage(text) {
  const val = String(text || '');
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(val)) return { code: 'ja', instruction: 'Japanese. Reply entirely in natural Japanese.' };
  if (/[a-z]/iu.test(val)) return { code: 'latin', instruction: 'Use the same Latin-script language used by the user (Indonesian, English, etc). Reply entirely in that language.' };
  return { code: 'auto', instruction: 'Reply entirely in the user message primary language.' };
}

// ==========================================
// 6. RAG & UTILS
// ==========================================
async function retrieveLocalKnowledge(query) {
  const files = await listKnowledgeFiles(config.knowledgeDir);
  if (!files.length || !query) return '';
  const queryTokens = tokenize(query);
  const scoredChunks = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    chunkText(raw, 1200).forEach(chunk => {
      const score = scoreChunk(queryTokens, chunk);
      if (score > 0) scoredChunks.push({ file: path.basename(file), score, chunk });
    });
  }

  return scoredChunks.sort((a, b) => b.score - a.score).slice(0, 5).map((item, i) => `[${i + 1}] ${item.file}\n${item.chunk}`).join('\n\n');
}

async function listKnowledgeFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await listKnowledgeFiles(fullPath));
      else if (/\.(txt|md|json)$/i.test(entry.name)) files.push(fullPath);
    }
    return files;
  } catch { return []; }
}

function scoreChunk(queryTokens, chunk) {
  const chunkTokens = new Set(tokenize(chunk));
  return queryTokens.reduce((score, token) => chunkTokens.has(token) ? score + (token.length > 5 ? 2 : 1) : score, 0);
}

function tokenize(text) { return String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(t => t.length >= 3); }
function chunkText(text, maxChars) {
  const paragraphs = String(text).split(/\n{2,}/);
  const chunks = [];
  let current = '';
  for (const p of paragraphs) {
    const next = current ? `${current}\n\n${p}` : p;
    if (next.length > maxChars && current) { chunks.push(current); current = p; } 
    else { current = next; }
  }
  if (current) chunks.push(current);
  return chunks;
}

function touchUser(ctx) {
  const userId = getUserId(ctx);
  const profile = getUserProfile(userId);
  profile.telegram = { id: userId, username: ctx.from?.username || null, firstName: ctx.from?.first_name || null, lastName: ctx.from?.last_name || null };
  profile.lastSeenAt = new Date().toISOString();
}

function getUserProfile(userId) {
  state.users[userId] ||= { mode: 'balanced', memories: [], createdAt: new Date().toISOString(), lastSeenAt: null, telegram: {} };
  return state.users[userId];
}

function getChatState(chatId) {
  state.chats[chatId] ||= { recent: [], createdAt: new Date().toISOString() };
  return state.chats[chatId];
}

function addMemory(userId, text, source) {
  const profile = getUserProfile(userId);
  const normalized = String(text).replace(/\s+/g, ' ').trim().slice(0, 240);
  if (!normalized || profile.memories.some(m => String(m.text).replace(/\s+/g, ' ').trim().slice(0, 240) === normalized)) return;
  profile.memories.push({ text: normalized, source, createdAt: new Date().toISOString() });
  if (profile.memories.length > 60) profile.memories = profile.memories.slice(-60);
}

function rememberRecent(chat, role, text) {
  chat.recent.push({ role, text: String(text || '').slice(0, 700), at: new Date().toISOString() });
  if (chat.recent.length > 16) chat.recent = chat.recent.slice(-16);
}
function formatRecent(recent) { return recent.slice(-8).map((item) => `${item.role}: ${item.text}`).join('\n'); }
function extractMessageText(ctx) { return (ctx.message.text || ctx.message.caption || '').trim(); }
function getCommandPayload(ctx) { return extractMessageText(ctx).replace(/^\/\w+(?:@\w+)?\s*/i, ''); }
function allowRequest(ctx) {
  const userId = getUserId(ctx), now = Date.now(), bucket = rateLimiter.get(userId) || [];
  const recent = bucket.filter((t) => now - t < config.rateLimitWindowMs);
  recent.push(now); rateLimiter.set(userId, recent);
  return recent.length <= config.rateLimitMessages;
}
function getUserId(ctx) { return String(ctx.from?.id || 'unknown'); }
function getChatId(ctx) { return String(ctx.chat?.id || 'unknown'); }
function isAdmin(ctx) { return config.adminIds.has(getUserId(ctx)); }

async function replyLong(ctx, text) {
  const chunks = [], max = 3900;
  let remaining = String(text);
  while (remaining.length > max) {
    const cutAt = Math.max(remaining.lastIndexOf('\n\n', max), remaining.lastIndexOf('\n', max), remaining.lastIndexOf('. ', max));
    const index = cutAt > 1000 ? cutAt + 1 : max;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }
  if (remaining) chunks.push(remaining);
  for (const chunk of chunks) {
    try { await ctx.reply(chunk, { parse_mode: 'Markdown' }); } 
    catch { await ctx.reply(chunk); }
  }
}
async function safeDeleteMessage(ctx, messageId) { try { await ctx.deleteMessage(messageId); } catch {} }

async function loadState() {
  try { return JSON.parse(await fs.readFile(config.dataFile, 'utf8')); } 
  catch { return { users: {}, chats: {}, metrics: { startedAt: null, messagesHandled: 0, errors: 0 } }; }
}
async function saveState() {
  await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
  await fs.writeFile(config.dataFile, JSON.stringify(state, null, 2));
}

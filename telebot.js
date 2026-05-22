import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  telegramToken: mustGetEnv('TELEGRAM_BOT_TOKEN'),
  openaiKey: mustGetEnv('OPENAI_API_KEY'),
  model: process.env.OPENAI_MODEL || 'gpt-5.2',
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'medium',
  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 1800),
  enableWebSearch: boolFromEnv('ENABLE_WEB_SEARCH', true),
  enableImageInput: boolFromEnv('ENABLE_IMAGE_INPUT', true),
  autoMemory: boolFromEnv('AUTO_MEMORY', true),
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
  adminIds: new Set((process.env.ADMIN_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)),
  rateLimitMessages: numberFromEnv('RATE_LIMIT_MESSAGES', 10),
  rateLimitWindowMs: numberFromEnv('RATE_LIMIT_WINDOW_SECONDS', 60) * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

const MODES = {
  balanced: {
    label: 'Seimbang',
    instruction: 'Jawab dengan ringkas, jelas, dan langsung membantu. Gunakan bahasa Indonesia natural kecuali user meminta bahasa lain.'
  },
  coder: {
    label: 'Programmer',
    instruction: 'Bertindak sebagai senior engineer. Berikan solusi teknis yang rapi, aman, dan siap diterapkan. Sertakan kode bila diperlukan.'
  },
  teacher: {
    label: 'Guru',
    instruction: 'Jelaskan bertahap dengan contoh sederhana. Pastikan user paham alasan di balik jawaban.'
  },
  business: {
    label: 'Bisnis',
    instruction: 'Fokus pada strategi, eksekusi, penjualan, efisiensi, risiko, dan prioritas yang menghasilkan dampak.'
  },
  creative: {
    label: 'Kreatif',
    instruction: 'Berikan ide yang segar, variatif, dan praktis. Tetap konkret dan bisa dijalankan.'
  },
  strict: {
    label: 'Tegas',
    instruction: 'Jawab sangat langsung, minim basa-basi, dan utamakan keputusan atau langkah berikutnya.'
  }
};

const SYSTEM_CORE = `
Kamu adalah AI asisten tingkat tinggi untuk pemilik bot Telegram ini.

Prinsip utama:
- Bantu user menyelesaikan pekerjaan nyata, bukan hanya menjawab secara umum.
- Jika pertanyaan ambigu, ambil asumsi paling masuk akal dan jelaskan singkat.
- Jangan mengarang fakta, harga, jadwal, atau data terbaru. Jika web search aktif, gunakan untuk hal yang berubah cepat.
- Simpan dan gunakan memori hanya untuk informasi yang berguna dan tidak sensitif.
- Jaga privasi. Jangan meminta token, password, OTP, atau data rahasia kecuali benar-benar diperlukan dan jelaskan risikonya.
- Untuk coding, berikan solusi lengkap, aman, dan mudah dipelihara.
- Untuk bisnis, berikan prioritas tindakan yang bisa langsung dieksekusi.
- Untuk percakapan santai, tetap hangat, manusiawi, dan tidak kaku.
`.trim();

const bot = new Telegraf(config.telegramToken);
const openai = new OpenAI({ apiKey: config.openaiKey });
const rateLimiter = new Map();
let state = await loadState();

state.metrics.startedAt ||= new Date().toISOString();
await saveState();

bot.start(async (ctx) => {
  touchUser(ctx);
  await ctx.reply([
    'AI sudah aktif.',
    '',
    'Command penting:',
    '/help - lihat fitur',
    '/mode - pilih gaya AI',
    '/memory - lihat memori',
    '/memory_add teks - tambah memori manual',
    '/forget - hapus konteks chat ini',
    '',
    'Langsung kirim pertanyaan, ide, foto, atau tugas yang mau dikerjakan.'
  ].join('\n'));
});

bot.help(async (ctx) => {
  touchUser(ctx);
  await ctx.reply([
    'Fitur AI:',
    '- Memori jangka panjang per user',
    '- Konteks percakapan berkelanjutan',
    '- Mode kerja: balanced, coder, teacher, business, creative, strict',
    '- Knowledge base lokal dari folder knowledge/',
    '- Web search opsional lewat OpenAI tools',
    '- Input gambar Telegram jika diaktifkan',
    '',
    'Command:',
    '/mode - lihat mode',
    '/mode coder - ubah mode',
    '/memory - tampilkan memori',
    '/memory_add saya suka jawaban singkat - tambah memori',
    '/memory_clear - hapus semua memori kamu',
    '/forget - reset konteks chat',
    '/stats - statistik bot khusus admin'
  ].join('\n'));
});

bot.command('mode', async (ctx) => {
  touchUser(ctx);
  const userId = getUserId(ctx);
  const requested = getCommandPayload(ctx).trim().toLowerCase();

  if (!requested) {
    const current = getUserProfile(userId).mode || 'balanced';
    const lines = Object.entries(MODES).map(([key, mode]) => {
      const marker = key === current ? '*' : '-';
      return `${marker} ${key}: ${mode.label}`;
    });
    await ctx.reply(`Mode saat ini: ${current}\n\n${lines.join('\n')}\n\nUbah dengan: /mode coder`);
    return;
  }

  if (!MODES[requested]) {
    await ctx.reply(`Mode "${requested}" tidak tersedia. Ketik /mode untuk melihat daftar mode.`);
    return;
  }

  getUserProfile(userId).mode = requested;
  await saveState();
  await ctx.reply(`Mode AI diubah ke ${requested} (${MODES[requested].label}).`);
});

bot.command('memory', async (ctx) => {
  touchUser(ctx);
  const profile = getUserProfile(getUserId(ctx));
  if (!profile.memories.length) {
    await ctx.reply('Belum ada memori tersimpan.');
    return;
  }

  const lines = profile.memories.map((memory, index) => `${index + 1}. ${memory.text}`);
  await ctx.reply(`Memori kamu:\n${lines.join('\n')}`);
});

bot.command('memory_add', async (ctx) => {
  touchUser(ctx);
  const text = getCommandPayload(ctx).trim();
  if (!text) {
    await ctx.reply('Kirim seperti ini: /memory_add saya suka jawaban singkat dan langsung');
    return;
  }

  addMemory(getUserId(ctx), text, 'manual');
  await saveState();
  await ctx.reply('Memori ditambahkan.');
});

bot.command('memory_clear', async (ctx) => {
  touchUser(ctx);
  getUserProfile(getUserId(ctx)).memories = [];
  await saveState();
  await ctx.reply('Memori kamu sudah dihapus.');
});

bot.command('forget', async (ctx) => {
  touchUser(ctx);
  const chat = getChatState(getChatId(ctx));
  chat.lastResponseId = null;
  chat.recent = [];
  await saveState();
  await ctx.reply('Konteks percakapan chat ini sudah direset.');
});

bot.command('stats', async (ctx) => {
  touchUser(ctx);
  if (!isAdmin(ctx)) {
    await ctx.reply('Command ini khusus admin.');
    return;
  }

  const uptimeSeconds = Math.round((Date.now() - Date.parse(state.metrics.startedAt)) / 1000);
  await ctx.reply([
    'Statistik bot:',
    `- User: ${Object.keys(state.users).length}`,
    `- Chat: ${Object.keys(state.chats).length}`,
    `- Pesan diproses: ${state.metrics.messagesHandled}`,
    `- Error: ${state.metrics.errors}`,
    `- Uptime: ${formatDuration(uptimeSeconds)}`
  ].join('\n'));
});

bot.on(['text', 'photo'], async (ctx) => {
  touchUser(ctx);

  if (!allowRequest(ctx)) {
    await ctx.reply('Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar lalu coba lagi.');
    return;
  }

  const messageText = extractMessageText(ctx);
  if (!messageText && !ctx.message.photo) {
    await ctx.reply('Kirim teks atau foto dengan caption supaya bisa saya bantu.');
    return;
  }

  const thinkingMessage = await ctx.reply('Sedang berpikir...');

  try {
    const answer = await answerUser(ctx, messageText);
    await safeDeleteMessage(ctx, thinkingMessage.message_id);
    await replyLong(ctx, answer || 'Saya belum mendapatkan jawaban yang cukup baik. Coba ulangi dengan detail sedikit lagi.');
  } catch (error) {
    state.metrics.errors += 1;
    await saveState();
    console.error(error);
    await safeDeleteMessage(ctx, thinkingMessage.message_id);
    await ctx.reply('Maaf, AI sedang gagal memproses pesan ini. Coba lagi sebentar lagi.');
  }
});

bot.on('voice', async (ctx) => {
  touchUser(ctx);
  await ctx.reply('Saya belum memproses voice note di versi ini. Kirim teksnya, nanti saya bantu sampai beres.');
});

bot.catch(async (error, ctx) => {
  state.metrics.errors += 1;
  await saveState();
  console.error('Bot error:', error);
  if (ctx) {
    await ctx.reply('Ada error internal. Saya sudah catat di log.');
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

await bot.launch();
console.log(`Telegram AI aktif dengan model ${config.model}`);

async function answerUser(ctx, messageText) {
  const userId = getUserId(ctx);
  const chatId = getChatId(ctx);
  const profile = getUserProfile(userId);
  const chat = getChatState(chatId);
  const modeKey = profile.mode || 'balanced';
  const mode = MODES[modeKey] || MODES.balanced;
  const localKnowledge = await retrieveLocalKnowledge(messageText);
  const imageContent = await buildImageContent(ctx);

  const userInput = [
    `Pesan user:\n${messageText || '[User mengirim gambar tanpa teks]'}`,
    localKnowledge ? `\nKnowledge base relevan:\n${localKnowledge}` : '',
    chat.recent.length ? `\nRingkasan pesan terakhir di chat ini:\n${formatRecent(chat.recent)}` : ''
  ].filter(Boolean).join('\n\n');

  const input = imageContent
    ? [{ role: 'user', content: [{ type: 'input_text', text: userInput }, ...imageContent] }]
    : userInput;

  const request = {
    model: config.model,
    instructions: buildInstructions(profile, mode),
    input,
    previous_response_id: chat.lastResponseId || undefined,
    tools: buildTools(),
    store: true,
    max_output_tokens: config.maxOutputTokens
  };

  if (config.reasoningEffort && config.reasoningEffort !== 'none') {
    request.reasoning = { effort: config.reasoningEffort };
  }

  const response = await openai.responses.create(request);
  const answer = response.output_text?.trim() || extractOutputText(response);

  chat.lastResponseId = response.id;
  rememberRecent(chat, 'user', messageText || '[gambar]');
  rememberRecent(chat, 'assistant', answer);
  state.metrics.messagesHandled += 1;

  if (config.autoMemory && messageText) {
    await maybeLearnMemory(userId, messageText, answer);
  }

  await saveState();
  return answer;
}

function buildInstructions(profile, mode) {
  const memoryLines = profile.memories
    .slice(-30)
    .map((memory) => `- ${memory.text}`)
    .join('\n');

  return [
    SYSTEM_CORE,
    `Mode aktif: ${mode.label}. ${mode.instruction}`,
    memoryLines ? `Memori user:\n${memoryLines}` : 'Belum ada memori user.',
    'Format jawaban: pakai bahasa yang natural, ringkas bila bisa, dan beri langkah konkret saat user meminta aksi.'
  ].join('\n\n');
}

function buildTools() {
  const tools = [];

  if (config.enableWebSearch) {
    tools.push({ type: 'web_search' });
  }

  if (config.vectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [config.vectorStoreId]
    });
  }

  return tools;
}

async function buildImageContent(ctx) {
  if (!config.enableImageInput || !ctx.message.photo?.length) {
    return null;
  }

  const largestPhoto = ctx.message.photo.at(-1);
  const link = await ctx.telegram.getFileLink(largestPhoto.file_id);
  return [{ type: 'input_image', image_url: link.href }];
}

async function maybeLearnMemory(userId, userMessage, assistantAnswer) {
  if (userMessage.length < 12) return;

  const profile = getUserProfile(userId);
  const existing = profile.memories.map((memory) => memory.text).join('\n');

  const prompt = `
Ambil hanya fakta preferensi atau informasi jangka panjang tentang user dari percakapan ini.
Jangan simpan rahasia, token, password, OTP, alamat lengkap, nomor kartu, atau data sangat sensitif.
Jika tidak ada yang layak disimpan, balas [].
Balas JSON array string saja, maksimal 3 item.

Memori yang sudah ada:
${existing || '-'}

User:
${userMessage}

Assistant:
${assistantAnswer}
`.trim();

  try {
    const response = await openai.responses.create({
      model: config.model,
      input: prompt,
      max_output_tokens: 300
    });

    const parsed = JSON.parse(stripCodeFence(response.output_text || '[]'));
    if (!Array.isArray(parsed)) return;

    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) {
        addMemory(userId, item.trim(), 'auto');
      }
    }
  } catch {
    // Memori otomatis hanya fitur tambahan. Jika gagal, jawaban utama tetap aman.
  }
}

async function retrieveLocalKnowledge(query) {
  const files = await listKnowledgeFiles(config.knowledgeDir);
  if (!files.length || !query) return '';

  const queryTokens = tokenize(query);
  const scoredChunks = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const chunks = chunkText(raw, 1200);
    for (const chunk of chunks) {
      const score = scoreChunk(queryTokens, chunk);
      if (score > 0) {
        scoredChunks.push({ file: path.basename(file), score, chunk });
      }
    }
  }

  return scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, index) => `[${index + 1}] ${item.file}\n${item.chunk}`)
    .join('\n\n');
}

async function listKnowledgeFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listKnowledgeFiles(fullPath));
      } else if (/\.(txt|md|json)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  } catch {
    return [];
  }
}

function scoreChunk(queryTokens, chunk) {
  const chunkTokens = new Set(tokenize(chunk));
  let score = 0;

  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += token.length > 5 ? 2 : 1;
  }

  return score;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function chunkText(text, maxChars) {
  const paragraphs = String(text).split(/\n{2,}/);
  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function touchUser(ctx) {
  const userId = getUserId(ctx);
  const profile = getUserProfile(userId);
  const from = ctx.from || {};

  profile.telegram = {
    id: userId,
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null
  };
  profile.lastSeenAt = new Date().toISOString();
}

function getUserProfile(userId) {
  state.users[userId] ||= {
    mode: 'balanced',
    memories: [],
    createdAt: new Date().toISOString(),
    lastSeenAt: null,
    telegram: {}
  };

  state.users[userId].memories ||= [];
  return state.users[userId];
}

function getChatState(chatId) {
  state.chats[chatId] ||= {
    lastResponseId: null,
    recent: [],
    createdAt: new Date().toISOString()
  };

  state.chats[chatId].recent ||= [];
  return state.chats[chatId];
}

function addMemory(userId, text, source) {
  const profile = getUserProfile(userId);
  const normalized = normalizeMemory(text);
  if (!normalized) return;

  const exists = profile.memories.some((memory) => normalizeMemory(memory.text) === normalized);
  if (exists) return;

  profile.memories.push({
    text: normalized,
    source,
    createdAt: new Date().toISOString()
  });

  if (profile.memories.length > 60) {
    profile.memories = profile.memories.slice(-60);
  }
}

function normalizeMemory(text) {
  return String(text).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function rememberRecent(chat, role, text) {
  chat.recent.push({
    role,
    text: String(text || '').slice(0, 700),
    at: new Date().toISOString()
  });

  if (chat.recent.length > 16) {
    chat.recent = chat.recent.slice(-16);
  }
}

function formatRecent(recent) {
  return recent
    .slice(-8)
    .map((item) => `${item.role}: ${item.text}`)
    .join('\n');
}

function extractMessageText(ctx) {
  return (ctx.message.text || ctx.message.caption || '').trim();
}

function getCommandPayload(ctx) {
  const text = extractMessageText(ctx);
  return text.replace(/^\/\w+(?:@\w+)?\s*/i, '');
}

function allowRequest(ctx) {
  const userId = getUserId(ctx);
  const now = Date.now();
  const bucket = rateLimiter.get(userId) || [];
  const recent = bucket.filter((timestamp) => now - timestamp < config.rateLimitWindowMs);
  recent.push(now);
  rateLimiter.set(userId, recent);
  return recent.length <= config.rateLimitMessages;
}

function getUserId(ctx) {
  return String(ctx.from?.id || 'unknown');
}

function getChatId(ctx) {
  return String(ctx.chat?.id || 'unknown');
}

function isAdmin(ctx) {
  return config.adminIds.has(getUserId(ctx));
}

async function replyLong(ctx, text) {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

function splitTelegramMessage(text) {
  const max = 3900;
  const chunks = [];
  let remaining = String(text);

  while (remaining.length > max) {
    const cutAt = Math.max(
      remaining.lastIndexOf('\n\n', max),
      remaining.lastIndexOf('\n', max),
      remaining.lastIndexOf('. ', max)
    );
    const index = cutAt > 1000 ? cutAt + 1 : max;
    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function safeDeleteMessage(ctx, messageId) {
  try {
    await ctx.deleteMessage(messageId);
  } catch {
    // Pesan mungkin sudah tidak bisa dihapus, abaikan.
  }
}

async function loadState() {
  try {
    const raw = await fs.readFile(config.dataFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      users: {},
      chats: {},
      metrics: {
        startedAt: null,
        messagesHandled: 0,
        errors: 0
      }
    };
  }
}

async function saveState() {
  await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
  await fs.writeFile(config.dataFile, JSON.stringify(state, null, 2));
}

function extractOutputText(response) {
  const parts = [];

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) {
        parts.push(content.text);
      }
    }
  }

  return parts.join('\n').trim();
}

function stripCodeFence(text) {
  return String(text)
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function formatDuration(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

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

function mustGetEnv(key) {
  const value = process.env[key];
  if (!value) {
    console.error(`Environment variable ${key} wajib diisi.`);
    process.exit(1);
  }
  return value;
}

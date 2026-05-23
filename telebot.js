import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import os from 'node:os';

// Third-party libraries
import OpenAI, { toFile } from 'openai';
import { Telegraf } from 'telegraf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. CONFIGURATION & ENVIRONMENT VALIDATION
// ==========================================
const config = {
  telegramToken: mustGetAnyEnv(['TELEGRAM_TOKEN', 'TELEGRAM_BOT_TOKEN']),
  aiProvider: (process.env.AI_PROVIDER || (process.env.MISTRAL_API_KEY ? 'mistral' : 'openai')).toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY || '',
  mistralKey: process.env.MISTRAL_API_KEY || '',
  huggingfaceKey: process.env.HUGGINGFACE_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o', // Diupgrade ke 4o untuk speed & vision
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  huggingfaceModel: process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct',
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'high',
  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 4000), // Ditingkatkan
  enableWebSearch: boolFromEnv('ENABLE_WEB_SEARCH', true),
  enableImageInput: boolFromEnv('ENABLE_IMAGE_INPUT', true),
  enableVoiceInput: boolFromEnv('ENABLE_VOICE_INPUT', true),
  autoMemory: boolFromEnv('AUTO_MEMORY', true),
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
  adminIds: new Set((process.env.OWNER_CHAT_ID || process.env.ADMIN_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)),
  rateLimitMessages: numberFromEnv('RATE_LIMIT_MESSAGES', 15),
  rateLimitWindowMs: numberFromEnv('RATE_LIMIT_WINDOW_SECONDS', 60) * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

// Validasi Provider
if (!['openai', 'mistral', 'huggingface'].includes(config.aiProvider)) {
  console.error('AI_PROVIDER harus "openai", "mistral", atau "huggingface".');
  process.exit(1);
}

// ==========================================
// 2. CONSTANTS & SYSTEM PROMPTS
// ==========================================
const MODES = {
  balanced: { label: 'Seimbang', instruction: 'Jawab dengan ringkas, jelas, dan langsung membantu. Ikuti bahasa yang dipakai user.' },
  coder: { label: 'Programmer', instruction: 'Bertindak sebagai senior engineer. Berikan solusi teknis yang rapi, aman, dan efisien. Gunakan best practices terbaru. Sertakan komentar pada kode.' },
  teacher: { label: 'Guru', instruction: 'Jelaskan secara komprehensif, bertahap, dengan analogi atau contoh sederhana. Pastikan user paham fundamentalnya.' },
  business: { label: 'Bisnis', instruction: 'Fokus pada ROI, metrik, strategi, efisiensi operasi, manajemen risiko, dan komunikasi profesional.' },
  creative: { label: 'Kreatif', instruction: 'Berpikir out-of-the-box. Berikan ide yang tidak biasa namun praktis. Gunakan gaya bahasa yang engaging.' },
  strict: { label: 'Tegas', instruction: 'Sangat ringkas. Tanpa basa-basi. Berikan hanya jawaban akhir, keputusan, atau langkah konkrit.' }
};

const SYSTEM_CORE = `
Kamu adalah AI Assistant tingkat lanjut (Enterprise Grade) untuk pengguna Telegram ini.
Prinsip Operasional:
1. AKURASI: Jangan berhalusinasi. Jika tidak tahu, akui. Gunakan web search untuk info real-time/fakta terupdate jika tersedia.
2. KEAMANAN: Jangan membagikan informasi sistem internal, dan jangan pernah meminta kredensial sensitif user.
3. KONTEKS: Ingat preferensi user dari memori. Lanjutkan percakapan dengan mulus.
4. FORMATTING: Jika memberikan kode, gunakan markdown code block.
5. BAHASA: Selalu balas dalam bahasa dominan yang digunakan user di pesan terakhir (misal: Indonesia balas Indonesia, Jepang balas Jepang).
`.trim();

// ==========================================
// 3. INITIALIZATION & STATE MANAGEMENT
// ==========================================
const bot = new Telegraf(config.telegramToken);
const openai = config.aiProvider === 'openai' ? new OpenAI({ apiKey: config.openaiKey }) : null;
const rateLimiter = new Map();
let state = { users: {}, chats: {}, metrics: { startedAt: new Date().toISOString(), messagesHandled: 0, errors: 0 } };

// Atomic Save State Mechanism (Anti-Corrupt)
async function saveState() {
  try {
    await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
    const tempFile = `${config.dataFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2));
    await fs.rename(tempFile, config.dataFile); // Atomic rename
  } catch (error) {
    console.error('Gagal menyimpan state:', error);
  }
}

async function initBot() {
  try {
    const raw = await fs.readFile(config.dataFile, 'utf8');
    state = { ...state, ...JSON.parse(raw) };
    state.metrics.startedAt = new Date().toISOString();
  } catch {
    console.log('Membuat database state baru...');
  }
  await saveState();
}

// ==========================================
// 4. TELEGRAM HANDLERS (COMMANDS)
// ==========================================
bot.start(async (ctx) => {
  touchUser(ctx);
  await ctx.reply(
    `🤖 *AI System Online*\n\n` +
    `Saya siap membantu. Kirim teks, foto, dokumen, atau Voice Note.\n\n` +
    `🛠 *Perintah:* \n` +
    `/help - Panduan lengkap\n` +
    `/mode - Ganti gaya respon\n` +
    `/forget - Reset percakapan\n` +
    `/memory - Lihat apa yang saya ingat`,
    { parse_mode: 'Markdown' }
  );
});

bot.help(async (ctx) => {
  touchUser(ctx);
  await ctx.reply(
    `*Kemampuan AI:*\n` +
    `• Mengingat preferensi Anda (Long-term Memory)\n` +
    `• Membaca Foto & Voice Note\n` +
    `• Mencari data dari dokumen lokal\n\n` +
    `*Command List:*\n` +
    `/mode - Cek mode saat ini\n` +
    `/mode <nama> - Ubah mode (coder, teacher, dll)\n` +
    `/memory - Lihat memori\n` +
    `/memory_add <teks> - Simpan ke memori\n` +
    `/memory_clear - Hapus semua memori\n` +
    `/forget - Bersihkan konteks obrolan saat ini\n` +
    (isAdmin(ctx) ? `/stats - Dashboard Server\n` : ''),
    { parse_mode: 'Markdown' }
  );
});

bot.command('mode', async (ctx) => {
  touchUser(ctx);
  const userId = getUserId(ctx);
  const requested = getCommandPayload(ctx).trim().toLowerCase();

  if (!requested) {
    const current = getUserProfile(userId).mode || 'balanced';
    const lines = Object.entries(MODES).map(([k, v]) => `${k === current ? '✅' : '➖'} *${k}*: ${v.label}`);
    return ctx.reply(`*Mode Saat Ini:* ${current}\n\n${lines.join('\n')}\n\n_Ubah dengan: /mode coder_`, { parse_mode: 'Markdown' });
  }

  if (!MODES[requested]) return ctx.reply(`❌ Mode "${requested}" tidak ditemukan.`);
  
  getUserProfile(userId).mode = requested;
  await saveState();
  await ctx.reply(`✅ Mode AI diubah ke: *${MODES[requested].label}*`, { parse_mode: 'Markdown' });
});

bot.command('forget', async (ctx) => {
  touchUser(ctx);
  const chat = getChatState(getChatId(ctx));
  chat.recent = [];
  chat.lastResponseId = null;
  await saveState();
  await ctx.reply('🧹 Konteks percakapan di ruang obrolan ini telah dibersihkan.');
});

bot.command(['memory', 'memory_add', 'memory_clear'], async (ctx) => {
  touchUser(ctx);
  const userId = getUserId(ctx);
  const profile = getUserProfile(userId);
  const cmd = ctx.message.text.split(' ')[0];

  if (cmd === '/memory') {
    if (!profile.memories.length) return ctx.reply('Belum ada memori tersimpan.');
    const lines = profile.memories.map((m, i) => `${i + 1}. ${m.text}`);
    return ctx.reply(`🧠 *Memori Anda:*\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  }
  
  if (cmd === '/memory_clear') {
    profile.memories = [];
    await saveState();
    return ctx.reply('🗑 Semua memori Anda telah dihapus.');
  }

  if (cmd === '/memory_add') {
    const text = getCommandPayload(ctx).trim();
    if (!text) return ctx.reply('Format: /memory_add [informasi yang ingin diingat]');
    addMemory(userId, text, 'manual');
    await saveState();
    return ctx.reply('✅ Memori ditambahkan ke database otak saya.');
  }
});

bot.command('stats', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const uptime = process.uptime();
  const ramMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const totalRam = Math.round(os.totalmem() / 1024 / 1024);
  
  await ctx.reply(
    `📊 *System Stats*\n` +
    `Bot Uptime: ${formatDuration(uptime)}\n` +
    `RAM Usage: ${ramMb} MB / ${totalRam} MB\n` +
    `Users: ${Object.keys(state.users).length}\n` +
    `Chats: ${Object.keys(state.chats).length}\n` +
    `Total Requests: ${state.metrics.messagesHandled}\n` +
    `Errors: ${state.metrics.errors}\n` +
    `Provider: ${config.aiProvider.toUpperCase()} (${getActiveModel()})`,
    { parse_mode: 'Markdown' }
  );
});

// ==========================================
// 5. CORE MESSAGE HANDLERS
// ==========================================
bot.on(['text', 'photo', 'voice', 'document'], async (ctx) => {
  touchUser(ctx);
  if (!allowRequest(ctx)) {
    return ctx.reply('⏳ Anda mengirim pesan terlalu cepat. Mohon tunggu beberapa detik.');
  }

  let messageText = extractMessageText(ctx);
  
  // UX: Start typing indicator
  let typingInterval = setInterval(() => ctx.sendChatAction('typing'), 4000);
  ctx.sendChatAction('typing').catch(()=>{}); // initial trigger
  
  const statusMsg = await ctx.reply('⏳ Memproses...').catch(()=>({message_id: null}));

  try {
    // 1. Handle Voice Note
    if (ctx.message.voice && config.enableVoiceInput && config.aiProvider === 'openai') {
      messageText = await processVoiceNote(ctx);
      if (!messageText) throw new Error("Gagal mentranskripsi audio.");
    } else if (ctx.message.voice) {
      throw new Error("Transkripsi suara hanya didukung jika AI_PROVIDER=openai.");
    }

    if (!messageText && !ctx.message.photo) {
      throw new Error('Mohon kirim teks, foto dengan caption, atau voice note.');
    }

    // 2. Generate Answer
    const answer = await answerUser(ctx, messageText);
    
    // 3. Send Response
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await replyLong(ctx, answer || 'Tidak ada respons dari AI.');

  } catch (error) {
    state.metrics.errors += 1;
    console.error('Handler Error:', error);
    await safeDeleteMessage(ctx, statusMsg.message_id);
    await ctx.reply(`❌ Terjadi kendala: ${error.message || 'Sistem sibuk'}`);
  } finally {
    clearInterval(typingInterval);
    await saveState();
  }
});

bot.catch(async (error, ctx) => {
  state.metrics.errors += 1;
  console.error('Global Bot Error:', error);
});

// ==========================================
// 6. AI & LOGIC FUNCTIONS
// ==========================================
async function answerUser(ctx, messageText) {
  const userId = getUserId(ctx);
  const chatId = getChatId(ctx);
  const profile = getUserProfile(userId);
  const chat = getChatState(chatId);
  const mode = MODES[profile.mode] || MODES.balanced;
  
  const localKnowledge = await retrieveLocalKnowledge(messageText);
  const imageContent = await buildImageContent(ctx);

  // Menyusun Prompt
  const promptParts = [];
  if (messageText) promptParts.push(`User message:\n${messageText}`);
  if (!messageText && imageContent) promptParts.push(`[User sent an image without text. Analyze it]`);
  if (localKnowledge) promptParts.push(`\nRelevant local database context:\n${localKnowledge}`);
  if (chat.recent.length) promptParts.push(`\nConversation history:\n${formatRecent(chat.recent)}`);

  const userInput = promptParts.join('\n\n');
  const inputPayload = imageContent
    ? [{ role: 'user', content: [{ type: 'text', text: userInput }, ...imageContent] }]
    : userInput;

  const instructions = buildInstructions(profile, mode, detectReplyLanguage(messageText));
  
  let answer = '';
  let responseId = null;

  // Execute with Retry Logic
  await withRetry(async () => {
    if (config.aiProvider === 'openai') {
      const request = {
        model: config.openaiModel,
        instructions,
        input: inputPayload,
        store: true,
        max_output_tokens: config.maxOutputTokens
      };
      if (config.enableWebSearch) request.tools = [{ type: 'web_search' }];
      if (chat.lastResponseId) request.previous_response_id = chat.lastResponseId;

      const response = await openai.responses.create(request);
      responseId = response.id;
      answer = response.output_text?.trim() || extractOutputText(response);
      
    } else if (config.aiProvider === 'mistral') {
      const res = await createMistralChatCompletion([{ role: 'system', content: instructions }, { role: 'user', content: userInput }]);
      answer = extractMistralText(res);
    } else {
      const res = await createHuggingFaceChatCompletion([{ role: 'system', content: instructions }, { role: 'user', content: userInput }]);
      answer = extractMistralText(res);
    }
  }, 3); // 3 Retries

  chat.lastResponseId = responseId;
  rememberRecent(chat, 'user', messageText || '[Gambar]');
  rememberRecent(chat, 'assistant', answer);
  state.metrics.messagesHandled += 1;

  if (config.autoMemory && messageText) {
    // Run memory extraction async without blocking response
    maybeLearnMemory(userId, messageText, answer).catch(() => {});
  }

  return answer;
}

async function processVoiceNote(ctx) {
  const fileId = ctx.message.voice.file_id;
  const link = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  const arrayBuffer = await response.arrayBuffer();
  
  // Whisper accepts ogg directly from Telegram
  const file = await toFile(Buffer.from(arrayBuffer), 'voice.ogg', { type: 'audio/ogg' });
  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
  });
  return transcription.text;
}

async function buildImageContent(ctx) {
  if (config.aiProvider !== 'openai' || !config.enableImageInput || !ctx.message.photo?.length) return null;
  const largestPhoto = ctx.message.photo.at(-1);
  const link = await ctx.telegram.getFileLink(largestPhoto.file_id);
  return [{ type: 'image_url', image_url: { url: link.href } }]; // Perbaikan format image OpenAI
}

function buildInstructions(profile, mode, replyLanguage) {
  const memoryLines = profile.memories.slice(-30).map((m) => `- ${m.text}`).join('\n');
  return [
    SYSTEM_CORE,
    `System Mode: ${mode.label}. ${mode.instruction}`,
    `Language Rule: ${replyLanguage.instruction}`,
    memoryLines ? `User Core Memories (Use implicitly):\n${memoryLines}` : '',
  ].filter(Boolean).join('\n\n');
}

// ==========================================
// 7. MEMORY & CONTEXT MANAGEMENT
// ==========================================
async function maybeLearnMemory(userId, userMessage, assistantAnswer) {
  if (userMessage.length < 15) return;
  const existing = getUserProfile(userId).memories.map(m => m.text).join('\n');
  const prompt = `Extract objective long-term facts/preferences about the user from this interaction. Exclude generic info or sensitive data (passwords). Output ONLY a JSON array of strings. Return [] if nothing worth saving.\n\nExisting:\n${existing||'-'}\n\nUser: ${userMessage}\nAssistant: ${assistantAnswer}`;
  
  const text = await generateText(prompt, 200);
  try {
    const parsed = JSON.parse(stripCodeFence(text || '[]'));
    if (Array.isArray(parsed)) {
      parsed.filter(i => typeof i === 'string' && i.trim()).forEach(i => addMemory(userId, i.trim(), 'auto'));
    }
  } catch {}
}

function addMemory(userId, text, source) {
  const profile = getUserProfile(userId);
  const normalized = String(text).replace(/\s+/g, ' ').trim().slice(0, 250);
  if (!normalized || profile.memories.some(m => m.text === normalized)) return;
  
  profile.memories.push({ text: normalized, source, createdAt: new Date().toISOString() });
  if (profile.memories.length > 50) profile.memories.shift();
}

function rememberRecent(chat, role, text) {
  chat.recent.push({ role, text: String(text || '').slice(0, 1000) });
  if (chat.recent.length > 20) chat.recent.shift(); // Increased context window
}

function formatRecent(recent) {
  return recent.map((item) => `${item.role}: ${item.text}`).join('\n');
}

// ==========================================
// 8. RAG (KNOWLEDGE BASE) - Upgraded Overlap
// ==========================================
async function retrieveLocalKnowledge(query) {
  const files = await listKnowledgeFiles(config.knowledgeDir);
  if (!files.length || !query) return '';
  const queryTokens = tokenize(query);
  const scoredChunks = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    // Overlapping chunks for better context retention
    const chunks = chunkTextWithOverlap(raw, 1000, 200); 
    for (const chunk of chunks) {
      const score = scoreChunk(queryTokens, chunk);
      if (score > 1) scoredChunks.push({ file: path.basename(file), score, chunk });
    }
  }
  return scoredChunks.sort((a, b) => b.score - a.score).slice(0, 3).map(i => `[Source: ${i.file}]\n${i.chunk}`).join('\n\n');
}

function chunkTextWithOverlap(text, size, overlap) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(' '));
  }
  return chunks;
}

function scoreChunk(queryTokens, chunk) {
  const chunkTokens = new Set(tokenize(chunk));
  return queryTokens.reduce((score, token) => score + (chunkTokens.has(token) ? (token.length > 4 ? 2 : 1) : 0), 0);
}

// ==========================================
// 9. API CALLS & UTILITIES
// ==========================================
async function generateText(prompt, maxTokens) {
  if (config.aiProvider === 'openai') {
    const res = await openai.chat.completions.create({ model: config.openaiModel, messages: [{role:'user', content:prompt}], max_tokens: maxTokens });
    return res.choices[0].message.content;
  }
  // Simplified for Mistral/HF
  return extractMistralText(await createMistralChatCompletion([{ role: 'user', content: prompt }], maxTokens));
}

async function createMistralChatCompletion(messages, maxTokens = config.maxOutputTokens) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${config.mistralKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.mistralModel, messages, max_tokens: maxTokens })
  });
  if (!res.ok) throw new Error(`Mistral Error: ${await res.text()}`);
  return res.json();
}

async function createHuggingFaceChatCompletion(messages, maxTokens = config.maxOutputTokens) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${config.huggingfaceModel}/v1/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${config.huggingfaceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.huggingfaceModel, messages, max_tokens: maxTokens })
  });
  if (!res.ok) throw new Error(`HuggingFace Error: ${await res.text()}`);
  return res.json();
}

async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i))); // Exponential backoff
    }
  }
}

// ==========================================
// 10. TELEGRAM MESSAGING & FORMATTING
// ==========================================
async function replyLong(ctx, text) {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    try {
      // Menggunakan Markdown klasik (lebih aman daripada MarkdownV2 jika AI lalai escape karakter)
      await ctx.reply(chunk, { parse_mode: 'Markdown' });
    } catch (e) {
      // Fallback drastis: Kirim plain text jika format markdown menyebabkan error Telegram API
      await ctx.reply(chunk);
    }
  }
}

function splitTelegramMessage(text) {
  const max = 4000;
  const chunks = [];
  let remaining = String(text);
  while (remaining.length > max) {
    let cutAt = remaining.lastIndexOf('\n\n', max);
    if (cutAt === -1) cutAt = remaining.lastIndexOf('\n', max);
    if (cutAt === -1) cutAt = remaining.lastIndexOf('. ', max);
    if (cutAt < 1000) cutAt = max;
    chunks.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// ==========================================
// 11. HELPER FUNCTIONS
// ==========================================
function touchUser(ctx) {
  const userId = getUserId(ctx);
  state.users[userId] ||= { mode: 'balanced', memories: [], createdAt: new Date().toISOString(), telegram: {} };
  state.users[userId].telegram = { id: userId, username: ctx.from?.username, firstName: ctx.from?.first_name };
  state.users[userId].lastSeenAt = new Date().toISOString();
}

function getUserProfile(userId) { return state.users[userId]; }
function getChatState(chatId) {
  state.chats[chatId] ||= { recent: [], lastResponseId: null, createdAt: new Date().toISOString() };
  return state.chats[chatId];
}
function getUserId(ctx) { return String(ctx.from?.id || 'unknown'); }
function getChatId(ctx) { return String(ctx.chat?.id || 'unknown'); }
function isAdmin(ctx) { return config.adminIds.has(getUserId(ctx)); }
function extractMessageText(ctx) { return (ctx.message?.text || ctx.message?.caption || '').trim(); }
function getCommandPayload(ctx) { return extractMessageText(ctx).replace(/^\/\w+(?:@\w+)?\s*/i, ''); }
async function safeDeleteMessage(ctx, msgId) { if(msgId) try{ await ctx.deleteMessage(msgId); } catch{} }
function tokenize(text) { return String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(t => t.length >= 3); }
function extractOutputText(res) { return res.output?.map(o => o.content?.map(c => c.text).join('')).join('\n') || ''; }
function extractMistralText(res) { return res.choices?.[0]?.message?.content || ''; }
function stripCodeFence(text) { return String(text).replace(/^`{3}\w*\n/i, '').replace(/`{3}$/i, '').trim(); }
function formatDuration(s) { return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h ${Math.floor((s%3600)/60)}m`; }
function resolveLocalPath(val) { return path.isAbsolute(val) ? val : path.join(__dirname, val); }
function numberFromEnv(k, f) { return Number.isFinite(Number(process.env[k])) ? Number(process.env[k]) : f; }
function boolFromEnv(k, f) { return process.env[k] !== undefined ? ['1','true','yes','on'].includes(process.env[k].toLowerCase()) : f; }
function mustGetAnyEnv(keys) {
  const found = keys.find(k => process.env[k]);
  if (!found) { console.error(`Missing ENV: ${keys.join(' / ')}`); process.exit(1); }
  return process.env[found];
}
function getActiveModel() { return config.aiProvider === 'openai' ? config.openaiModel : (config.aiProvider === 'mistral' ? config.mistralModel : config.huggingfaceModel); }
async function listKnowledgeFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await listKnowledgeFiles(full));
      else if (/\.(txt|md|json)$/i.test(entry.name)) files.push(full);
    }
    return files;
  } catch { return []; }
}
function detectReplyLanguage(text) {
  // Disimplifikasi dari versi lama, menggunakan RegEx deteksi yang lebih ringkas
  const val = String(text||'');
  if (/[\u3040-\u30ff\u4e00-\u9fff]/u.test(val)) return { code: 'ja', instruction: 'Japanese. Reply entirely in natural Japanese.' };
  if (/[\uac00-\ud7af]/u.test(val)) return { code: 'ko', instruction: 'Korean. Reply entirely in natural Korean.' };
  return { code: 'auto', instruction: 'Reply in the EXACT SAME language the user primarily used in their message. Do NOT mix languages.' };
}

function allowRequest(ctx) {
  const userId = getUserId(ctx), now = Date.now();
  const bucket = (rateLimiter.get(userId) || []).filter(t => now - t < config.rateLimitWindowMs);
  bucket.push(now);
  rateLimiter.set(userId, bucket);
  return bucket.length <= config.rateLimitMessages;
}

// ==========================================
// 12. SERVER & LAUNCH
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('AI Bot Active')).listen(PORT, () => console.log(`Health check on port ${PORT}`));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

await initBot();
await bot.launch();
console.log(`🚀 Bot Telegram (Pro Level) AKTIF dengan ${config.aiProvider.toUpperCase()} (${getActiveModel()})`);

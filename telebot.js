import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import http from 'node:http';

// FIX: Memaksa pencarian DNS ke IPv4 agar fetch ke API Hugging Face tidak gagal (ENOTFOUND) di Render.
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Konfigurasi sistem bot membaca Environment Variables (.env)
const config = {
  telegramToken: mustGetAnyEnv(['TELEGRAM_TOKEN', 'TELEGRAM_BOT_TOKEN']),
  aiProvider: (process.env.AI_PROVIDER || (process.env.MISTRAL_API_KEY ? 'mistral' : 'openai')).toLowerCase(),
  openaiKey: process.env.OPENAI_API_KEY || '',
  mistralKey: process.env.MISTRAL_API_KEY || '',
  huggingfaceKey: process.env.HUGGINGFACE_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  // FIX: Mengganti model default ke 7B agar tidak terjadi timeout/ditolak oleh server serverless Hugging Face
  huggingfaceModel: process.env.HUGGINGFACE_MODEL || 'Qwen/Qwen2.5-Coder-7B-Instruct',
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || 'medium',
  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 1800),
  enableWebSearch: boolFromEnv('ENABLE_WEB_SEARCH', true),
  enableImageInput: boolFromEnv('ENABLE_IMAGE_INPUT', true),
  autoMemory: boolFromEnv('AUTO_MEMORY', true),
  vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID || '',
  adminIds: new Set((process.env.OWNER_CHAT_ID || process.env.ADMIN_USER_IDS || '').split(',').map((x) => x.trim()).filter(Boolean)),
  rateLimitMessages: numberFromEnv('RATE_LIMIT_MESSAGES', 10),
  rateLimitWindowMs: numberFromEnv('RATE_LIMIT_WINDOW_SECONDS', 60) * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

// Validasi Provider AI yang dipilih
if (!['openai', 'mistral', 'huggingface'].includes(config.aiProvider)) {
  console.error('AI_PROVIDER harus diisi "openai", "mistral", atau "huggingface".');
  process.exit(1);
}

if (config.aiProvider === 'openai' && !config.openaiKey) {
  console.error('Environment variable OPENAI_API_KEY wajib diisi jika AI_PROVIDER=openai.');
  process.exit(1);
}

if (config.aiProvider === 'mistral' && !config.mistralKey) {
  console.error('Environment variable MISTRAL_API_KEY wajib diisi jika AI_PROVIDER=mistral.');
  process.exit(1);
}

if (config.aiProvider === 'huggingface' && !config.huggingfaceKey) {
  console.error('Environment variable HUGGINGFACE_API_KEY wajib diisi jika AI_PROVIDER=huggingface.');
  process.exit(1);
}

const MODES = {
  balanced: {
    label: 'Seimbang',
    instruction: 'Jawab dengan ringkas, jelas, dan langsung membantu. Ikuti bahasa yang dipakai user.'
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
- Selalu balas dengan bahasa utama yang dipakai user di pesan terakhir. Jika user memakai bahasa Jepang, balas bahasa Jepang. Jika user meminta bahasa tertentu, ikuti permintaan itu.
`.trim();

const bot = new Telegraf(config.telegramToken);
const openai = config.aiProvider === 'openai' ? new OpenAI({ apiKey: config.openaiKey }) : null;
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

// Health check server
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('OK')).listen(PORT, () => {
  console.log(`Health check listening on port ${PORT}`);
});

await bot.launch();
console.log(`Telegram AI aktif dengan ${config.aiProvider}:${getActiveModel()}`);

// Fungsi utama memproses pesan dari user ke AI
async function answerUser(ctx, messageText) {
  const userId = getUserId(ctx);
  const chatId = getChatId(ctx);
  const profile = getUserProfile(userId);
  const chat = getChatState(chatId);
  const modeKey = profile.mode || 'balanced';
  const mode = MODES[modeKey] || MODES.balanced;
  const replyLanguage = detectReplyLanguage(messageText);
  const localKnowledge = await retrieveLocalKnowledge(messageText);
  const imageContent = await buildImageContent(ctx);

  const userInput = [
    `Mandatory reply language:\n${replyLanguage.instruction}`,
    `User message:\n${messageText || '[User sent an image without text]'}`,
    localKnowledge ? `\nRelevant local knowledge:\n${localKnowledge}` : '',
    chat.recent.length ? `\nRecent conversation summary:\n${formatRecent(chat.recent)}` : ''
  ].filter(Boolean).join('\n\n');

  const input = imageContent
    ? [{ role: 'user', content: [{ type: 'input_text', text: userInput }, ...imageContent] }]
    : userInput;

  const instructions = buildInstructions(profile, mode, replyLanguage);
  let responseId = null;
  let answer = '';

  if (config.aiProvider === 'openai') {
    const request = {
      model: config.openaiModel,
      instructions,
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
    responseId = response.id;
    answer = response.output_text?.trim() || extractOutputText(response);
  } else if (config.aiProvider === 'huggingface') {
    // Alur penanganan khusus Hugging Face
    const response = await createHuggingFaceChatCompletion([
      { role: 'system', content: instructions },
      { role: 'user', content: userInput }
    ], config.maxOutputTokens);
    answer = extractMistralText(response);
  } else {
    // Alur penanganan Mistral
    const response = await createMistralChatCompletion([
      { role: 'system', content: instructions },
      { role: 'user', content: userInput }
    ], config.maxOutputTokens);
    answer = extractMistralText(response);
  }

  chat.lastResponseId = responseId;
  rememberRecent(chat, 'user', messageText || '[gambar]');
  rememberRecent(chat, 'assistant', answer);
  state.metrics.messagesHandled += 1;

  if (config.autoMemory && messageText) {
    await maybeLearnMemory(userId, messageText, answer);
  }

  await saveState();
  return answer;
}

function buildInstructions(profile, mode, replyLanguage) {
  const memoryLines = profile.memories
    .slice(-30)
    .map((memory) => `- ${memory.text}`)
    .join('\n');

  return [
    SYSTEM_CORE,
    `Mode aktif: ${mode.label}. ${mode.instruction}`,
    `Language rule for this response: ${replyLanguage.instruction}`,
    memoryLines ? `Memori user:\n${memoryLines}` : 'Belum ada memori user.',
    'Format jawaban: gunakan satu bahasa yang sama dengan pesan user. Jangan mencampur bahasa Indonesia, Inggris, atau bahasa lain kecuali user memintanya.'
  ].join('\n\n');
}

function detectReplyLanguage(text) {
  const value = String(text || '');
  const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/u.test(value);
  const hasHangul = /[\uac00-\ud7af]/u.test(value);
  const hasThai = /[\u0e00-\u0e7f]/u.test(value);
  const hasArabic = /[\u0600-\u06ff]/u.test(value);
  const hasCyrillic = /[\u0400-\u04ff]/u.test(value);
  const hasHebrew = /[\u0590-\u05ff]/u.test(value);
  const hasGreek = /[\u0370-\u03ff]/u.test(value);
  const hasDevanagari = /[\u0900-\u097f]/u.test(value);
  const hasBengali = /[\u0980-\u09ff]/u.test(value);
  const hasGurmukhi = /[\u0a00-\u0a7f]/u.test(value);
  const hasGujarati = /[\u0a80-\u0aff]/u.test(value);
  const hasTamil = /[\u0b80-\u0bff]/u.test(value);
  const hasTelugu = /[\u0c00-\u0c7f]/u.test(value);
  const hasKannada = /[\u0c80-\u0cff]/u.test(value);
  const hasMalayalam = /[\u0d00-\u0d7f]/u.test(value);
  const hasSinhala = /[\u0d80-\u0dff]/u.test(value);
  const hasLao = /[\u0e80-\u0eff]/u.test(value);
  const hasTibetan = /[\u0f00-\u0fff]/u.test(value);
  const hasMyanmar = /[\u1000-\u109f]/u.test(value);
  const hasGeorgian = /[\u10a0-\u10ff]/u.test(value);
  const hasEthiopic = /[\u1200-\u137f]/u.test(value);
  const hasKhmer = /[\u1780-\u17ff]/u.test(value);
  const hasLatin = /[a-z]/iu.test(value);

  const strictSameLanguage = 'Reply entirely in the user message primary language. Do not mix Indonesian, English, or any other language unless the user explicitly asks for translation, comparison, or mixed-language output.';

  if (hasJapanese) {
    return {
      code: 'ja',
      instruction: `Japanese. ${strictSameLanguage} Use natural Japanese only.`
    };
  }

  if (hasHangul) {
    return {
      code: 'ko',
      instruction: `Korean. ${strictSameLanguage} Use natural Korean only.`
    };
  }

  if (hasThai) {
    return {
      code: 'th',
      instruction: `Thai. ${strictSameLanguage} Use natural Thai only.`
    };
  }

  if (hasArabic) {
    return {
      code: 'ar',
      instruction: `Arabic. ${strictSameLanguage} Use natural Arabic only.`
    };
  }

  if (hasCyrillic) {
    return {
      code: 'cyrillic',
      instruction: `Use the same Cyrillic-script language used by the user. ${strictSameLanguage}`
    };
  }

  if (hasHebrew) {
    return {
      code: 'he',
      instruction: `Hebrew. ${strictSameLanguage} Use natural Hebrew only.`
    };
  }

  if (hasGreek) {
    return {
      code: 'el',
      instruction: `Greek. ${strictSameLanguage} Use natural Greek only.`
    };
  }

  if (hasDevanagari) {
    return {
      code: 'devanagari',
      instruction: `Use the same Devanagari-script language used by the user. ${strictSameLanguage}`
    };
  }

  if (hasBengali) {
    return {
      code: 'bengali',
      instruction: `Use the same Bengali-script language used by the user. ${strictSameLanguage}`
    };
  }

  if (hasGurmukhi) {
    return {
      code: 'gurmukhi',
      instruction: `Use the same Gurmukhi-script language used by the user. ${strictSameLanguage}`
    };
  }

  if (hasGujarati) {
    return {
      code: 'gujarati',
      instruction: `Gujarati. ${strictSameLanguage} Use natural Gujarati only.`
    };
  }

  if (hasTamil) {
    return {
      code: 'ta',
      instruction: `Tamil. ${strictSameLanguage} Use natural Tamil only.`
    };
  }

  if (hasTelugu) {
    return {
      code: 'te',
      instruction: `Telugu. ${strictSameLanguage} Use natural Telugu only.`
    };
  }

  if (hasKannada) {
    return {
      code: 'kn',
      instruction: `Kannada. ${strictSameLanguage} Use natural Kannada only.`
    };
  }

  if (hasMalayalam) {
    return {
      code: 'ml',
      instruction: `Malayalam. ${strictSameLanguage} Use natural Malayalam only.`
    };
  }

  if (hasSinhala) {
    return {
      code: 'si',
      instruction: `Sinhala. ${strictSameLanguage} Use natural Sinhala only.`
    };
  }

  if (hasLao) {
    return {
      code: 'lo',
      instruction: `Lao. ${strictSameLanguage} Use natural Lao only.`
    };
  }

  if (hasTibetan) {
    return {
      code: 'bo',
      instruction: `Tibetan. ${strictSameLanguage} Use natural Tibetan only.`
    };
  }

  if (hasMyanmar) {
    return {
      code: 'my',
      instruction: `Myanmar/Burmese. ${strictSameLanguage} Use natural Burmese only.`
    };
  }

  if (hasGeorgian) {
    return {
      code: 'ka',
      instruction: `Georgian. ${strictSameLanguage} Use natural Georgian only.`
    };
  }

  if (hasEthiopic) {
    return {
      code: 'ethiopic',
      instruction: `Use the same Ethiopic-script language used by the user. ${strictSameLanguage}`
    };
  }

  if (hasKhmer) {
    return {
      code: 'km',
      instruction: `Khmer. ${strictSameLanguage} Use natural Khmer only.`
    };
  }

  if (hasLatin) {
    return {
      code: 'latin',
      instruction: `Use the same Latin-script language used by the user, such as Indonesian, English, Malay, Spanish, French, German, Portuguese, Italian, Dutch, Turkish, Vietnamese, or another Latin-script language. ${strictSameLanguage}`
    };
  }

  return {
    code: 'auto',
    instruction: strictSameLanguage
  };
}

function buildTools() {
  const tools = [];

  if (config.aiProvider === 'openai' && config.enableWebSearch) {
    tools.push({ type: 'web_search' });
  }

  if (config.aiProvider === 'openai' && config.vectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [config.vectorStoreId]
    });
  }

  return tools;
}

async function buildImageContent(ctx) {
  if (config.aiProvider !== 'openai' || !config.enableImageInput || !ctx.message.photo?.length) {
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
    const text = await generateText(prompt, 300);
    const parsed = JSON.parse(stripCodeFence(text || '[]'));
    if (!Array.isArray(parsed)) return;

    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) {
        addMemory(userId, item.trim(), 'auto');
      }
    }
  } catch {
    // Gagal menyimpan memori tidak merusak alur chat utama
  }
}

// Fungsi generate text internal untuk manajemen memori
async function generateText(prompt, maxTokens) {
  if (config.aiProvider === 'openai') {
    const response = await openai.responses.create({
      model: config.openaiModel,
      input: prompt,
      max_output_tokens: maxTokens
    });

    return response.output_text || extractOutputText(response);
  }

  if (config.aiProvider === 'huggingface') {
    const response = await createHuggingFaceChatCompletion([
      { role: 'user', content: prompt }
    ], maxTokens);
    return extractMistralText(response);
  }

  const response = await createMistralChatCompletion([
    { role: 'user', content: prompt }
  ], maxTokens);

  return extractMistralText(response);
}

async function createMistralChatCompletion(messages, maxTokens) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.mistralKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.mistralModel,
      messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${body}`);
  }

  return response.json();
}

// Handler Request API untuk Hugging Face Serverless Inference
async function createHuggingFaceChatCompletion(messages, maxTokens) {
  const url = `https://api-inference.huggingface.co/models/${config.huggingfaceModel}/v1/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.huggingfaceKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.huggingfaceModel,
      messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Hugging Face API error ${response.status}: ${body}`);
  }

  return response.json();
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

// Fungsi pengiriman pesan panjang ke Telegram dengan parsing Markdown
async function replyLong(ctx, text) {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    try {
      // Mengirimkan pesan dengan interpretasi format Markdown
      await ctx.reply(chunk, { parse_mode: 'Markdown' });
    } catch (error) {
      // Fallback: kirim tanpa parsing jika AI menghasilkan Markdown cacat
      await ctx.reply(chunk);
    }
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
    // Abaikan jika pesan gagal dihapus
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

function extractMistralText(response) {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        return part?.text || '';
      })
      .join('')
      .trim();
  }

  return '';
}

// FIX: Menggunakan {3} pada regex agar tidak error saat di Render
function stripCodeFence(text) {
  return String(text)
    .trim()
    .replace(/^`{3}(?:json)?/i, '')
    .replace(/`{3}$/i, '')
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

function mustGetAnyEnv(keys) {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }

  console.error(`Salah satu environment variable wajib diisi: ${keys.join(' atau ')}.`);
  process.exit(1);
}

function getActiveModel() {
  if (config.aiProvider === 'openai') return config.openaiModel;
  if (config.aiProvider === 'huggingface') return config.huggingfaceModel;
  return config.mistralModel;
}

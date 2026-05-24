import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Telegraf } from 'telegraf';
import http from 'node:http';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 1. HELPER & CONFIG
// ==========================================
function resolveLocalPath(value) { return path.isAbsolute(value) ? value : path.join(__dirname, value); }
function boolFromEnv(key, fallback) { return process.env[key] !== undefined ? ['1', 'true', 'yes', 'on'].includes(process.env[key].toLowerCase()) : fallback; }
function numberFromEnv(key, fallback) { const v = Number(process.env[key]); return Number.isFinite(v) ? v : fallback; }
function mustGetAnyEnv(keys) {
  for (const k of keys) if (process.env[k]) return process.env[k];
  console.error(`Missing required ENV: ${keys.join(' or ')}`); process.exit(1);
}

const config = {
  telegramToken: mustGetAnyEnv(['TELEGRAM_TOKEN', 'TELEGRAM_BOT_TOKEN']),
  ownerChatId: process.env.OWNER_CHAT_ID || '',
  primaryProvider: (process.env.AI_PROVIDER || 'mistral').toLowerCase(),
  
  keys: {
    mistral: process.env.MISTRAL_API_KEY || '',
    huggingface: process.env.HUGGINGFACE_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || ''
  },
  
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
  rateLimitMessages: 20, // Dinaikkan untuk mendukung multi-turn function calling
  rateLimitWindowMs: 60 * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

const availableProviders = Object.keys(config.keys).filter(k => config.keys[k]);
const fallbackStrategy = [config.primaryProvider, ...availableProviders.filter(p => p !== config.primaryProvider)];

// ==========================================
// 2. SYSTEM CORE & PERSONAL CONTEXT (OSAKA, FINANCE)
// ==========================================
const SYSTEM_CORE = `
Kamu adalah Luxy, Autonomous AI Agent (Polymath) tingkat tinggi milik Bos Alfan.
Jika ada yang memanggilmu Luxy, JANGAN merespons perintah apapun sebelum mereka memberikan kode sandi (312004). Rahasiakan kode ini.
Jika sandi salah, suruh masukkan ulang tanpa memberi bocoran.

Konteks Permanen Bos Alfan:
- Lokasi saat ini: Osaka, Jepang.
- Tanggal Lahir: 31 Mei 2004.
- Pekerjaan: Jadwal permanen 44.25 jam per minggu. (Pernah 229 jam saat libur sekolah).
- Keuangan (Gaji): Normal 21-22 man/bulan.
- Pengeluaran Rutin: Sewa 5.4 man, Gas/Listrik 4500-5000 yen, Internet 3300 yen, Asuransi 1.2 man, Transportasi 1.4 man, Target makan 3.2 man (sekitar 3 juta IDR).
- Kewajiban Utama: Biaya sekolah 44 man dibayar setiap 6 bulan (jatuh tempo pada tanggal 23 di bulan Maret dan September) hingga 2028.
- Masalah Keamanan: Bos Alfan pernah didatangi orang mencurigakan yang menagih 15 juta IDR (dari 2021) dan memaksa meminta foto & tanda tangan. Selalu waspada jika ada laporan soal keamanan.

Prinsip:
- Bertindak seperti manusia jenius (Polymath), kritis, tidak selalu menyetujui jika ide Alfan kurang optimal. Beri referensi yang lebih baik.
- Evaluasi risiko keamanan, hukum Jepang, dan finansial secara presisi.
- Selalu adaptasi dengan bahasa yang dipakai user.
`.trim();

// ==========================================
// 3. TOOLS & FUNCTION CALLING DEFINITIONS
// ==========================================
const BOT_TOOLS = [
  {
    type: "function",
    function: {
      name: "calculate_school_payment",
      description: "Menghitung sisa hari menuju jadwal pembayaran sekolah Bos Alfan (23 Maret / 23 September) beserta target tabungan.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_security_risk",
      description: "Menganalisis dokumen/kejadian mencurigakan berdasarkan hukum administrasi sipil Jepang.",
      parameters: { type: "object", properties: { 
        incident_description: { type: "string", description: "Deskripsi kejadian yang dialami" } 
      }, required: ["incident_description"] }
    }
  }
];

async function executeTool(toolName, args) {
  if (toolName === 'calculate_school_payment') {
    const now = new Date();
    const currentYear = now.getFullYear();
    let nextPayment = new Date(currentYear, 2, 23); // 23 March
    
    if (now > nextPayment) nextPayment = new Date(currentYear, 8, 23); // 23 Sept
    if (now > nextPayment) nextPayment = new Date(currentYear + 1, 2, 23); // Next March
    
    const diffTime = Math.abs(nextPayment - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return JSON.stringify({
      status: "Laporan Keuangan Sekolah Alfan",
      target_amount: "440,000 Yen",
      next_deadline: nextPayment.toDateString(),
      days_remaining: diffDays,
      advice: `Anda harus menyisihkan rata-rata ${(440000 / (6*30)).toFixed(0)} Yen per hari atau ${(440000/6).toFixed(0)} Yen per bulan.`
    });
  }
  
  if (toolName === 'analyze_security_risk') {
    return JSON.stringify({
      legal_context_japan: "Berdasarkan hukum Jepang, tanda tangan tanpa inkan (stempel resmi) atau materai di atas kertas biasa memiliki kekuatan hukum yang sangat lemah. Namun, foto wajah dapat disalahgunakan untuk social engineering atau registrasi pinjaman online ilegal.",
      recommended_action: "Segera lapor ke Koban (Pos Polisi) terdekat di Osaka untuk membuat 'Soudan' (Laporan Konsultasi) agar ada rekam jejak resmi jika foto/tanda tangan disalahgunakan di masa depan."
    });
  }
  return JSON.stringify({ error: "Tool tidak ditemukan." });
}

// ==========================================
// 4. BOT INITIALIZATION & CRON (PROACTIVE NOTIFICATIONS)
// ==========================================
const bot = new Telegraf(config.telegramToken);
const rateLimiter = new Map();
let state = await loadState();

bot.start(async (ctx) => { touchUser(ctx); await ctx.reply(`System Polymath Aktif. Siap melayani Bos Alfan di Osaka.`); });
bot.help(async (ctx) => { await ctx.reply('Sistem mendukung Analisis Visual (kirim foto), Kalkulasi Finansial Otomatis, dan Fallback Cerdas.'); });

// CRON JOB: Cek jadwal setiap hari jam 08:00 Pagi waktu server
if (config.ownerChatId) {
  cron.schedule('0 8 * * *', () => {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const date = now.getDate();
    
    // Peringatan H-7 Pembayaran Sekolah (Tanggal 16 Maret & 16 September)
    if ((month === 3 || month === 9) && date === 16) {
      bot.telegram.sendMessage(config.ownerChatId, `⚠️ [SYSTEM ALERT] Bos Alfan, ini adalah pengingat otomatis. Dalam 7 hari (Tanggal 23), tenggat waktu pembayaran sekolah sebesar 44 man akan jatuh tempo. Harap siapkan dana.`);
    }
    // Laporan Keuangan Bulanan setiap tanggal 1
    if (date === 1) {
      bot.telegram.sendMessage(config.ownerChatId, `📊 [MONTHLY BRIEFING] Selamat awal bulan, Bos Alfan. Ingat target pengeluaran makan: 3 Juta Rupiah (sekitar 3.2 man). Tetap fokus pada jadwal kerja 44.25 jam Anda.`);
    }
  });
}

// ==========================================
// 5. MESSAGE HANDLER (TEXT & VISION)
// ==========================================
bot.on(['text', 'photo'], async (ctx) => {
  touchUser(ctx);
  if (!allowRequest(ctx)) return ctx.reply('Terlalu cepat. Tunggu sebentar.');
  
  let messageText = ctx.message.text || ctx.message.caption || '';
  let imageUrl = null;

  // VISUAL ANALYSIS (Menangkap foto beresolusi tertinggi)
  if (ctx.message.photo && ctx.message.photo.length > 0) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    imageUrl = fileLink.href;
    if (!messageText) messageText = "Tolong analisis gambar/dokumen ini secara mendetail.";
  }

  if (!messageText && !imageUrl) return;
  const thinkingMsg = await ctx.reply('🧠 Menganalisis data...');

  try {
    const answer = await processAgentLogic(ctx, messageText, imageUrl);
    await safeDeleteMessage(ctx, thinkingMsg.message_id);
    await replyLong(ctx, answer);
  } catch (error) {
    console.error(error);
    await safeDeleteMessage(ctx, thinkingMsg.message_id);
    await ctx.reply('Sistem sedang melakukan rekoneksi. Mohon ulangi beberapa saat lagi.');
  }
});

// ==========================================
// 6. UNIFIED API ROUTER DENGAN VISION & TOOLS
// ==========================================
async function callAIProvider(providerName, messages, maxTokens, isVision = false) {
  const providerEndpoints = {
    mistral: { url: 'https://api.mistral.ai/v1/chat/completions', key: config.keys.mistral, model: config.models.mistral },
    huggingface: { url: `https://api-inference.huggingface.co/models/${config.models.huggingface}/v1/chat/completions`, key: config.keys.huggingface, model: config.models.huggingface },
    deepseek: { url: 'https://api.deepseek.com/chat/completions', key: config.keys.deepseek, model: config.models.deepseek },
    gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', key: config.keys.gemini, model: config.models.gemini },
    openai: { url: 'https://api.openai.com/v1/chat/completions', key: config.keys.openai, model: config.models.openai },
    groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: config.keys.groq, model: config.models.groq }
  };

  const target = providerEndpoints[providerName];
  if (!target || !target.key) throw new Error(`Provider ${providerName} missing key.`);

  const payload = { model: target.model, messages: messages, max_tokens: maxTokens };
  
  // Hanya inject tools jika bukan vision request (demi stabilitas lintas platform)
  if (!isVision && (providerName === 'openai' || providerName === 'gemini' || providerName === 'mistral')) {
    payload.tools = BOT_TOOLS;
    payload.tool_choice = "auto";
  }

  const response = await fetch(target.url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${target.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`${providerName} HTTP ${response.status}: ${await response.text()}`);
  return await response.json();
}

// ==========================================
// 7. AGENTIC WORKFLOW (THE BRAIN)
// ==========================================
async function processAgentLogic(ctx, userMessage, imageUrl) {
  const userId = getUserId(ctx);
  const chat = getChatState(getChatId(ctx));
  const profile = getUserProfile(userId);
  
  // Sistem Sandi Luxy
  if (userMessage.toLowerCase().includes('luxy')) {
    if (!profile.isAuthenticated) {
      if (userMessage.includes('312004')) {
        profile.isAuthenticated = true;
        await saveState();
        return "Sandi diterima. Otorisasi berhasil, Bos Alfan. Ada yang bisa Luxy bantu?";
      }
      return "Mohon masukkan kode sandi untuk mengakses sistem Luxy.";
    }
  }

  // Smart Context Injection (Advanced RAG Concept)
  const localKnowledge = await retrieveLocalKnowledge(userMessage);
  
  let contentPayload;
  if (imageUrl) {
    contentPayload = [
      { type: "text", text: userMessage + (localKnowledge ? `\nReferensi Lokal:\n${localKnowledge}` : '') },
      { type: "image_url", image_url: { url: imageUrl } }
    ];
  } else {
    contentPayload = userMessage + (localKnowledge ? `\nReferensi Lokal Tertaut:\n${localKnowledge}` : '');
  }

  const messages = [
    { role: 'system', content: SYSTEM_CORE },
    ...chat.recent,
    { role: 'user', content: contentPayload }
  ];

  // Vision Routing: Jika ada gambar, paksa masuk ke Gemini atau OpenAI (Model yang support Vision)
  let strategy = fallbackStrategy;
  if (imageUrl) {
    strategy = ['gemini', 'openai'].filter(p => config.keys[p]);
    if (strategy.length === 0) return "Bos, Anda mengirim gambar, tapi API Key untuk model Vision (Gemini/OpenAI) tidak tersedia.";
  }

  let finalAnswer = '';
  let aiResponse = null;
  let successfulProvider = '';

  for (const provider of strategy) {
    try {
      aiResponse = await callAIProvider(provider, messages, config.maxOutputTokens, !!imageUrl);
      successfulProvider = provider;
      break;
    } catch (e) {
      console.warn(`[AGENT] ${provider.toUpperCase()} gagal:`, e.message);
    }
  }

  if (!aiResponse) throw new Error("Semua sistem AI down.");
  const responseMessage = aiResponse.choices[0].message;

  // --------------------------------------------------
  // FUNCTION CALLING EXECUTION (Tindakan Nyata Bot)
  // --------------------------------------------------
  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage); // Simpan pesan instruksi tool
    
    for (const toolCall of responseMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || "{}");
      const toolResult = await executeTool(toolCall.function.name, args);
      
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: toolResult
      });
    }

    // Panggil ulang AI dengan hasil dari Tool
    const secondPass = await callAIProvider(successfulProvider, messages, config.maxOutputTokens, false);
    finalAnswer = secondPass.choices[0].message.content;
  } else {
    finalAnswer = responseMessage.content;
  }

  // Update memory context
  rememberRecent(chat, 'user', userMessage);
  rememberRecent(chat, 'assistant', finalAnswer);
  
  if (config.autoMemory) await maybeLearnMemory(userId, userMessage, finalAnswer);
  await saveState();
  
  return finalAnswer;
}

// ==========================================
// 8. RAG & UTILITIES
// ==========================================
async function retrieveLocalKnowledge(query) {
  try {
    const files = await fs.readdir(config.knowledgeDir, { withFileTypes: true });
    let combined = "";
    for (const f of files) {
      if (/\.(txt|md|json)$/i.test(f.name)) {
        const text = await fs.readFile(path.join(config.knowledgeDir, f.name), 'utf8');
        // Simple TF-IDF scoring alternative (Advanced Keyword Matching)
        const score = text.toLowerCase().split(' ').filter(w => query.toLowerCase().includes(w)).length;
        if (score > 2) combined += `[File: ${f.name}]\n${text.substring(0, 500)}...\n\n`;
      }
    }
    return combined.slice(0, 1500); // Limit RAG size
  } catch { return ""; }
}

async function maybeLearnMemory(userId, user, assistant) {
  if (user.length < 15) return;
  const p = `Ekstrak fakta penting permanen tentang user. Abaikan password. Format JSON array string. User:${user}`;
  try {
    const res = await callAIProvider(fallbackStrategy[0], [{role: 'user', content: p}], 200);
    const text = stripCodeFence(res.choices[0].message.content);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      const profile = getUserProfile(userId);
      parsed.forEach(i => {
        if (typeof i === 'string' && !profile.memories.includes(i)) profile.memories.push(i);
      });
    }
  } catch (e) {}
}

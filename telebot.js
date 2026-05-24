import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Telegraf } from 'telegraf';
import http from 'node:http';
import cron from 'node-cron';

// ==========================================
// 1. EARLY PORT BINDING (TAKTIK ANTI-BUNUH RENDER)
// Dinyalakan paling pertama agar Render langsung mendeteksi aplikasi dalam status "Sehat"
// ==========================================
const PORT = process.env.PORT || 3000;
http.createServer((_, res) => res.end('Sistem Polymath Aktif')).listen(PORT, "0.0.0.0", () => {
  console.log(`[SERVER] 🌐 Web server berhasil diikat ke port ${PORT} secara instan.`);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// 2. HELPER & CONFIGURATION
// ==========================================
function resolveLocalPath(value) { return path.isAbsolute(value) ? value : path.join(__dirname, value); }
function boolFromEnv(key, fallback) { return process.env[key] !== undefined ? ['1', 'true', 'yes', 'on'].includes(process.env[key].toLowerCase()) : fallback; }
function numberFromEnv(key, fallback) { const v = Number(process.env[key]); return Number.isFinite(v) ? v : fallback; }

// Jika ENV kosong, kita ledakkan sistem dengan Error yang berisik agar tercatat di log Render!
function mustGetAnyEnv(keys) {
  for (const k of keys) {
    if (process.env[k]) return process.env[k];
  }
  throw new Error(`\n\n❌ [FATAL ERROR] Variabel Environment KOSONG: ${keys.join(' atau ')}!\nBos Alfan, pastikan Anda sudah memasukkan data ini di menu 'Environment' di dashboard Render!\n\n`);
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
  rateLimitMessages: 20, 
  rateLimitWindowMs: 60 * 1000,
  dataFile: resolveLocalPath(process.env.DATA_FILE || './data/state.json'),
  knowledgeDir: resolveLocalPath(process.env.KNOWLEDGE_DIR || './knowledge')
};

const availableProviders = Object.keys(config.keys).filter(k => config.keys[k]);
const fallbackStrategy = [config.primaryProvider, ...availableProviders.filter(p => p !== config.primaryProvider)];

let state; 
const rateLimiter = new Map();

// ==========================================
// 3. SYSTEM CORE & TOOLS DEFINITION
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

// ==========================================
// 4. UTILITIES & FUNCTIONS
// ==========================================
async function loadState() {
  try { return JSON.parse(await fs.readFile(config.dataFile, 'utf8')); }
  catch { return { users: {}, chats: {} }; }
}

async function saveState() {
  await fs.mkdir(path.dirname(config.dataFile), { recursive: true });
  await fs.writeFile(config.dataFile, JSON.stringify(state, null, 2));
}

function touchUser(ctx) {
  const profile = getUserProfile(getUserId(ctx));
  profile.lastSeenAt = new Date().toISOString();
}

function getUserProfile(id) { 
  state.users[id] ||= { memories: [], isAuthenticated: false }; 
  return state.users[id]; 
}

function getChatState(id) { 
  state.chats[id] ||= { recent: [] }; 
  return state.chats[id]; 
}

function getUserId(ctx) { return String(ctx.from?.id || 'unknown'); }
function getChatId(ctx) { return String(ctx.chat?.id || 'unknown'); }

function rememberRecent(chat, role, text) {
  chat.recent.push({ role, content: String(text).slice(0, 1000) });
  if (chat.recent.length > 10) chat.recent = chat.recent.slice(-10);
}

function allowRequest(ctx) {
  const bucket = rateLimiter.get(getUserId(ctx)) || [];
  const recent = bucket.filter(t => Date.now() - t < config.rateLimitWindowMs);
  recent.push(Date.now()); rateLimiter.set(getUserId(ctx), recent);
  return recent.length <= config.rateLimitMessages;
}


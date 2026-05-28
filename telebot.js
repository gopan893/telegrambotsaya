const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { readEnv, validateConfig } = require('./config/env');
const { createLogger } = require('./core/logger');
const { BoundedTTLMap } = require('./core/ttl-map');
const { KeyedQueue } = require('./core/keyed-queue');
const { CircuitBreaker } = require('./core/circuit-breaker');
const { withRetry } = require('./utils/retry');
const { readJsonFile, writeJsonFileAtomic } = require('./storage/json-store');
const { installProcessGuards } = require('./middleware/process-guards');
const { cleanupRuntimeState } = require('./scheduler/cleanup');
const { chooseProviderOrder, shouldUseSearchFallback } = require('./services/ai-router');
const { buildLearningGuide } = require('./handlers/learning');
const autonomousEngine = require('./src/core/autonomous-engine');
const agentLearning = require('./src/agents/learning');
const selfImprovementAgent = require('./src/agents/self-improvement');
const aiOS = require('./src/ai-os');
const opsSystem = require('./src/ops');
const { createStorageManager } = require('./src/storage');
const adaptiveSystem = require('./src/adaptive');
const collaborationSystem = require('./src/collaboration');
const multiDeviceUX = require('./src/ux/multi-device-response');
const humanAISafety = require('./src/ux/human-ai-safety');
const conversationManager = require('./src/conversation');
const interactions = require('./src/interactions');
const naturalLanguage = require('./src/natural-language/natural-router');
const {
  sendTelegramMessage,
  sendTelegramWithKeyboard
} = require('./src/utils/telegram-sender');


let scheduleLib = null;
let googleLib = null;
let sharpLib = null;
let FormDataLib = null;
let MistralClass = null;
let RedisClass = null;
let pdfParseLib = null;

try { scheduleLib = require('node-schedule'); } catch (_) {}
try { ({ google: googleLib } = require('googleapis')); } catch (_) {}
try { sharpLib = require('sharp'); } catch (_) {}
try { FormDataLib = require('form-data'); } catch (_) {}
try { ({ Mistral: MistralClass } = require('@mistralai/mistralai')); } catch (_) {}
try { RedisClass = require('ioredis'); } catch (_) {}
try { pdfParseLib = require('pdf-parse'); } catch (_) {}

const config = readEnv();

try {
  validateConfig(config);
} catch (err) {
  console.error(`❌ ${err.message}.`);
  process.exit(1);
}

const {
  TELEGRAM_TOKEN,
  MISTRAL_API_KEY,
  GROQ_API_KEY,
  TAVILY_API_KEY,
  OPENWEATHER_API_KEY,
  DATABASE_URL,
  STORAGE_DRIVER,
  REDIS_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  WEBHOOK_URL,
  TELEGRAM_WEBHOOK_URL,
  PORT = 10000,
  RENDER_EXTERNAL_HOSTNAME,
  OWNER_CHAT_ID = '',
  ADMIN_IDS = '',
  ADMIN_SET,
  TELEGRAM_API,
  WEBHOOK_BASE_URL,
  WEBHOOK_PATH
} = config;

const FILE_DIR = process.cwd();
const storageManager = createStorageManager({
  env: config,
  jsonBaseDir: FILE_DIR
});

const app = express();
app.use(express.json({ limit: '1mb' }));
const log = createLogger('telegram-ai');

let server = null;
let redisClient = null;

let shortMemory = [];
let lessons = { rules: [] };
let userMemory = {};
let abLog = [];
let knowledgeBase = [];
let chatHistory = [];
let quizState = {};

let botSettings = {
  modelPreference: 'auto',
  maxShortMemory: 80,
  maxKnowledge: 80,
  maxRules: 100,
  maxAbLog: 50,
  cooldownMs: 2000,
  maxMessagesPerMinute: 15
};

const reminderJobs = new Map();
const digestJobs = new Map();
const rateBuckets = new Map();
const aiCache = new BoundedTTLMap({ ttlMs: 2 * 60 * 1000, max: 250 });

const processedUpdates = new BoundedTTLMap({ ttlMs: 10 * 60 * 1000, max: 5000 });
const processedMessageKeys = new BoundedTTLMap({ ttlMs: 5 * 60 * 1000, max: 5000 });
const userActionQueue = new KeyedQueue({ idleTtlMs: 10 * 60 * 1000 });
const aiCircuitBreaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 45 * 1000 });

function rememberWithTTL(map, key, ttlMs) {
  if (!key) return false;
  if (typeof map.remember === 'function') {
    return map.remember(key, ttlMs);
  }
  const now = nowMs();
  const prev = map.get(key);
  if (prev && now - prev < ttlMs) return false;
  map.set(key, now);
  return true;
}

function cleanupMapTTL(map, ttlMs) {
  if (typeof map.cleanup === 'function') {
    map.cleanup(ttlMs);
    return;
  }
  const now = nowMs();
  for (const [key, ts] of map.entries()) {
    if (now - ts > ttlMs) map.delete(key);
  }
}

function getMessageKey(update) {
  const msg = update?.message || update?.edited_message;
  const chatId = msg?.chat?.id ?? update?.callback_query?.message?.chat?.id ?? '0';
  const msgId = msg?.message_id ?? update?.callback_query?.id ?? update?.update_id ?? nowMs();
  return `${chatId}:${msgId}`;
}

function isDuplicateIncomingUpdate(update) {
  const updateId = update?.update_id;
  if (updateId === undefined || updateId === null) return false;
  return !rememberWithTTL(processedUpdates, String(updateId), 10 * 60 * 1000);
}

async function withUserActionLock(userId, fn) {
  return userActionQueue.run(normalizeId(userId), fn);
}

function cleanupPatch4State() {
  cleanupMapTTL(processedUpdates, 10 * 60 * 1000);
  cleanupMapTTL(processedMessageKeys, 10 * 60 * 1000);
  userActionQueue.cleanup();
}

let pluginModules = [];
let pluginCommandMap = new Map();
let pluginMessageHooks = [];

const mistralClient =
  (MISTRAL_API_KEY && MistralClass)
    ? new MistralClass({ apiKey: MISTRAL_API_KEY })
    : null;

// =====================================================
// UTIL
// =====================================================

function nowMs() {
  return Date.now();
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d.getTime());
}

function safeLower(text) {
  return String(text || '').toLowerCase();
}

function normalizeId(id) {
  return String(id || '');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanupSpaces(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitText(text, maxLen = 3900) {
  const s = String(text || '');

  if (s.length <= maxLen) {
    return [s];
  }

  const chunks = [];
  let remaining = s;

  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);

    if (cut < 800) {
      cut = maxLen;
    }

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function getCommandBase(text) {
  const t = String(text || '').trim();

  if (!t.startsWith('/')) {
    return null;
  }

  const first = t.split(/\s+/)[0];

  return first.split('@')[0].toLowerCase();
}

function getCommandArgs(text) {
  const t = String(text || '').trim();

  if (!t.startsWith('/')) {
    return '';
  }

  const i = t.indexOf(' ');

  return i === -1
    ? ''
    : t.slice(i + 1).trim();
}

function stripCodeFences(text) {
  return String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
}

function extractJsonObject(text) {
  if (!text) {
    return null;
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function looksLikeIntentJSON(text) {
  const t = String(text || '');

  return (
    t.includes('"intent"') &&
    t.includes('"params"')
  );
}

function sanitizeOutgoingText(text) {
  const original = String(text || '').trim();
  let t = stripCodeFences(original);

  if (looksLikeIntentJSON(t)) {
    const parsed = extractJsonObject(t);

    if (parsed && parsed.intent) {
      return '';
    }
  }

  return multiDeviceUX.normalizeForTelegram(original);
}

function simpleDetectLanguage(text) {
  if (!text) {
    return 'id';
  }

  const s = String(text);

  if (/[ぁ-んァ-ヶ一-龯]/.test(s)) {
    return 'ja';
  }

  if (/[가-힣]/.test(s)) {
    return 'ko';
  }

  if (/[ăâđêôơư]/i.test(s)) {
    return 'vi';
  }

  return 'id';
}

function isAdmin(userId) {
  return (
    ADMIN_SET.size === 0 ||
    ADMIN_SET.has(normalizeId(userId))
  );
}

function getCacheKey(userId, text) {
  return `${normalizeId(userId)}:${safeLower(text).slice(0, 120)}`;
}

function calculate(expr) {
  try {
    const clean = String(expr)
      .replace(/[^0-9+\-*/().%\s]/g, '')
      .replace(/\s+/g, '');

    if (!clean || !/[0-9]/.test(clean)) {
      return 'Format salah';
    }

    if (/\*\*|\/{2,}/.test(clean)) {
      return 'Format matematika tidak aman';
    }

    const result = Function(
      `"use strict"; return (${clean})`
    )();

    return `Hasil: ${expr} = ${result}`;
  } catch {
    return 'Error hitung';
  }
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

function getTimeInZone(location) {
  const timezones = {
    jakarta: 'Asia/Jakarta',
    indonesia: 'Asia/Jakarta',
    jepang: 'Asia/Tokyo',
    tokyo: 'Asia/Tokyo',
    'new york': 'America/New_York',
    london: 'Europe/London',
    paris: 'Europe/Paris',
    dubai: 'Asia/Dubai',
    riyadh: 'Asia/Riyadh',
    mekkah: 'Asia/Riyadh',
    singapore: 'Asia/Singapore',
    'kuala lumpur': 'Asia/Kuala_Lumpur',
    bangkok: 'Asia/Bangkok',
    seoul: 'Asia/Seoul',
    beijing: 'Asia/Shanghai',
    sydney: 'Australia/Sydney',
    'los angeles': 'America/Los_Angeles',
    chicago: 'America/Chicago',
    moscow: 'Europe/Moscow',
    berlin: 'Europe/Berlin'
  };

  if (!location) {
    return null;
  }

  const q = String(location)
    .toLowerCase()
    .trim();

  let tz = timezones[q] || null;

  if (!tz) {
    for (const [key, value] of Object.entries(timezones)) {
      if (q.includes(key)) {
        tz = value;
        break;
      }
    }
  }

  if (!tz) {
    return null;
  }

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

  if (!res) {
    return `❌ Lokasi "${location}" tidak dikenal.`;
  }

  return `🕒 Waktu di ${location}: ${res.time}`;
}

function parseJakartaDateTime(dateStr, timeStr = '09:00') {
  if (!dateStr) {
    return null;
  }

  const date = String(dateStr).trim();
  const time = String(timeStr).trim();

  const normalizedTime =
    time.length === 5
      ? `${time}:00`
      : time;

  const dt = new Date(
    `${date}T${normalizedTime}+07:00`
  );

  return isValidDate(dt)
    ? dt
    : null;
}

function parseFlexibleDateTime(input, fallbackTime = '09:00') {
  if (!input) {
    return null;
  }

  const s = String(input).trim();

  if (s.includes('T')) {
    const d = new Date(s);

    return isValidDate(d)
      ? d
      : null;
  }

  const m = s.match(
    /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/
  );

  if (m) {
    return parseJakartaDateTime(
      m[1],
      m[2] || fallbackTime
    );
  }

  const d = new Date(s);

  return isValidDate(d)
    ? d
    : null;
}

function parseReminderFromArgs(args) {
  const parts = cleanupSpaces(args).split(' ');

  if (parts.length < 3) {
    return null;
  }

  return {
    dateStr: parts[0],
    timeStr: parts[1],
    message: parts.slice(2).join(' ').trim()
  };
}

function isLikelyActionRequest(text) {
  const q = safeLower(text);

  const kws = [
    'tambah',
    'buat',
    'jadwalkan',
    'ingatkan',
    'pengingat',
    'remind',
    'cuaca',
    'hitung',
    'jam',
    'waktu',
    'tanggal',
    'lokasi',
    'alamat',
    'cari',
    'search',
    'gambar',
    'image',
    'mood',
    'tugas',
    'todo',
    'event',
    'agenda',
    'poll',
    'quiz'
  ];

  return kws.some(k => q.includes(k));
}

function calcEntropyScore(text) {
  const s = String(text || '');

  return (
    new Set(s.split('')).size /
    Math.max(1, s.length)
  );
}

function rateLimit(userId) {
  const id = normalizeId(userId);
  const now = nowMs();

  const bucket =
    rateBuckets.get(id) || {
      hits: [],
      last: 0
    };

  bucket.hits = bucket.hits.filter(
    ts => now - ts < 60000
  );

  bucket.hits.push(now);

  rateBuckets.set(id, bucket);

  const tooFast =
    now - bucket.last <
    botSettings.cooldownMs;

  bucket.last = now;

  if (tooFast && bucket.hits.length > 3) {
    return { ok: false };
  }

  if (
    bucket.hits.length >
    botSettings.maxMessagesPerMinute
  ) {
    return { ok: false };
  }

  return { ok: true };
}

function pushChatHistory(entry) {
  chatHistory.push(entry);

  if (chatHistory.length > 400) {
    chatHistory.shift();
  }
}

function generateTagsFromText(text) {
  const q = safeLower(text);
  const tags = [];

  const tagRules = [
    [
      'coding',
      [
        'code',
        'kode',
        'bug',
        'error',
        'javascript',
        'node',
        'express',
        'telegram bot'
      ]
    ],
    [
      'game',
      [
        'game',
        'gaming',
        'minecraft',
        'roblox',
        'steam'
      ]
    ],
    [
      'kerja',
      [
        'kerja',
        'task',
        'tugas',
        'project',
        'deadline'
      ]
    ],
    [
      'ai',
      [
        'ai',
        'llm',
        'model',
        'prompt',
        'agent'
      ]
    ]
  ];

  for (const [tag, kws] of tagRules) {
    if (kws.some(k => q.includes(k))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function updateUserTags(u, text) {
  const tags = new Set(u.tags || []);

  for (const tag of generateTagsFromText(text)) {
    tags.add(tag);
  }

  u.tags = [...tags].slice(0, 20);
}

function scoreAnswerQuality(question, answer) {
  const q = safeLower(question);
  const a = safeLower(answer);

  let score = 0.45;

  if (a.length > 80) {
    score += 0.15;
  }

  if (a.length > 250) {
    score += 0.08;
  }

  if (
    a.includes('tidak tahu') ||
    a.includes('kurang yakin')
  ) {
    score -= 0.15;
  }

  if (
    a.includes('http://') ||
    a.includes('https://')
  ) {
    score += 0.08;
  }

  if (
    q &&
    a.includes(
      q.slice(0, Math.min(18, q.length))
    )
  ) {
    score += 0.05;
  }

  return Math.max(
    0,
    Math.min(1, score)
  );
}

function getModePrompt(mode) {
  const activeMode = safeLower(mode);

  if (activeMode === 'simple') {
    return 'Mode simple: jawab natural, ringkas, langsung ke inti, dan jangan mengaktifkan reasoning panjang jika tidak perlu.';
  }

  if (activeMode === 'coding') {
    return 'Mode coding: fokus penyebab, solusi, kode/patch bila perlu, dan langkah test singkat.';
  }

  if (activeMode === 'strategic') {
    return 'Mode strategic: jelaskan opsi, risiko, trade-off, prioritas, dan next action.';
  }

  if (activeMode === 'decision') {
    return 'Mode decision: bantu membingkai keputusan, bandingkan opsi, jelaskan kriteria, risiko, dan rekomendasi tanpa mengambil keputusan final.';
  }

  if (activeMode === 'reflection') {
    return 'Mode reflection: jawab empatik, bantu melihat pola, dan beri pertanyaan reflektif singkat.';
  }

  if (activeMode === 'ops') {
    return 'Mode ops: fokus root cause, diagnostics, health, langkah verifikasi, dan mitigasi aman.';
  }

  if (activeMode === 'health') {
    return 'Mode health: jawab empatik, beri saran umum ringan, sebutkan gejala serius yang perlu bantuan medis, jangan membuat diagnosis pasti, dan jangan mengaku dokter.';
  }

  if (activeMode === 'kerja' || activeMode === 'builder') {
    return 'Jawab profesional, ringkas, dan terstruktur.';
  }

  if (activeMode === 'belajar' || activeMode === 'learning') {
    return 'Fokus edukasi: jelaskan konsep, alasan, trade-off, risiko, dan langkah berpikir secara runtut.';
  }

  if (activeMode === 'kritis' || activeMode === 'critical') {
    return 'Fokus berpikir kritis: identifikasi asumsi, pro-kontra, risiko, kelemahan solusi, dan alternatif.';
  }

  if (activeMode === 'riset' || activeMode === 'research') {
    return 'Fokus riset: bedakan fakta, inferensi, dan opini; beri confidence level jika relevan.';
  }

  if (activeMode === 'refleksi' || activeMode === 'self-reflection') {
    return 'Fokus refleksi diri: evaluasi logika jawaban, confidence, kontradiksi, risiko, dan batas ketidakpastian.';
  }

  if (activeMode === 'deep' || activeMode === 'deep-analysis') {
    return 'Fokus analisis mendalam: bongkar asumsi, akar masalah, opsi, pro-kontra, trade-off, dan risiko.';
  }

  if (activeMode === 'mentor') {
    return 'Fokus mentor: bantu user belajar pola pikir, jelaskan kenapa, contoh, dan pertanyaan reflektif singkat.';
  }

  if (activeMode === 'optimasi' || activeMode === 'optimization') {
    return 'Fokus optimasi autonomous: cari bottleneck, efisiensi, reliability, metrik, dan rollback aman.';
  }

  if (activeMode === 'kolaborasi' || activeMode === 'collaborative') {
    return 'Fokus collaborative thinking: gunakan multi-perspective reasoning, evaluasi silang, consensus, dan sintesis akhir.';
  }

  if (activeMode === 'research-intelligence') {
    return 'Fokus research intelligence: validasi evidence, confidence, sumber, dan batas ketidakpastian.';
  }

  if (activeMode === 'mentor-intelligence') {
    return 'Fokus mentor intelligence: bantu belajar, jelaskan cara berpikir, dan latih critical thinking.';
  }

  if (activeMode === 'strategis' || activeMode === 'strategic-planning') {
    return 'Fokus strategic planning: pecah tujuan, susun workflow, prioritas, risiko, dan metrik sukses.';
  }

  if (activeMode === 'system-analysis' || activeMode === 'analisis-sistem') {
    return 'Fokus system analysis: evaluasi arsitektur, bottleneck, stability, observability, security, dan scalability.';
  }

  if (activeMode === 'document-analysis' || activeMode === 'dokumen') {
    return 'Fokus document analysis: baca file, ringkas isi, ambil poin penting, bedakan fakta/inferensi, dan jawab berbasis citation.';
  }

  if (activeMode === 'visual-analysis' || activeMode === 'visual' || activeMode === 'gambar') {
    return 'Fokus visual analysis: jelaskan elemen visual, batasan pembacaan gambar, dan jangan menebak detail yang tidak terlihat.';
  }

  if (activeMode === 'data-understanding' || activeMode === 'data' || activeMode === 'spreadsheet') {
    return 'Fokus data understanding: baca tabel, pola, nilai kosong, insight numerik, batasan sampling, dan risiko salah interpretasi.';
  }

  if (activeMode === 'cross-modal' || activeMode === 'cross-modal-reasoning' || activeMode === 'multimodal') {
    return 'Fokus cross-modal reasoning: gabungkan teks, file, gambar, dan data; cari konsistensi antar sumber dan jawab berbasis bukti.';
  }

  if (activeMode === 'research-file' || activeMode === 'riset-file') {
    return 'Fokus research file: validasi isi dokumen, ekstrak evidence, sebutkan source/citation, confidence, dan keterbatasan.';
  }

  if (activeMode === 'safe-mode' || activeMode === 'safe' || activeMode === 'aman') {
    return 'Fokus Safe Mode: minimalkan aksi otomatis, validasi tinggi, dan prioritaskan jawaban aman.';
  }

  if (activeMode === 'governance-review' || activeMode === 'governance') {
    return 'Fokus Governance Review: evaluasi policy, permission, risk, evidence, dan alasan keputusan AI.';
  }

  if (activeMode === 'controlled-agent' || activeMode === 'controlled') {
    return 'Fokus Controlled Agent: autonomous behavior terbatas, strict policy enforcement, dan konfirmasi untuk aksi sensitif.';
  }

  if (activeMode === 'explainability' || activeMode === 'explain') {
    return 'Fokus Explainability: jelaskan alasan keputusan, risiko, confidence, trade-off, dan konsekuensi.';
  }

  if (activeMode === 'recovery' || activeMode === 'recovery-mode') {
    return 'Fokus Recovery: rollback, incident handling, pemulihan aman, dan verifikasi setelah recovery.';
  }

  if (activeMode === 'strategic-thinking') {
    return 'Fokus AI OS strategic thinking: tujuan jangka panjang, roadmap, trade-off, risiko, evidence, dan next action.';
  }

  if (activeMode === 'personal-intelligence') {
    return 'Fokus AI OS personal intelligence: gunakan memory tersimpan secara hati-hati untuk memahami pola belajar, project aktif, dan preferensi user.';
  }

  if (activeMode === 'deep-research-os') {
    return 'Fokus AI OS research: evidence synthesis, confidence analysis, gap informasi, dan research continuity.';
  }

  if (activeMode === 'cognitive-workspace') {
    return 'Fokus AI OS cognitive workspace: organisasi ide, hubungan konsep, catatan project, workflow, dan knowledge graph.';
  }

  if (activeMode === 'meta-reasoning') {
    return 'Fokus AI OS meta reasoning: evaluasi strategi berpikir, asumsi, kualitas insight, dan alasan memilih pendekatan.';
  }

  if (activeMode === 'health-watch') {
    return 'Fokus AI Operations health-watch: pantau stabilitas, health, latency, error, queue, provider, dan risiko Render free tier.';
  }

  if (activeMode === 'benchmark') {
    return 'Fokus AI Operations benchmark: ukur kualitas, regression risk, latency, safety, dan bandingkan hasil secara ringkas.';
  }

  if (activeMode === 'incident-response') {
    return 'Fokus incident response: klasifikasikan masalah, cari root cause, beri recovery plan aman, dan hindari aksi destruktif.';
  }

  if (activeMode === 'cost-optimization') {
    return 'Fokus cost optimization: hemat token, cache, context compression, latency, RAM, dan trade-off kualitas vs efisiensi.';
  }

  if (activeMode === 'continuous-improvement') {
    return 'Fokus continuous improvement: evaluasi telemetry, benchmark, lesson operasional, tuning, dan pencegahan regresi.';
  }

  if (activeMode === 'learning-mentor') {
    return 'Fokus mentor belajar: jelaskan bertahap, beri contoh, latihan, knowledge gap, dan cara mengukur progress.';
  }

  if (activeMode === 'decision-support') {
    return 'Fokus decision support: bantu membingkai keputusan, opsi, kriteria, risiko, opportunity cost, dan confidence. Jangan mengambil keputusan final untuk user.';
  }

  if (activeMode === 'coding-debugging') {
    return 'Fokus coding/debugging: cari akar masalah, jelaskan dampak, beri patch kecil, dan sarankan test.';
  }

  if (activeMode === 'auto') {
    return 'Sesuaikan gaya jawaban dengan konteks.';
  }

  return 'Jawab santai, ramah, natural.';
}

function ensureUser(userId) {
  const id = normalizeId(userId);

  if (!userMemory[id]) {
    userMemory[id] = {
      botName: 'Bot AI',
      mode: 'auto',
      manualModeOverride: false,
      adaptive: {
        enabled: true,
        activeMode: null,
        lastReason: '',
        lastConfidence: 0
      },
      aliases: {},
      todos: [],
      reminders: [],
      nlpPatterns: [],
      msgCount: 0,
      summary: '',
      tags: [],
      preferences: {},
      digest: {
        enabled: false,
        time: '20:00'
      },
      moderation: {
        antispam: false,
        welcome: false
      },
      lastSeen: nowMs(),
      lastChatId: null
    };
  }

  const u = userMemory[id];
  if (!u.adaptive || typeof u.adaptive !== 'object') {
    u.adaptive = {
      enabled: true,
      activeMode: null,
      lastReason: '',
      lastConfidence: 0
    };
  }
  if (typeof u.manualModeOverride !== 'boolean') u.manualModeOverride = false;

  return userMemory[id];
}

function getEffectiveMode(user) {
  const u = user || {};
  if (u.manualModeOverride && u.mode) return u.mode;
  if (u.adaptive?.enabled !== false && u.adaptive?.activeMode) return u.adaptive.activeMode;
  return u.mode || 'auto';
}

function getSystemPrompt(userId) {
  const u = ensureUser(userId);

  return `
Kamu adalah asisten pribadi bernama "${u.botName}".

Gunakan bahasa yang sama dengan pesan pengguna. Jika pengguna memakai campuran bahasa, ikuti bahasa dominan; jika tidak jelas, gunakan bahasa Indonesia.

${getModePrompt(getEffectiveMode(u))}

${multiDeviceUX.getPromptRules()}

${humanAISafety.getPromptRules()}

Kalau tidak tahu, bilang tidak tahu.

Jangan mengaku manusia.
`.trim();
}

// 
function getUserSummary(userId) {
  const u = ensureUser(userId);

  const recent = (shortMemory || [])
    .filter(m => normalizeId(m.userId) === normalizeId(userId))
    .slice(-5);

  const reminders = (u.reminders || [])
    .slice(-3)
    .map(r => `${r.time} :: ${r.message}`);

  const todos = (u.todos || [])
    .filter(t => !t.done)
    .slice(-5)
    .map(t => t.text);

  return {
    botName: u.botName,
    summary: u.summary || '',
    tags: u.tags || [],
    recentMoods: recent.map(x => x.mood).filter(Boolean),
    openTodos: todos,
    reminders
  };
}

function buildContext(userId, question) {
  const recent = (shortMemory || [])
    .filter(m => normalizeId(m.userId) === normalizeId(userId))
    .slice(-6)
    .map(m => `Q: ${m.q}\nA: ${m.a}`)
    .join('\n\n');

  const summary = getUserSummary(userId);

  const personal = [
    summary.summary ? `Ringkasan user: ${summary.summary}` : '',
    summary.tags?.length ? `Tag: ${summary.tags.join(', ')}` : '',
    summary.openTodos?.length ? `Todo terbuka: ${summary.openTodos.join(' | ')}` : '',
    summary.reminders?.length ? `Reminder aktif: ${summary.reminders.join(' | ')}` : ''
  ].filter(Boolean).join('\n');

  const mem = recent ? `Konteks percakapan terakhir:\n${recent}\n\n` : '';
  const pers = personal ? `Memori personal:\n${personal}\n\n` : '';

  return `${mem}${pers}Pertanyaan user:\n${question}`;
}

function resolveAlias(userId, cmd) {
  const u = ensureUser(userId);
  const aliased = u.aliases?.[cmd];

  return aliased
    ? String(aliased).toLowerCase()
    : cmd;
}

function searchConversationHistory(userId, query) {
  const q = safeLower(query);

  const items = chatHistory
    .filter(x => normalizeId(x.userId) === normalizeId(userId))
    .filter(x => !q || safeLower(x.text || '').includes(q))
    .slice(-15);

  if (!items.length) {
    return 'Tidak ada riwayat yang cocok.';
  }

  return items.map((x, i) => {
    const who = x.role === 'assistant' ? 'Bot' : 'Kamu';
    return `${i + 1}. [${who}] ${x.text}`;
  }).join('\n');
}

async function generateDigestForUser(userId) {
  const u = ensureUser(userId);

  const recent = chatHistory
    .filter(x => normalizeId(x.userId) === normalizeId(userId))
    .slice(-40);

  const todos = (u.todos || [])
    .filter(t => !t.done)
    .slice(-10)
    .map(t => `- ${t.text}`)
    .join('\n') || '-';

  const reminders = (u.reminders || [])
    .slice(-10)
    .map(r => `- ${r.time} :: ${r.message}`)
    .join('\n') || '-';

  const historyText = recent
    .map(x => `${x.role}: ${x.text}`)
    .join('\n');

  const prompt = `Buat digest singkat untuk user.
Isi:
- ringkasan aktivitas terakhir
- todo aktif
- reminder aktif
- 2 hal penting yang perlu diperhatikan

Riwayat:
${historyText}

Todo:
${todos}

Reminder:
${reminders}`;

  return askAI(
    'Kamu membuat digest singkat, rapi, dan tidak mengarang.',
    prompt,
    {
      userId,
      question: 'digest',
      allowSearch: false,
      temperature: 0.2,
      maxTokens: 250
    }
  );
}

function scheduleDigestJob(userId) {
  if (!scheduleLib) {
    return false;
  }

  const u = ensureUser(userId);
  const time = String(u.digest?.time || '20:00');
  const m = time.match(/^(\d{2}):(\d{2})$/);

  if (!m) {
    return false;
  }

  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);

  if (digestJobs.has(userId)) {
    try { digestJobs.get(userId).cancel(); } catch (_) {}
    digestJobs.delete(userId);
  }

  const rule = new scheduleLib.RecurrenceRule();
  rule.tz = 'Asia/Jakarta';
  rule.hour = hh;
  rule.minute = mm;
  rule.second = 0;

  const job = scheduleLib.scheduleJob(rule, async () => {
    const summary = await generateDigestForUser(userId);
    const chatId = ensureUser(userId).lastChatId || userId;
    await sendChunkedMessage(chatId, `🧾 Digest harian:\n\n${summary}`);
  });

  if (job) {
    digestJobs.set(userId, job);
  }

  return !!job;
}

async function restoreAllDigests() {
  for (const job of digestJobs.values()) {
    try { job.cancel(); } catch (_) {}
  }

  digestJobs.clear();

  for (const [userId, u] of Object.entries(userMemory)) {
    if (u.digest?.enabled) {
      scheduleDigestJob(userId);
    }
  }
}

function moderationCheckIncoming(msg) {
  if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
    return false;
  }

  const text = String(msg.text || msg.caption || '');
  const u = ensureUser(msg.from.id);

  if (msg.new_chat_members?.length && u.moderation?.welcome) {
    return {
      type: 'welcome',
      text: `👋 Selamat datang ${msg.new_chat_members.map(x => x.first_name).join(', ')}!`
    };
  }

  if (u.moderation?.antispam) {
    const q = safeLower(text);
    const spammy = q.includes('http://') || q.includes('https://') || q.includes('t.me/') || q.includes('bit.ly/');

    if (spammy && !isAdmin(msg.from.id)) {
      return { type: 'delete', text: null };
    }
  }

  return false;
}

function getCachedAnswer(question) {
  const q = String(question || '').toLowerCase().trim();

  if (!q) {
    return null;
  }

  const sortedRules = [...(lessons.rules || [])].sort(
    (a, b) => String(b.trigger || '').length - String(a.trigger || '').length
  );

  const match = sortedRules.find((r) => {
    const trig = String(r.trigger || '').toLowerCase().trim();
    return trig && q.includes(trig);
  });

  return match ? match.answer : null;
}

// =====================================================
// STORAGE
// =====================================================

async function initRedis() {
  if (!REDIS_URL || !RedisClass) {
    console.log('ℹ️ Redis tidak aktif, fallback cache memory/local.');
    return;
  }

  try {
    redisClient = new RedisClass(REDIS_URL, {
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

async function initStorage() {
  const status = await storageManager.initStorage({ redisClient });
  const pgNote = status.postgres?.ok ? 'PostgreSQL aktif' : 'PostgreSQL tidak aktif, fallback JSON';
  console.log(`🗄️ Storage: ${status.persistentType} (${pgNote}), cache ${status.cache}.`);
}

async function loadData(key, defaultValue) {
  try {
    return await storageManager.loadData(key, defaultValue);
  } catch (err) {
    console.error(`Storage read ${key} gagal:`, err.message);
  }

  if (redisClient) {
    try {
      const val = await redisClient.get(key);
      if (val) {
        return JSON.parse(val);
      }
    } catch (_) {}
  }

  return readJsonFile(FILE_DIR, key, defaultValue);
}

async function saveData(key, data) {
  try {
    const saved = await storageManager.saveData(key, data);
    if (saved) return;
  } catch (err) {
    console.error(`Storage save ${key} gagal:`, err.message);
  }

  try {
    await writeJsonFileAtomic(FILE_DIR, key, data);
  } catch (e) {
    console.error(`File save ${key} gagal:`, e.message);
  }
}

async function saveAll() {
  const safeShortMemory = Array.isArray(shortMemory) ? shortMemory : [];
  const safeKnowledgeBase = Array.isArray(knowledgeBase) ? knowledgeBase : [];
  const safeAbLog = Array.isArray(abLog) ? abLog : [];
  const safeChatHistory = Array.isArray(chatHistory) ? chatHistory : [];
  const safeLessons = lessons && typeof lessons === 'object' ? lessons : { rules: [] };
  if (!Array.isArray(safeLessons.rules)) safeLessons.rules = [];

  await Promise.all([
    saveData('memory', safeShortMemory.slice(-botSettings.maxShortMemory)),
    saveData('lessons', safeLessons),
    saveData('user_memory', userMemory),
    saveData('ab_log', safeAbLog.slice(-botSettings.maxAbLog)),
    saveData('knowledge', safeKnowledgeBase.slice(-botSettings.maxKnowledge)),
    saveData('bot_settings', botSettings),
    saveData('chat_history', safeChatHistory.slice(-400))
  ]);
}

let saveChain = Promise.resolve();
function persist() {
  saveChain = saveChain
    .then(() => saveAll())
    .catch((err) => console.error('Save error:', err.message));

  return saveChain;
}

function cleanupStaleUserState(u) {
  if (!u) {
    return;
  }

  if (u.awaitingClarificationAt && nowMs() - u.awaitingClarificationAt > 10 * 60 * 1000) {
    delete u.awaitingClarification;
    delete u.awaitingClarificationAt;
  }

  if (u.awaitingMoodAt && nowMs() - u.awaitingMoodAt > 10 * 60 * 1000) {
    delete u.awaitingMood;
    delete u.awaitingMoodAt;
  }
}

async function loadAllMemories() {
  shortMemory = await loadData('memory', []);
  lessons = await loadData('lessons', { rules: [] });
  userMemory = await loadData('user_memory', {});
  abLog = await loadData('ab_log', []);
  knowledgeBase = await loadData('knowledge', []);
  chatHistory = await loadData('chat_history', []);
  botSettings = { ...botSettings, ...(await loadData('bot_settings', {})) };

  if (!Array.isArray(shortMemory)) shortMemory = [];
  if (!lessons || typeof lessons !== 'object') lessons = { rules: [] };
  if (!Array.isArray(lessons.rules)) lessons.rules = [];
  if (!userMemory || typeof userMemory !== 'object' || Array.isArray(userMemory)) userMemory = {};
  if (!Array.isArray(abLog)) abLog = [];
  if (!Array.isArray(knowledgeBase)) knowledgeBase = [];
  if (!Array.isArray(chatHistory)) chatHistory = [];

  console.log(`📂 Memori: ${shortMemory.length} chat, ${lessons.rules.length} aturan, ${knowledgeBase.length} pengetahuan`);
}

// =====================================================
// TELEGRAM HELPERS
// =====================================================

async function telegramPost(method, payload) {
  return withRetry(
    () => axios.post(`${TELEGRAM_API}/${method}`, payload, { timeout: 20000 }),
    {
      retries: 1,
      baseDelayMs: 300,
      onRetry: (err, attempt) => log.warn(`Telegram retry ${method} #${attempt}:`, err.message)
    }
  );
}

async function safeSendMessage(chatId, text, extra = {}) {
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    text,
    extra
  );
}

async function sendChunkedMessage(chatId, text, extra = {}) {
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    sanitizeOutgoingText(text),
    extra
  );
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

async function downloadTelegramFile(fileId) {
  const fileInfo = await telegramPost('getFile', { file_id: fileId });
  const filePath = fileInfo.data?.result?.file_path;

  if (!filePath) {
    throw new Error('Telegram file_path tidak tersedia.');
  }

  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  const fileRes = await axios.get(fileUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  });

  return Buffer.from(fileRes.data);
}

async function sendPhotoBuffer(chatId, buffer, caption = '', replyToMessageId = null) {
  if (!FormDataLib) return false;

  const form = new FormDataLib();
  form.append('chat_id', String(chatId));

  if (caption) {
    form.append('caption', caption);
  }

  if (replyToMessageId) {
    form.append('reply_to_message_id', String(replyToMessageId));
  }

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

async function sendStreamingAnswer(chatId, text, extra = {}) {
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    sanitizeOutgoingText(text),
    extra
  );
}


// BASIC TOOLS

async function getWeather(city) {
  if (!OPENWEATHER_API_KEY) {
    return 'API key cuaca tidak ada';
  }

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

async function searchLocation(query) {
  try {
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'TelegramBot/1.0' },
        timeout: 15000
      }
    );

    if (!res.data.length) {
      return 'Tidak ditemukan';
    }

    const p = res.data[0];

    return `📍 ${p.display_name}\n🗺️ https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}`;
  } catch {
    return 'Error lokasi';
  }
}

async function generateImage(prompt) {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&width=1024&height=768`;
}

async function searchWebTavilyRaw(query, maxResults = 6) {
  if (!TAVILY_API_KEY) {
    return { answer: null, results: [] };
  }

  const res = await axios.post(
    'https://api.tavily.com/search',
    {
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: true,
      include_raw_content: false
    },
    { timeout: 25000 }
  );

  return {
    answer: res.data.answer || null,
    results: Array.isArray(res.data.results) ? res.data.results : []
  };
}

async function searchWebTavily(query) {
  const data = await searchWebTavilyRaw(query, 6);

  let out = `🔍 Hasil untuk: ${query}\n`;

  if (data.answer) {
    out += `\n📝 ${data.answer}\n`;
  }

  (data.results || []).forEach((item, i) => {
    const content = String(item.content || item.snippet || '').slice(0, 180);
    out += `\n${i + 1}. ${item.title}\n   ${content}${content.length >= 180 ? '...' : ''}\n   ${item.url}\n`;
  });

  return out.trim();
}

async function summarizeSearchWithRefs(query, userId, systemPrompt, maxResults = 6) {
  const data = await searchWebTavilyRaw(query, maxResults);

  if ((!data.results || !data.results.length) && !data.answer) {
    return `Tidak ada hasil yang cukup untuk: ${query}`;
  }

  const sources = data.results.map((item, i) => {
    const title = String(item.title || `Sumber ${i + 1}`).trim();
    const content = String(item.content || item.snippet || '').slice(0, 700).trim();
    const url = String(item.url || '').trim();

    return `[${i + 1}] ${title}\nURL: ${url}\nIsi: ${content}`;
  }).join('\n\n');

  const prompt = `Kamu adalah peringkas artikel berbasis sumber.
Aturan:
1. Jawab hanya berdasarkan sumber yang diberikan.
2. Jangan mengarang fakta.
3. Kalau sumber kurang kuat, katakan sumber belum cukup.
4. Buat ringkasan dalam bahasa Indonesia yang rapi dan singkat.
5. Jangan tampilkan JSON, intent, params, atau code fence.
6. Wajib akhiri dengan bagian "Referensi:" berisi daftar [1], [2], dst.
7. Wajib sertakan tingkat keyakinan: tinggi/sedang/rendah.

Topik:
${query}

Catatan tambahan dari mesin pencari:
${data.answer || '-'}

Sumber:
${sources}`;

  let summary = await askAI(
    'Kamu hanya boleh menyusun ringkasan dari sumber yang diberikan. Jangan mengarang. Jangan mengeluarkan JSON.',
    prompt,
    {
      userId,
      question: query,
      allowSearch: false,
      temperature: 0.2,
      maxTokens: 900
    }
  );

  summary = sanitizeOutgoingText(summary);

  if (!summary) {
    summary = 'Maaf, aku belum bisa menyusun ringkasan yang bersih dari sumber itu.';
  }

  const refs = data.results.length
    ? ['Referensi:', ...data.results.map((item, i) => `[${i + 1}] ${String(item.title || `Sumber ${i + 1}`).trim()} — ${String(item.url || '').trim()}`)].join('\n')
    : 'Referensi:\n- Tidak ada referensi yang cukup.';

  return `${summary}\n\n${refs}`;
}

// AI

async function askMistral(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 800) {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY tidak diset');
  }

  const payload = {
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature,
    max_tokens: maxTokens
  };

  try {
    let response;

    if (mistralClient?.chat?.complete) {
      response = await mistralClient.chat.complete(payload);
    } else {
      const res = await withRetry(
        () => axios.post(
          'https://api.mistral.ai/v1/chat/completions',
          payload,
          {
            headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
            timeout: 20000
          }
        ),
        {
          retries: 1,
          baseDelayMs: 500,
          onRetry: (retryErr, attempt) => log.warn(`Mistral retry #${attempt}:`, retryErr.message)
        }
      );
      response = res.data;
    }

    const content = response?.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      return content.map(x => x.text || x.content || '').join('');
    }

    return content || '';
  } catch (err) {
    const status = err?.status || err?.response?.status || err?.body?.raw_status_code;
    console.error('Mistral Error:', status, err.message);

    if (status === 429) {
      throw new Error('RATE_LIMIT');
    }

    throw err;
  }
}

async function askGroq(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 800, model = 'llama-3.3-70b-versatile') {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ tidak diset');
  }

  const res = await withRetry(
    () => axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        timeout: 20000
      }
    ),
    {
      retries: 1,
      baseDelayMs: 500,
      onRetry: (err, attempt) => log.warn(`Groq retry #${attempt}:`, err.message)
    }
  );

  return res.data.choices?.[0]?.message?.content || '';
}

function chooseAIModel(question, intent = null) {
  const q = safeLower(question);

  if (
    intent === 'HITUNG' ||
    intent === 'TANGGAL' ||
    intent === 'JAM' ||
    intent === 'CUACA' ||
    intent === 'LOKASI'
  ) return 'groq';

  if (intent === 'SEARCH') return 'groq';
  if (intent === 'GAMBAR') return 'groq';
  if (intent === 'TAMBAH_EVENT') return 'groq';

  if (
    q.includes('kode') ||
    q.includes('bug') ||
    q.includes('error') ||
    q.includes('javascript') ||
    q.includes('node')
  ) return 'mistral';

  if (
    q.includes('ringkas') ||
    q.includes('summary') ||
    q.includes('jelaskan') ||
    q.includes('mengapa') ||
    q.includes('analisis')
  ) return 'mistral';

  return 'groq';
}

async function askAI(systemPrompt, userPrompt, opts = {}) {
  const {
    userId = '0',
    question = userPrompt,
    intent = null,
    temperature = 0.7,
    maxTokens = 800,
    allowSearch = false,
    allowCache = true,
    allowRawJson = false
  } = opts;

  const opsServices = getOpsServices();
  const promptTokens = opsSystem.tokenAnalyzer.estimateTokens(`${systemPrompt}\n${userPrompt}`);
  const aiStart = nowMs();
  const cacheKey = getCacheKey(userId, question);
  const cached = aiCache.get(cacheKey);

  if (allowCache && cached && nowMs() - cached.ts < 2 * 60 * 1000) {
    const answer = allowRawJson
      ? String(cached.answer || '').trim()
      : sanitizeOutgoingText(cached.answer);
    opsSystem.telemetry.recordAIUsage({
      provider: 'cache',
      model: 'answer-cache',
      promptTokens: 0,
      completionTokens: opsSystem.tokenAnalyzer.estimateTokens(answer),
      latencyMs: nowMs() - aiStart,
      success: true,
      cached: true
    }, opsServices);
    return answer;
  }

  const modelOrder = chooseProviderOrder({
    preferred: chooseAIModel(question, intent),
    available: {
      groq: Boolean(GROQ_API_KEY),
      mistral: Boolean(MISTRAL_API_KEY)
    }
  });

  let lastErr = null;

  for (const m of modelOrder) {
    if (!aiCircuitBreaker.canRun(m)) {
      lastErr = new Error(`${m} circuit open`);
      opsSystem.telemetry.recordAIUsage({
        provider: m,
        model: m,
        promptTokens,
        completionTokens: 0,
        latencyMs: 0,
        success: false,
        error: lastErr.message
      }, opsServices);
      continue;
    }

    const providerStart = nowMs();
    try {
      const raw = m === 'mistral'
        ? await askMistral(systemPrompt, userPrompt, temperature, maxTokens)
        : await askGroq(systemPrompt, userPrompt, temperature, maxTokens);

      const answer = allowRawJson
        ? String(raw || '').trim()
        : sanitizeOutgoingText(raw);

      if (answer && answer.trim()) {
        aiCircuitBreaker.success(m);
        opsSystem.telemetry.recordAIUsage({
          provider: m,
          model: m,
          promptTokens,
          completionTokens: opsSystem.tokenAnalyzer.estimateTokens(answer),
          latencyMs: nowMs() - providerStart,
          success: true
        }, opsServices);
        aiCache.set(cacheKey, {
          ts: nowMs(),
          answer
        });
        return answer;
      }
    } catch (err) {
      aiCircuitBreaker.failure(m);
      opsSystem.telemetry.recordAIUsage({
        provider: m,
        model: m,
        promptTokens,
        completionTokens: 0,
        latencyMs: nowMs() - providerStart,
        success: false,
        error: err.message
      }, opsServices);
      if (err?.message === 'RATE_LIMIT' && m === 'mistral') {
        lastErr = err;
        continue;
      }

      lastErr = err;
      log.warn(`${m} gagal:`, err.message);
    }
  }

  if (shouldUseSearchFallback({ allowSearch, hasSearchKey: Boolean(TAVILY_API_KEY) })) {
    try {
      const searchRes = await searchWebTavily(question);

      if (searchRes && !searchRes.includes('Error')) {
        const raw = await askGroq(
          systemPrompt,
          `${question}\n\nHasil pencarian web:\n${searchRes}\n\nJawab singkat, akurat, dan sebutkan poin penting.`,
          0.4,
          maxTokens
        );

        const answer = allowRawJson
          ? String(raw || '').trim()
          : sanitizeOutgoingText(raw);

        opsSystem.telemetry.recordAIUsage({
          provider: 'search-fallback',
          model: 'groq',
          promptTokens: opsSystem.tokenAnalyzer.estimateTokens(`${question}\n${searchRes}`),
          completionTokens: opsSystem.tokenAnalyzer.estimateTokens(answer),
          latencyMs: nowMs() - aiStart,
          success: true
        }, opsServices);
        aiCache.set(cacheKey, {
          ts: nowMs(),
          answer
        });

        return answer;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error('Semua AI gagal.');
}

async function getAnswerWithAB(question, userId, systemPrompt, intent = null) {
  const chosen = Math.random() > 0.5 ? 'santai' : 'formal';

  const stylePrompt = chosen === 'santai'
    ? 'Jawab dengan santai, gunakan "aku" dan "kamu".'
    : 'Jawab dengan gaya informatif dan sopan.';

  const answer = await askAI(
    systemPrompt,
    `${stylePrompt}\n\nPertanyaan user:\n${question}`,
    {
      userId,
      question,
      intent,
      allowSearch: true
    }
  );

  abLog.push({
    userId,
    question,
    chosen,
    answer,
    timestamp: nowMs()
  });

  if (abLog.length > botSettings.maxAbLog) {
    abLog.shift();
  }

  await persist();

  return { answer, style: chosen };
}

async function getSmartAnswer(question, userId, systemPrompt, intent = null) {
  const cached = getCachedAnswer(question);

  if (cached) {
    return sanitizeOutgoingText(cached) || cached;
  }

  const qLower = safeLower(question);
  const needsFresh = ['terbaru', 'berita', 'update', 'sekarang', 'harga', 'skor', 'trend'].some(k => qLower.includes(k));
  const allowSearch = needsFresh || qLower.includes('cari') || qLower.includes('search') || qLower.includes('ringkas') || qLower.includes('rangkum');

  const context = buildContext(userId, question);
  const { answer } = await getAnswerWithAB(context, userId, systemPrompt, intent);

  if (allowSearch && TAVILY_API_KEY) {
    try {
      const searchRes = await searchWebTavily(question);

      if (searchRes && !searchRes.includes('Error')) {
        const learned = await askAI(
          systemPrompt,
          `${question}\n\nHasil pencarian web:\n${searchRes}\n\nJawab singkat, akurat, dan sebutkan poin penting.`,
          {
            userId,
            question,
            intent,
            allowSearch: false,
            temperature: 0.4
          }
        );

        lessons.rules.push({
          trigger: question.slice(0, 50),
          answer: learned,
          source: 'auto',
          timestamp: nowMs()
        });

        if (lessons.rules.length > botSettings.maxRules) {
          lessons.rules.shift();
        }

        await persist();

        const cleanedLearned = sanitizeOutgoingText(learned);
        return cleanedLearned || 'Maaf, aku belum bisa merangkum hasil itu dengan jelas.';
      }
    } catch (_) {}
  }

  shortMemory.push({
    userId,
    q: question,
    a: answer,
    timestamp: nowMs()
  });

  if (shortMemory.length > botSettings.maxShortMemory) {
    shortMemory.shift();
  }

  await persist();

  const cleaned = sanitizeOutgoingText(answer);
  return cleaned || 'Maaf, aku belum bisa memproses itu.';
}

async function autoSummarizeMemory(userId, force = false) {
  const u = ensureUser(userId);
  const recent = shortMemory
    .filter(m => normalizeId(m.userId) === normalizeId(userId))
    .slice(-24);

  if (!recent.length) return null;

  const gap = (u.msgCount || 0) - (u.lastSummaryMsgCount || 0);

  if (!force && gap < 12) return null;

  const history = recent.map(m => `Q: ${m.q}\nA: ${m.a}`).join('\n\n');

  const prompt = `Ringkas percakapan berikut menjadi memori singkat maksimal 120 kata.
Fokus pada preferensi user, topik yang sering dibahas, tugas aktif, dan hal penting yang perlu diingat.
Jangan menambah informasi yang tidak ada.

Percakapan:
${history}`;

  try {
    const summary = await askAI(
      'Kamu membuat ringkasan memori yang singkat, akurat, dan tidak mengada-ada.',
      prompt,
      {
        userId,
        question: 'memory summary',
        allowSearch: false,
        temperature: 0.2,
        maxTokens: 220
      }
    );

    if (summary && summary.trim()) {
      u.summary = summary.trim();
      u.lastSummaryAt = nowMs();
      u.lastSummaryMsgCount = u.msgCount || 0;
      await persist();
      return u.summary;
    }
  } catch (err) {
    console.error('Auto summary error:', err.message);
  }

  return null;
}

// GOOGLE CALENDAR

function createOAuthClient() {
  if (
    !googleLib ||
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI
  ) {
    return null;
  }

  return new googleLib.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(state) {
  const client = createOAuthClient();

  if (!client) {
    return null;
  }

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    state
  });
}

async function getTokensFromCode(code) {
  const client = createOAuthClient();

  if (!client) {
    throw new Error('OAuth2 tidak dikonfigurasi');
  }

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

  if (!tokens) {
    return null;
  }

  const client = createOAuthClient();

  if (!client) {
    return null;
  }

  client.setCredentials(tokens);

  return googleLib.calendar({
    version: 'v3',
    auth: client
  });
}

// =====================================================
// REMINDER SYSTEM
// =====================================================

function scheduleReminderJob(userId, reminder) {
  if (!scheduleLib) {
    return false;
  }

  const when = new Date(reminder.time);

  if (!isValidDate(when) || when <= new Date()) {
    return false;
  }

  if (reminderJobs.has(reminder.id)) {
    try {
      reminderJobs.get(reminder.id).cancel();
    } catch (_) {}

    reminderJobs.delete(reminder.id);
  }

  const job = scheduleLib.scheduleJob(
    when,
    async () => {
      const chatId = reminder.chatId || userId;

      await safeSendMessage(
        chatId,
        `⏰ Pengingat: ${reminder.message}`
      );

      const u = ensureUser(userId);

      u.reminders = (u.reminders || []).filter(
        r => r.id !== reminder.id
      );

      reminderJobs.delete(reminder.id);

      await persist();
    }
  );

  if (job) {
    reminderJobs.set(reminder.id, job);
  }

  return !!job;
}

async function restoreAllReminders() {
  if (!scheduleLib) {
    console.warn('⚠️ node-schedule tidak terpasang.');
    return;
  }

  for (const job of reminderJobs.values()) {
    try {
      job.cancel();
    } catch (_) {}
  }

  reminderJobs.clear();

  let changed = false;
  const now = new Date();

  for (const [userId, u] of Object.entries(userMemory)) {
    const reminders = Array.isArray(u.reminders)
      ? u.reminders
      : [];

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

  if (changed) {
    await persist();
  }
}

// =====================================================
// FEATURE HANDLERS
// =====================================================

async function handlePing(chatId, msg) {
  await safeSendMessage(
    chatId,
    '🏓 Pong!',
    {
      reply_to_message_id: msg.message_id
    }
  );
}

async function performUserReset(userId) {
  const u = ensureUser(userId);

  u.summary = '';
  u.todos = [];
  u.reminders = [];
  u.tags = [];
  u.preferences = {};
  u.aliases = {};
  u.nlpPatterns = [];
  u.mood = null;
  u.awaitingMood = false;
  u.awaitingMoodAt = null;
  u.awaitingClarification = null;
  u.awaitingClarificationAt = null;
  u.lastFileName = null;
  u.lastFileText = null;

  await persist();
}

async function handleReset(chatId, userId, msg) {
  await interactions.confirmationHandler.requestConfirmation(
    getInteractionServices(),
    {
      chatId,
      userId,
      messageId: msg.message_id
    },
    {
      type: 'reset_user_memory',
      text: 'Ini akan menghapus memory personal, todo, reminder lokal, preferensi, alias, mood, dan cache file user ini. Lanjutkan?'
    }
  );
}

async function handleResetConfirmed(chatId, userId, messageId) {
  await performUserReset(userId);

  await safeSendMessage(
    chatId,
    '🧹 Memory personal sudah direset.',
    {
      reply_to_message_id: messageId
    }
  );
}

async function handleSettings(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);

  if (cmd === '/setname') {
    const newName = args.trim();

    if (newName && newName.length < 50) {
      u.botName = newName;

      await persist();

      await safeSendMessage(
        chatId,
        `✅ Namaku sekarang "${newName}".`,
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      await safeSendMessage(
        chatId,
        '❌ Nama tidak valid.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  if (cmd === '/savepref') {
    const [k, ...rest] = args
      .split('=')
      .map(s => s.trim());

    const v = rest.join('=').trim();

    if (!k || !v) {
      await safeSendMessage(
        chatId,
        'Format: /savepref kunci = nilai',
        {
          reply_to_message_id: msg.message_id
        }
      );

      return true;
    }

    u.preferences ||= {};
    u.preferences[k] = v;

    await persist();

    await safeSendMessage(
      chatId,
      `✅ Preferensi disimpan: ${k} = ${v}`,
      {
        reply_to_message_id: msg.message_id
      }
    );

    return true;
  }

  return false;
}

async function handleCalibration(chatId, userId, cmd, args, msg) {
  if (cmd === '/koreksi') {
    const parts = args.split('|');

    if (parts.length < 2) {
      await safeSendMessage(
        chatId,
        'Format: /koreksi pertanyaan | jawaban_benar',
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      const trigger = parts[0].trim();
      const answer = parts.slice(1).join('|').trim();

      if (!answer || answer.length < 3) {
        await safeSendMessage(
          chatId,
          '❌ Jawaban terlalu pendek.',
          {
            reply_to_message_id: msg.message_id
          }
        );
      } else {
        lessons.rules.push({
          trigger,
          answer,
          source: 'user',
          timestamp: nowMs()
        });

        if (lessons.rules.length > botSettings.maxRules) {
          lessons.rules.shift();
        }

        await persist();

        await saveNlpPattern(
          userId,
          trigger,
          'CUSTOM_RULE',
          { answer }
        );

        await agentLearning.learnFromCorrection(
          'telegram_correction',
          userId,
          trigger,
          'CUSTOM_RULE',
          { answer },
          { ensureUser, persist }
        );

        await safeSendMessage(
          chatId,
          '✅ Terima kasih, saya belajar.',
          {
            reply_to_message_id: msg.message_id
          }
        );
      }
    }

    return true;
  }

  if (cmd === '/rollback') {
    if (lessons.rules.length) {
      lessons.rules.pop();

      await persist();

      await safeSendMessage(
        chatId,
        '🗑️ Aturan terakhir dihapus.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      await safeSendMessage(
        chatId,
        'Tidak ada aturan.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  return false;
}

async function handleStats(chatId, userId, msg) {
  const mem = process.memoryUsage();
  const u = ensureUser(userId);
  const storage = storageManager.getStorageStatus();

  const msgText =
`Uptime: ${Math.floor(process.uptime() / 60)} menit
Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
Storage: ${storage.driver}
PostgreSQL: ${storage.postgresAvailable ? 'aktif' : 'fallback JSON'}
Redis: ${storage.redisAvailable ? 'aktif' : 'memory/local'}
Aturan: ${lessons.rules.length}
Histori chat: ${shortMemory.length}
Pengetahuan: ${knowledgeBase.length}
Reminder aktif: ${(u.reminders || []).length}
Todo aktif: ${(u.todos || []).filter(x => !x.done).length}
Plugin aktif: ${pluginModules.length}`;

  await safeSendMessage(
    chatId,
    msgText,
    {
      reply_to_message_id: msg.message_id
    }
  );
}

async function handleSystemStatus(chatId, userId, msg) {
  if (!isAdmin(userId)) {
    await safeSendMessage(
      chatId,
      '❌ Hanya admin yang boleh melihat status sistem produksi.',
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const status = autonomousEngine.getRuntimeStatus();
  const q = status.queue || {};
  const t = status.telemetry || {};
  const c = status.collaboration || {};
  const g = status.governance?.audit || {};
  const aios = status.aiOS || {};
  const aiosUser = aiOS.getStatus(userId, getAiosServices());
  const ops = opsSystem.getStatus(getOpsServices());
  const storage = storageManager.getStorageStatus();
  const issues = status.issues?.length ? status.issues.join('\n- ') : 'tidak ada';

  const text =
`Status: ${status.status}
Uptime: ${Math.floor((t.uptimeSeconds || 0) / 60)} menit
RAM RSS: ${t.memoryUsageMB?.rss || 0} MB
Heap: ${t.memoryUsageMB?.heapUsed || 0}/${t.memoryUsageMB?.heapTotal || 0} MB
Queue: ${q.activeCount || 0} aktif, ${q.queuedCount || 0}/${q.maxQueueSize || 0} antre
Agents: ${status.agents.length}
Agent Registry: ${status.agentRegistry?.length || 0}
Collab Workflows: ${c.recentWorkflowCount || 0}
Avg Consensus: ${(c.averageConsensusConfidence || 0).toFixed(2)}
Governance Audit: ${g.recentAuditCount || 0}
Blocked: ${g.blockedCount || 0}
Approval Requests: ${g.approvalRequestCount || 0}
AI OS Modules: ${aios.modules?.length || 0}
AI OS Memory: ${aiosUser.totalMemory}
AI OS Graph: ${aiosUser.graphNodes}/${aiosUser.graphEdges}
AI OS Goals/Workflows: ${aiosUser.activeGoals}/${aiosUser.activeWorkflows}
AI OS Stale Goals/Workflows: ${aiosUser.staleGoals}/${aiosUser.staleWorkflows}
AI OS Workflow Completion: ${Math.round((aiosUser.workflowCompletionRatio || 0) * 100)}%
Ops Health: ${ops.health.status}
Ops Reliability: ${ops.reliability.score}/100 (${ops.reliability.status})
Ops Errors 15m: ${ops.telemetry.recentErrorCount}
Ops Latency p90: ${ops.telemetry.latency.p90}ms
Ops Diagnosis: ${ops.diagnosis.diagnosis} (${ops.diagnosis.severity})
Storage: ${storage.persistentType}, cache ${storage.cache?.type || '-'}
Issues:
- ${issues}`;

  await safeSendMessage(
    chatId,
    text,
    { reply_to_message_id: msg.message_id }
  );
}

async function handleImproveStatus(chatId, userId, msg) {
  if (!isAdmin(userId)) {
    await safeSendMessage(
      chatId,
      '❌ Hanya admin yang boleh melihat laporan self-improvement.',
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const report = selfImprovementAgent.getReport(userId, { ensureUser });
  const r = report.rolling || {};
  const hints = report.promptHints || {};
  const lessonsText = report.learningMemory?.length
    ? report.learningMemory.map(item => `- ${item.note}`).join('\n')
    : '- belum ada learning note';
  const failuresText = report.failureHistory?.length
    ? report.failureHistory.map(item => `- ${item.reason}: ${item.question || item.details || '-'}`).join('\n')
    : '- belum ada failure pattern';

  const text =
`Self-Improvement Report
Samples: ${report.samples || 0}
Quality: ${(r.answerQuality || 0).toFixed(2)}
Reasoning: ${(r.reasoning || 0).toFixed(2)}
Confidence: ${(r.confidence || 0).toFixed(2)}
Tool Accuracy: ${(r.toolAccuracy || 0).toFixed(2)}
Memory Relevance: ${(r.memoryRelevance || 0).toFixed(2)}
User Satisfaction: ${(r.userSatisfaction || 0).toFixed(2)}
Risk: ${(r.risk || 0).toFixed(2)}
Clarity: ${(r.clarity || 0).toFixed(2)}
Learning Impact: ${(r.learningImpact || 0).toFixed(2)}
Hints: depth=${hints.reasoningDepth || '-'}, style=${hints.answerStyle || '-'}, clarify=${hints.clarifyWhenUncertain ? 'yes' : 'no'}

Learning Notes:
${lessonsText}

Failure Patterns:
${failuresText}`;

  await sendChunkedMessage(
    chatId,
    text,
    { reply_to_message_id: msg.message_id }
  );
}

function formatIncidentLine(incident, index) {
  return `${index + 1}. ${incident.id} [${incident.severity || incident.classification}/${incident.status}] ${incident.title}`;
}

function formatIncidentDetail(incident) {
  if (!incident) return 'Incident tidak ditemukan.';
  return [
    `Incident: ${incident.id}`,
    `Title: ${incident.title}`,
    `Category: ${incident.category || incident.classification}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Cause: ${incident.suspectedCause}`,
    `Confidence: ${Number(incident.confidence || 0).toFixed(2)}`,
    `Created: ${incident.createdAt}`,
    `Updated: ${incident.updatedAt}`,
    '',
    'Evidence:',
    ...((incident.evidence || ['-']).map(item => `- ${item}`)),
    '',
    'Recommended actions:',
    ...((incident.recommendedActions || incident.recommendedFixes || ['-']).map(item => `- ${item}`)),
    '',
    'Lessons:',
    ...((incident.lessons || ['-']).map(item => `- ${item}`))
  ].join('\n');
}

function formatBenchmarkRun(run) {
  const failed = (run.results || []).filter(item => !item.passed);
  const failedText = failed.length
    ? failed.map(item => `- ${item.id}: ${item.notes}`).join('\n')
    : '- tidak ada';
  return [
    `Benchmark: ${run.id}`,
    `Type: ${run.type}`,
    `Status: ${run.status || (run.passed ? 'passed' : 'failed')}`,
    `Score: ${Math.round((run.score || 0) * 100)}%`,
    `Passed: ${run.passed ? 'ya' : 'tidak'}`,
    `Cases: ${run.caseCount}`,
    `Baseline: ${run.baselineId || '-'}`,
    `Regression: ${run.regressionAgainstBaseline ? 'ya' : 'tidak'}`,
    '',
    'Failed cases:',
    failedText
  ].join('\n');
}

function formatBenchmarkHistory(runs) {
  return runs.length
    ? runs.map((run, index) => `${index + 1}. ${run.id} [${run.status || (run.passed ? 'passed' : 'failed')}] score ${Math.round((run.score || 0) * 100)}%, cases ${run.caseCount}, ${run.createdAt}`).join('\n')
    : 'Belum ada benchmark.';
}

function formatRecoveryPlan(recovery) {
  const plan = recovery.plan || recovery;
  const diagnosis = recovery.diagnosis;
  return [
    `Diagnosis: ${diagnosis?.diagnosis || '-'}`,
    `Severity: ${plan.severity || '-'}`,
    `Recommended action: ${plan.recommendedAction?.action || '-'}`,
    `Risk: ${plan.recommendedAction?.riskLevel || '-'}`,
    `Impact: ${plan.recommendedAction?.expectedImpact || '-'}`,
    `Rollback option: ${plan.recommendedAction?.rollbackOption || '-'}`,
    `Confidence: ${Number(plan.recommendedAction?.confidence || 0).toFixed(2)}`,
    '',
    'Action options:',
    ...(plan.actions || []).map(item => `- ${item.action} [risk=${item.riskLevel}, safe=${item.safeToExecute ? 'yes' : 'no'}]`)
  ].join('\n');
}

async function handleOpsCommands(chatId, userId, cmd, args, msg) {
  const opsCommands = new Set([
    '/ops',
    '/health',
    '/perf',
    '/cost',
    '/tokens',
    '/benchmark',
    '/benchmarkfull',
    '/benchmarks',
    '/diag',
    '/diagnose',
    '/incidents',
    '/incident',
    '/recover',
    '/reliability',
    '/regression',
    '/tuning',
    '/opslessons',
    '/opskb',
    '/rollbackplan',
    '/canary',
    '/opsreset',
    '/ops-reset'
  ]);

  if (!opsCommands.has(cmd)) return false;

  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    await safeSendMessage(chatId, '❌ Command AI Operations hanya untuk admin.', replyOpt);
    return true;
  }

  const services = getOpsServices();

  if (cmd === '/ops') {
    const workflow = opsSystem.opsWorkflow.runOperationalWorkflow(services, { trigger: '/ops' });
    const status = opsSystem.getStatus(services);
    const recentIncidents = opsSystem.incidentHandler.listRecentIncidents(services, 3);
    const tuning = opsSystem.tuningController.recommendTuning(services);
    const benchmarkSummary = opsSystem.benchmarkEngine.getBenchmarkSummary(services);
    const text =
`AI Production Ops
Health: ${status.health.status}
Uptime: ${Math.floor((status.health.uptimeSeconds || 0) / 60)} menit
Memory: RSS ${status.health.memory.rssMb} MB, heap ${status.health.memory.heapUsedMb}/${status.health.memory.heapTotalMb} MB
Reliability: ${status.reliability.score}/100 (${status.reliability.status})
Diagnosis: ${status.diagnosis.diagnosis} (${status.diagnosis.severity})
Requests: ${status.telemetry.counters.request || 0}
Commands: ${status.telemetry.counters.command || 0}
AI calls: ${status.telemetry.counters.aiCall || 0}
Errors 15m: ${status.telemetry.recentErrorCount}
Latency p90: ${status.telemetry.latency.p90}ms
Avg tokens: ${status.telemetry.token.averageTokens}
Anomaly score: ${status.telemetry.anomalyScore}
Ops modules: ${status.modules.length}
Ops workflow: ${workflow.steps.join(' -> ')}

Benchmark:
Latest: ${benchmarkSummary.latestId || '-'} (${benchmarkSummary.latestStatus}, score ${Math.round((benchmarkSummary.latestScore || 0) * 100)}%)
Baseline: ${benchmarkSummary.baselineId || '-'}

Tuning:
${tuning.recommendations.map(item => `- ${item.setting}: ${item.recommended} (${item.reason})`).join('\n')}

Incident terbaru:
${recentIncidents.length ? recentIncidents.map(formatIncidentLine).join('\n') : '- belum ada'}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/health') {
    const health = opsSystem.healthMonitor.getHealth(services);
    const incident = opsSystem.incidentHandler.detectIncident(services, { health });
    const text =
`${opsSystem.healthMonitor.formatHealth(health)}
Providers:
${Object.entries(health.providers || {}).map(([name, item]) => `- ${name}: ${item.available ? 'available' : 'degraded'} (configured=${item.configured})`).join('\n')}

Incident detection: ${incident.detected ? `terdeteksi ${incident.incident.id}` : (incident.suppressed ? 'suppressed sementara' : 'tidak ada')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/perf') {
    const perf = opsSystem.performanceProfiler.summarizePerformance(services);
    const cost = opsSystem.costOptimizer.analyzeCost(services, userId);
    const text =
`Performance
Samples: ${perf.sampleCount}
Bottleneck: ${perf.bottleneck}
Latency p50/p90/p95: ${perf.latency.p50}/${perf.latency.p90}/${perf.latency.p95}ms

Slow operations:
${perf.slowOperations.length ? perf.slowOperations.map(item => `- ${item.scope}: avg ${item.averageMs}ms, max ${item.maxMs}ms`).join('\n') : '- tidak ada'}

Cost Efficiency
Estimated tokens: ${cost.estimatedTokenUsage.estimatedTotalTokens}
Average tokens: ${cost.estimatedTokenUsage.averageTokens}
AI/request: ${cost.aiPerRequest}
Rekomendasi:
${cost.recommendations.map(item => `- ${item.action}: ${item.reason}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/cost') {
    const cost = opsSystem.costOptimizer.analyzeCost(services, userId);
    const resources = cost.resources || {};
    const text =
`Cost / Token Efficiency
Estimated tokens: ${cost.estimatedTokenUsage.estimatedTotalTokens}
Average tokens: ${cost.estimatedTokenUsage.averageTokens}
AI/request: ${cost.aiPerRequest}
Spike: ${cost.estimatedTokenUsage.spike.spike ? `${cost.estimatedTokenUsage.spike.ratio}x` : 'tidak'}
Cache hint: ${cost.cacheHint}
Context hint: ${cost.contextCompressionHint}
Max token hint: ${cost.maxTokenHint}
Benchmark hint: ${cost.benchmarkSamplingHint}

Resource Efficiency
Memory count: ${resources.memory?.memoryCount ?? 0}
Graph size: ${resources.memory?.graphSize ?? 0}
Telemetry size: ${resources.memory?.telemetrySizeBytes ?? 0} bytes
Stale items: ${resources.memory?.staleItemCount ?? 0}
Ops data: ${resources.storage?.opsDataSizeBytes ?? 0} bytes
Benchmark history: ${resources.storage?.benchmarkHistorySize ?? 0}
Incident history: ${resources.storage?.incidentHistorySize ?? 0}
Active workflows: ${resources.workflow?.activeWorkflowCount ?? 0}
Completed step ratio: ${resources.workflow?.completedStepRatio ?? 0}
Stuck workflows: ${resources.workflow?.stuckWorkflowCount ?? 0}

Rekomendasi:
${cost.recommendations.map(item => `- ${item.action}: ${item.reason}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/tokens') {
    const token = opsSystem.tokenAnalyzer.summarizeTokenUsage(services);
    const top = token.topExpensiveOperation;
    const text =
`Token Usage Estimate
Samples: ${token.sampleCount}
Total: ${token.estimatedTotalTokens}
Prompt: ${token.estimatedPromptTokens}
Completion: ${token.estimatedCompletionTokens}
Average: ${token.averageTokens}
Spike: ${token.spike.spike ? `${token.spike.ratio}x, last ${token.spike.last}, avg ${token.spike.average}` : 'tidak'}
Top expensive: ${top ? `${top.provider}/${top.model} ${top.totalTokens} tokens` : '-'}
By provider:
${Object.entries(token.byProvider || {}).map(([name, value]) => `- ${name}: ${value}`).join('\n') || '-'}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/benchmark') {
    const type = String(args || '').trim() || null;
    const before = opsSystem.benchmarkEngine.getBenchmarkHistory(services, 1)[0];
    const run = opsSystem.benchmarkEngine.runBenchmarkSuite(type, services, { full: false });
    const comparison = opsSystem.benchmarkEngine.compareBenchmarkRuns(before, run);
    const regression = opsSystem.regressionDetector.detectRegression(services);
    const text =
`${formatBenchmarkRun(run)}

Comparison: ${comparison.comparable ? `${Math.round(comparison.delta * 100)}%` : comparison.notes}
Regression: ${regression.regressionDetected ? `${regression.metric} (${regression.severity})` : 'tidak terdeteksi'}
Rekomendasi: ${regression.recommendation}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/benchmarkfull') {
    const before = opsSystem.benchmarkEngine.getBenchmarkHistory(services, 1)[0];
    const run = opsSystem.benchmarkEngine.runBenchmarkSuite(null, services, { full: true });
    const comparison = opsSystem.benchmarkEngine.compareBenchmarkRuns(before, run);
    const text =
`⚠️ Benchmark full lebih berat daripada /benchmark default, tetapi tetap tidak memanggil AI eksternal.

${formatBenchmarkRun(run)}

Comparison: ${comparison.comparable ? `${Math.round(comparison.delta * 100)}%` : comparison.notes}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/benchmarks') {
    const runs = opsSystem.benchmarkEngine.getBenchmarkHistory(services, 10).reverse();
    await sendChunkedMessage(chatId, `Benchmark History:\n${formatBenchmarkHistory(runs)}`, replyOpt);
    return true;
  }

  if (cmd === '/diag' || cmd === '/diagnose') {
    const diagnosis = opsSystem.diagnosticsEngine.diagnose(services);
    await sendChunkedMessage(chatId, opsSystem.diagnosticsEngine.formatDiagnosis(diagnosis), replyOpt);
    return true;
  }

  if (cmd === '/incidents') {
    const [action, incidentId] = splitPipeArgs(args);
    if (action === 'resolve' && incidentId) {
      const result = opsSystem.incidentHandler.resolveIncident(incidentId, services);
      await safeSendMessage(chatId, result.ok ? `Incident ${incidentId} ditutup.` : `Gagal: ${result.reason}`, replyOpt);
      return true;
    }
    const incidents = opsSystem.incidentHandler.listRecentIncidents(services, 10);
    const text = incidents.length
      ? incidents.map(formatIncidentLine).join('\n')
      : 'Belum ada incident operasional.';
    await sendChunkedMessage(chatId, `Incidents:\n${text}\n\nTutup: /incidents resolve | <incidentId>`, replyOpt);
    return true;
  }

  if (cmd === '/incident') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await safeSendMessage(chatId, 'Format: /incident <incidentId>', replyOpt);
      return true;
    }
    const incident = opsSystem.incidentHandler.getIncident(incidentId, services);
    await sendChunkedMessage(chatId, formatIncidentDetail(incident), replyOpt);
    return true;
  }

  if (cmd === '/recover') {
    const raw = String(args || '').trim();
    if (raw.startsWith('confirm ')) {
      const action = raw.slice('confirm '.length).trim();
      if (!action) {
        await safeSendMessage(chatId, 'Format: /recover confirm <action>', replyOpt);
        return true;
      }
      const result = opsSystem.recoveryController.executeRecoveryAction(action, services, {
        confirmedByAdmin: true,
        confidence: 0.82,
        provider: 'manual'
      });
      await safeSendMessage(
        chatId,
        result.ok
          ? `Recovery dijalankan: ${result.action}\nEffect: ${result.effect}`
          : `Recovery ditolak: ${result.reason}`,
        replyOpt
      );
      return true;
    }
    const recovery = opsSystem.recoveryController.getRecoveryRecommendation(services);
    await sendChunkedMessage(chatId, `Recovery Recommendation\n${formatRecoveryPlan(recovery)}\n\nJalankan aksi aman: /recover confirm <action>`, replyOpt);
    return true;
  }

  if (cmd === '/reliability') {
    const score = opsSystem.reliabilityScorer.calculateReliabilityScore(services, { userId });
    const text =
`Reliability Score: ${score.score}/100
Status: ${score.status}
Risk: ${score.risk}/100
Trend: ${score.trend}
Strongest: ${score.strongestArea ? `${score.strongestArea.name} (${score.strongestArea.score}/100)` : '-'}
Weakest: ${score.weakestArea ? `${score.weakestArea.name} (${score.weakestArea.score}/100)` : '-'}
Factors:
${Object.entries(score.factors || {}).map(([name, value]) => `- ${name}: ${value}/100`).join('\n')}

Top Risks:
${score.topRisks.length ? score.topRisks.map(item => `- ${item}`).join('\n') : '- tidak ada risiko besar'}

Recommended Fixes:
${score.recommendedFixes.map(item => `- ${item}`).join('\n')}

Penjelasan:
${score.explanation.map(item => `- ${item}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/regression') {
    const regression = opsSystem.regressionDetector.detectRegression(services);
    const text =
`Regression Check
Detected: ${regression.regressionDetected ? 'ya' : 'tidak'}
Severity: ${regression.severity}
Metric: ${regression.metric}
Baseline: ${regression.baselineValue ?? '-'}
Current: ${regression.currentValue ?? '-'}
Delta: ${regression.delta ?? 0}
Possible cause: ${regression.possibleCause}
Recommendation: ${regression.recommendation}

Findings:
${regression.findings.length ? regression.findings.map(item => `- ${item.metric}: ${item.baselineValue} -> ${item.currentValue}, delta ${item.delta} (${item.severity})`).join('\n') : '- tidak ada'}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/tuning') {
    const tuning = opsSystem.tuningController.recommendTuning(services);
    const text =
`Tuning Recommendation
Auto apply: ${tuning.autoApply ? 'ya' : 'tidak'}
Reason: ${tuning.reason}
Reliability: ${tuning.reliability.score}/100

Recommendations:
${tuning.recommendations.map(item => `- ${item.setting}: ${item.recommended} (confidence ${Number(item.confidence || 0).toFixed(2)})\n  ${item.reason}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/opslessons') {
    const [action, title, content, tags = ''] = splitPipeArgs(args);
    if (action === 'add') {
      if (!title || !content) {
        await safeSendMessage(chatId, 'Format: /opslessons add | <judul> | <isi> | <tag1,tag2>', replyOpt);
        return true;
      }
      const lesson = opsSystem.opsKnowledgeBase.addOpsLesson({
        title,
        content,
        tags: tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }, services);
      await safeSendMessage(chatId, `Ops lesson tersimpan: ${lesson.id}`, replyOpt);
      return true;
    }
    const lessonsFound = opsSystem.opsKnowledgeBase.searchOpsKnowledge(args, services);
    const checklist = opsSystem.opsKnowledgeBase.getDeploymentChecklist();
    const text =
`Ops Knowledge
Lessons:
${lessonsFound.length ? lessonsFound.map((item, index) => `${index + 1}. ${item.title}: ${item.content}`).join('\n') : '- belum ada'}

Deployment checklist:
${checklist.map(item => `- ${item}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/opskb') {
    const query = String(args || '').trim();
    if (!query) {
      await safeSendMessage(chatId, 'Format: /opskb <query>', replyOpt);
      return true;
    }
    const lessonsFound = opsSystem.opsKnowledgeBase.searchOpsKnowledge(query, services);
    const recipe = opsSystem.opsKnowledgeBase.getFixRecipe(query);
    const text =
`Ops KB: ${query}
Lessons:
${lessonsFound.length ? lessonsFound.map((item, index) => `${index + 1}. ${item.title}: ${item.content}`).join('\n') : '- tidak ada lesson cocok'}

Fix recipe:
${recipe.map(item => `- ${item}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/rollbackplan') {
    const plan = opsSystem.rollbackManager.createRollbackPlan(args || 'manual rollback review', services);
    const text =
`Rollback Plan: ${plan.id}
Automatic rollback: ${plan.automaticRollback ? 'ya' : 'tidak'}
Reason: ${plan.reason}
Regression: ${plan.regression.regressionDetected ? `${plan.regression.metric} (${plan.regression.severity})` : 'tidak ada sinyal kuat'}
Affected metrics: ${plan.affectedMetrics.join(', ') || '-'}

Checklist:
${plan.checklist.map(item => `- ${item}`).join('\n')}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/canary') {
    const raw = String(args || '').trim();
    if (raw.startsWith('create ')) {
      const [name, description = ''] = splitPipeArgs(raw.slice('create '.length));
      if (!name) {
        await safeSendMessage(chatId, 'Format: /canary create <name> | <description>', replyOpt);
        return true;
      }
      const canary = opsSystem.canaryController.createCanary(name, { rolloutPercent: 0, description }, services);
      await safeSendMessage(chatId, `Canary dibuat: ${canary.id} (${canary.rolloutPercent}%, draft/off)\nDescription: ${description || '-'}`, replyOpt);
      return true;
    }
    if (raw.startsWith('rollback ')) {
      const canaryId = raw.slice('rollback '.length).trim();
      if (!canaryId) {
        await safeSendMessage(chatId, 'Format: /canary rollback <id>', replyOpt);
        return true;
      }
      const result = opsSystem.canaryController.rollbackCanary(canaryId, services);
      await safeSendMessage(chatId, result.ok ? `Canary rollback: ${canaryId}` : `Gagal rollback canary: ${result.reason}`, replyOpt);
      return true;
    }
    if (raw.startsWith('metric ')) {
      const [canaryId, name, value, note = ''] = splitPipeArgs(raw.slice('metric '.length));
      if (!canaryId || !name || value === undefined) {
        await safeSendMessage(chatId, 'Format: /canary metric <id> | <metricName> | <value> | <note optional>', replyOpt);
        return true;
      }
      const result = opsSystem.canaryController.recordCanaryMetric(canaryId, { name, value: Number(value), note }, services);
      await safeSendMessage(chatId, result.ok ? `Metric canary tersimpan: ${canaryId}` : `Gagal simpan metric: ${result.reason}`, replyOpt);
      return true;
    }
    if (raw.startsWith('compare ')) {
      const canaryId = raw.slice('compare '.length).trim();
      if (!canaryId) {
        await safeSendMessage(chatId, 'Format: /canary compare <id>', replyOpt);
        return true;
      }
      const comparison = opsSystem.canaryController.compareCanary(canaryId, services);
      if (!comparison.ok) {
        await safeSendMessage(chatId, `Gagal compare canary: ${comparison.reason}`, replyOpt);
        return true;
      }
      const text =
`Canary Comparison: ${comparison.canary.id}
Name: ${comparison.canary.name}
Status: ${comparison.canary.status}
Metrics: ${comparison.metricCount}
Average: ${comparison.average}
Baseline average: ${comparison.baselineAverage}
Delta: ${comparison.deltaVsBaseline}
Recommendation: ${comparison.recommendation}`;
      await sendChunkedMessage(chatId, text, replyOpt);
      return true;
    }
    if (raw.startsWith('promote ')) {
      const canaryId = raw.slice('promote '.length).trim();
      if (!canaryId) {
        await safeSendMessage(chatId, 'Format: /canary promote <id>', replyOpt);
        return true;
      }
      const result = opsSystem.canaryController.promoteCanary(canaryId, services);
      await safeSendMessage(chatId, result.ok ? `Canary dipromosikan manual: ${canaryId}` : `Promote ditolak: ${result.reason}`, replyOpt);
      return true;
    }
    const canaries = opsSystem.canaryController.listCanaries(services, 10);
    const text = canaries.length
      ? canaries.map((item, index) => `${index + 1}. ${item.id} - ${item.name} [${item.status}, ${item.rolloutPercent}%, metrics=${(item.metrics || []).length}]`).join('\n')
      : 'Belum ada canary. Buat: /canary create nama | deskripsi';
    await sendChunkedMessage(chatId, `Canary:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/opsreset' || cmd === '/ops-reset') {
    opsSystem.opsStore.resetOpsState(services);
    await safeSendMessage(chatId, 'Data AI Operations sudah direset. Data user, AI OS, memory lama, dan command lama tidak dihapus.', replyOpt);
    return true;
  }

  return false;
}

function getAiosServices() {
  return {
    aiOS,
    ensureUser,
    persist,
    storageManager
  };
}

function getOpsServices() {
  return {
    ensureUser,
    persist,
    autonomousEngine,
    aiOS,
    botSettings,
    aiCircuitBreaker,
    redisClient,
    storageManager,
    storageStatus: storageManager.getStorageStatus(),
    webhookStatus: WEBHOOK_URL || TELEGRAM_WEBHOOK_URL ? 'configured' : 'local',
    getRuntimeStatus: () => autonomousEngine.getRuntimeStatus(),
    env: {
      MISTRAL_API_KEY,
      GROQ_API_KEY,
      DATABASE_URL,
      STORAGE_DRIVER,
      REDIS_URL
    }
  };
}

function getInteractionServices() {
  return {
    telegramPost,
    safeSendMessage,
    sendChunkedMessage,
    sendStreamingAnswer,
    sendTelegramMessage: (chatId, text, extra = {}) => sendTelegramMessage({ telegramPost, logger: log }, chatId, text, extra),
    sendTelegramWithKeyboard: (chatId, text, keyboard, extra = {}) => sendTelegramWithKeyboard({ telegramPost, logger: log }, chatId, text, keyboard, extra),
    askAI,
    getSmartAnswer,
    getSystemPrompt,
    ensureUser,
    persist,
    opsSystem,
    getOpsServices,
    aiOS,
    isAdmin,
    processAIMessage,
    resetUserMemory: performUserReset,
    handleResetConfirmed,
    summarizeSearchWithRefs,
    getWeather,
    searchLocation,
    calculate,
    getCurrentTime,
    getCurrentDate
  };
}

function splitPipeArgs(args) {
  return String(args || '')
    .split('|')
    .map(part => part.trim());
}

function formatGoalLine(goal, index) {
  const pct = Math.round(aiOS.goalManager.normalizeProgressPercent?.(goal.progress) ?? ((goal.progress || 0) * 100));
  const next = goal.strategicReflection?.nextAction ? ` Next: ${goal.strategicReflection.nextAction}` : '';
  return `${index + 1}. ${goal.id} - ${goal.title} [${goal.status}, ${goal.priority}, ${pct}%]${next}`;
}

function formatWorkflowLine(workflow, index) {
  const done = (workflow.steps || []).filter(step => step.done).length;
  const next = workflow.nextAction ? ` Next: ${workflow.nextAction}` : '';
  const blockers = (workflow.blockers || []).filter(item => item.status === 'open').length;
  return `${index + 1}. ${workflow.id} - ${workflow.title} [${workflow.status}, ${done}/${(workflow.steps || []).length} step, blocker ${blockers}]${next}`;
}

function formatMemoryLine(memory, index) {
  const text = aiOS.utils?.compactText
    ? aiOS.utils.compactText(memory.content, 120)
    : String(memory.content || '').slice(0, 120);
  return `${index + 1}. ${memory.id} [${memory.type}] ${text}`;
}

function formatInsightLine(insight, index) {
  const text = aiOS.utils?.compactText
    ? aiOS.utils.compactText(insight.content || insight.text, 140)
    : String(insight.content || insight.text || '').slice(0, 140);
  return `${index + 1}. ${insight.id} - ${text} (${Number(insight.confidence || 0).toFixed(2)})`;
}

async function handleAiosCommands(chatId, userId, cmd, args, msg) {
  const services = getAiosServices();
  const replyOpt = { reply_to_message_id: msg.message_id };

  if (cmd === '/aios') {
    const u = ensureUser(userId);
    await Promise.allSettled([
      aiOS.unifiedMemory.hydrateMemoryFromStorage?.(userId, services),
      aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services),
      aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services),
      aiOS.insightStore.hydrateInsightsFromStorage?.(userId, services),
      aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services)
    ]);
    const memoryStats = aiOS.unifiedMemory.getMemoryStats(userId, services);
    const goalStats = aiOS.goalManager.calculateGoalStats(userId, services);
    const workflowStats = aiOS.workflowEngine.getWorkflowStats(userId, services);
    const insightStats = await aiOS.insightStore.getInsightStats(userId, services);
    const graphStats = aiOS.knowledgeGraph.getGraphStats(userId, services);
    const storage = storageManager.getStorageStatus();
    const adaptive = adaptiveSystem.status(u, getAiosStatusSafe(userId));
    const text =
`AI OS Status
Mode: ${u.mode}
Adaptive: ${adaptive.enabled ? 'on' : 'off'} (${adaptive.activeMode || '-'})
Storage: ${storage.driver}, Redis: ${storage.redisAvailable ? 'on' : 'memory/local'}
Memory: ${memoryStats.total}
Goals aktif: ${goalStats.active}/${goalStats.total}
Workflows aktif: ${workflowStats.active}/${workflowStats.total}
Insights: ${insightStats.total}
Graph: ${graphStats.nodes} node, ${graphStats.edges} edge
Workflow completion: ${Math.round((workflowStats.completionRatio || 0) * 100)}%`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/memory') {
    const memories = await aiOS.unifiedMemory.listMemories(userId, { limit: 10 }, services);
    const text = memories.length
      ? memories.map(formatMemoryLine).join('\n')
      : 'Belum ada memory AI OS. Simpan dengan /remember <teks>.';
    await sendChunkedMessage(chatId, `Memory terbaru:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/remember') {
    const guard = aiOS.guards.preventHugeInput(args || '');
    if (!guard.ok) {
      await safeSendMessage(chatId, guard.reason, replyOpt);
      return true;
    }
    const content = String(args || '').trim();
    if (!content) {
      await safeSendMessage(chatId, 'Format: /remember <teks yang ingin disimpan>', replyOpt);
      return true;
    }
    const result = await aiOS.unifiedMemory.createMemory(userId, {
      type: 'semantic',
      content,
      source: 'user',
      tags: ['manual'],
      confidence: 0.85,
      importance: 0.72
    }, services);
    if (result.ok) {
      await aiOS.insightStore.createInsight(userId, {
        type: 'memory',
        content,
        source: 'remember-command',
        relatedConcepts: ['manual-memory'],
        confidence: 0.75,
        importance: 0.62
      }, services);
      aiOS.knowledgeGraph.evolveGraphFromText(userId, content, services, {
        source: 'remember-command',
        confidence: 0.72,
        maxConcepts: 5
      });
    }
    await safeSendMessage(
      chatId,
      result.ok ? `Memory disimpan:\n${result.memory.id}` : `Gagal menyimpan memory: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/forget') {
    const memoryId = String(args || '').trim();
    if (!memoryId) {
      await safeSendMessage(chatId, 'Format: /forget <memoryId>', replyOpt);
      return true;
    }
    const result = await aiOS.unifiedMemory.deleteMemory(userId, memoryId, services);
    await safeSendMessage(
      chatId,
      result.ok ? `Memory dihapus: ${memoryId}` : `Gagal menghapus memory: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/goals') {
    await aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services);
    const goals = aiOS.goalManager.listGoals(userId, {}, services);
    const text = goals.length
      ? goals.map(formatGoalLine).join('\n')
      : 'Belum ada goal AI OS. Buat dengan /goaladd judul | deskripsi | prioritas | targetDate';
    await sendChunkedMessage(chatId, `Goals:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/goaladd') {
    const [title, description = '', priority = 'medium', targetDate = ''] = splitPipeArgs(args);
    if (!title) {
      await safeSendMessage(chatId, 'Format: /goaladd <judul> | <deskripsi> | <prioritas> | <targetDate optional>', replyOpt);
      return true;
    }
    const result = aiOS.goalManager.createGoal(userId, { title, description, priority, targetDate }, services);
    if (result.ok) {
      aiOS.knowledgeGraph.evolveGraphFromText(userId, `Goal ${result.goal.title}. ${result.goal.description}`, services, {
        source: 'goal-command',
        confidence: 0.78,
        maxConcepts: 5
      });
    }
    await safeSendMessage(
      chatId,
      result.ok
        ? `Goal ditambahkan:\n${formatGoalLine(result.goal, 0)}`
        : `Gagal menambah goal: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/goalupdate') {
    const [goalId, field, value] = splitPipeArgs(args);
    if (!goalId || !field || value === undefined) {
      await safeSendMessage(chatId, 'Format: /goalupdate <goalId> | <status/progress/description/priority/target> | <value>', replyOpt);
      return true;
    }
    await aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services);
    const result = aiOS.goalManager.updateGoal(userId, goalId, field, value, services);
    await safeSendMessage(
      chatId,
      result.ok
        ? `Goal diperbarui:\n${formatGoalLine(result.goal, 0)}`
        : `Gagal update goal: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflows') {
    await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
    const workflows = aiOS.workflowEngine.listActiveWorkflows(userId, services, 20);
    const text = workflows.length
      ? workflows.map(formatWorkflowLine).join('\n')
      : 'Belum ada workflow aktif. Buat dengan /workflowadd judul | deskripsi | goalId optional';
    await sendChunkedMessage(chatId, `Workflow aktif:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/workflowadd') {
    const [title, description = '', goalId = ''] = splitPipeArgs(args);
    if (!title) {
      await safeSendMessage(chatId, 'Format: /workflowadd <judul> | <deskripsi> | <goalId optional>', replyOpt);
      return true;
    }
    const result = aiOS.workflowEngine.createWorkflow(userId, { title, description, goalId }, services);
    if (result.ok) {
      aiOS.knowledgeGraph.evolveGraphFromText(userId, `Workflow ${result.workflow.title}. ${result.workflow.description}`, services, {
        source: 'workflow-command',
        confidence: 0.76,
        maxConcepts: 5
      });
    }
    await safeSendMessage(
      chatId,
      result.ok
        ? `Workflow dibuat:\n${formatWorkflowLine(result.workflow, 0)}`
        : `Gagal membuat workflow: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflowstep') {
    const [workflowId, step] = splitPipeArgs(args);
    if (!workflowId || !step) {
      await safeSendMessage(chatId, 'Format: /workflowstep <workflowId> | <step>', replyOpt);
      return true;
    }
    await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
    const result = aiOS.workflowEngine.addStep(userId, workflowId, step, services);
    await safeSendMessage(
      chatId,
      result.ok
        ? `Step ${result.stepNumber} ditambahkan ke workflow ${workflowId}.`
        : `Gagal menambah step: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflowdone') {
    const [workflowId, stepNumber] = splitPipeArgs(args);
    if (!workflowId || !stepNumber) {
      await safeSendMessage(chatId, 'Format: /workflowdone <workflowId> | <stepNumber>', replyOpt);
      return true;
    }
    await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
    const result = aiOS.workflowEngine.markStepDone(userId, workflowId, stepNumber, services);
    await safeSendMessage(
      chatId,
      result.ok
        ? `Step selesai: ${result.step.text || result.step.title}`
        : `Gagal menandai step: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflowdecision') {
    const [workflowId, decision] = splitPipeArgs(args);
    if (!workflowId || !decision) {
      await safeSendMessage(chatId, 'Format: /workflowdecision <workflowId> | <decision>', replyOpt);
      return true;
    }
    const result = aiOS.workflowEngine.addDecision(userId, workflowId, decision, services);
    await safeSendMessage(
      chatId,
      result.ok ? 'Decision log workflow tersimpan.' : `Gagal menyimpan decision: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflowblocker') {
    const [workflowId, blocker] = splitPipeArgs(args);
    if (!workflowId || !blocker) {
      await safeSendMessage(chatId, 'Format: /workflowblocker <workflowId> | <blocker>', replyOpt);
      return true;
    }
    const result = aiOS.workflowEngine.addBlocker(userId, workflowId, blocker, services);
    await safeSendMessage(
      chatId,
      result.ok ? 'Blocker workflow tersimpan.' : `Gagal menyimpan blocker: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/workflownext') {
    const [workflowId, nextAction] = splitPipeArgs(args);
    if (!workflowId || !nextAction) {
      await safeSendMessage(chatId, 'Format: /workflownext <workflowId> | <next action>', replyOpt);
      return true;
    }
    const result = aiOS.workflowEngine.setNextAction(userId, workflowId, nextAction, services);
    await safeSendMessage(
      chatId,
      result.ok ? `Next action disimpan: ${result.workflow.nextAction}` : `Gagal menyimpan next action: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/graph') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const graph = aiOS.knowledgeGraph.summarizeGraph(userId, services, args);
    const text =
`Knowledge Graph
Node: ${graph.nodeCount}
Edge: ${graph.edgeCount}
Types: ${graph.typeSummary}

Konsep:
${graph.nodesText}

Relasi:
${graph.edgesText}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/insights') {
    const insights = await aiOS.insightStore.listInsights(userId, { limit: 10 }, services);
    const text = insights.length
      ? insights.map(formatInsightLine).join('\n')
      : 'Belum ada insight AI OS.';
    await sendChunkedMessage(chatId, `Insight penting:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/workspace') {
    const workspaces = aiOS.cognitiveWorkspace.listWorkspaces(userId, services, 10);
    const active = aiOS.cognitiveWorkspace.getActiveWorkspace(userId, services);
    const text = workspaces.length
      ? [
        `Aktif: ${active ? `${active.id} - ${active.title}` : '-'}`,
        '',
        ...workspaces.map((workspace, index) => `${index + 1}. ${workspace.id} - ${workspace.title} (${(workspace.notes || []).length} catatan)`)
      ].join('\n')
      : 'Belum ada cognitive workspace. Buat dengan /workspaceadd judul | deskripsi';
    await sendChunkedMessage(chatId, `Cognitive Workspace:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/workspaceadd') {
    const [title, description = ''] = splitPipeArgs(args);
    if (!title) {
      await safeSendMessage(chatId, 'Format: /workspaceadd <judul> | <deskripsi>', replyOpt);
      return true;
    }
    const result = aiOS.cognitiveWorkspace.createWorkspace(userId, { title, description }, services);
    await safeSendMessage(
      chatId,
      result.ok
        ? `Workspace dibuat: ${result.workspace.id} - ${result.workspace.title}`
        : `Gagal membuat workspace: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/reflect') {
    const topic = String(args || '').trim();
    if (!topic) {
      await safeSendMessage(chatId, 'Format: /reflect <teks atau topik>', replyOpt);
      return true;
    }
    const context = await aiOS.contextSync.buildAIOSContext(userId, topic, services);
    const analysis = aiOS.strategicReasoning.analyzeGoal(topic, context);
    const reflection = aiOS.reflectionEngine.storeReflectionMemory(userId, {
      question: topic,
      insight: analysis.nextActions[0] || topic,
      quality: analysis.confidence,
      confidence: analysis.confidence,
      risks: analysis.risks
    }, services);
    const text =
`Reflection
Confidence: ${analysis.confidence.toFixed(2)}
Asumsi:
${analysis.assumptions.map(item => `- ${item}`).join('\n')}

Risiko:
${analysis.risks.map(item => `- ${item}`).join('\n')}

Improvement:
${aiOS.reflectionEngine.suggestImprovement({ answerQuality: analysis.confidence, clarity: 0.7, risk: 0.35 }, analysis.risks).map(item => `- ${item}`).join('\n')}

Tersimpan: ${reflection.ok ? 'ya' : 'tidak'}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/strategy') {
    const topic = String(args || '').trim();
    if (!topic) {
      await safeSendMessage(chatId, 'Format: /strategy <goal atau masalah>', replyOpt);
      return true;
    }
    const context = await aiOS.contextSync.buildAIOSContext(userId, topic, services);
    const analysis = aiOS.strategicReasoning.analyzeGoal(topic, context);
    aiOS.memoryBus.publishInsight(userId, `Strategic insight: ${analysis.recommendation}`, services, {
      source: 'strategy-command',
      confidence: analysis.confidence,
      importance: 0.74,
      tags: ['strategy', 'decision']
    });
    await aiOS.insightStore.createInsight(userId, {
      type: 'strategic',
      content: analysis.recommendation,
      source: 'strategy-command',
      relatedConcepts: ['strategy', 'decision'],
      confidence: analysis.confidence,
      importance: 0.74
    }, services);
    await sendChunkedMessage(chatId, aiOS.strategicReasoning.formatStrategicAnalysis(analysis), replyOpt);
    return true;
  }

  if (cmd === '/aios-reset') {
    aiOS.resetUserData(userId, services);
    await safeSendMessage(chatId, 'AI OS data untuk user ini sudah direset. Memory lama bot tidak ikut dihapus.', replyOpt);
    return true;
  }

  return false;
}

function getAiosStatusSafe(userId) {
  try {
    return aiOS.getStatus(userId, getAiosServices());
  } catch (_) {
    return {};
  }
}

function detectAdaptiveModeForMessage(userId, userText, command, msg) {
  const u = ensureUser(userId);
  return adaptiveSystem.route({
    text: userText,
    command,
    user: u,
    aiOSStatus: getAiosStatusSafe(userId),
    hasAttachment: Boolean(msg?.photo || msg?.document || msg?.voice)
  }, {
    ensureUser,
    persist
  });
}

function shouldHydrateAIOSForMessage(userText = '', adaptiveDecision = {}) {
  const text = String(userText || '').toLowerCase();
  if (['strategic', 'decision', 'learning', 'reflection', 'research', 'personal-intelligence', 'cognitive-workspace'].includes(adaptiveDecision?.mode)) {
    return true;
  }
  return /(goal|tujuan|workflow|alur kerja|memory|memori|ingat|project|proyek|roadmap|strategi|lanjut|langkah berikut|next action|keputusan|insight|graph|workspace)/i.test(text);
}

async function hydrateAIOSForMessageSafe(userId, userText, adaptiveDecision) {
  if (!shouldHydrateAIOSForMessage(userText, adaptiveDecision)) return false;
  const services = getAiosServices();
  try {
    await Promise.allSettled([
      aiOS.unifiedMemory.hydrateMemoryFromStorage?.(userId, services),
      aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services),
      aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services),
      aiOS.insightStore.hydrateInsightsFromStorage?.(userId, services),
      aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services)
    ]);
    return true;
  } catch (err) {
    log.warn('AI OS hydrate skipped:', err.message);
    return false;
  }
}

function prepareConversationStateSafe(userId, chatId, userText, command, msg) {
  try {
    return conversationManager.prepare({
      userId,
      chatId,
      text: userText,
      command,
      msg
    });
  } catch (err) {
    log.warn('Conversation layer fallback:', err.message);
    return {
      action: 'normal',
      reason: 'conversation_layer_failed',
      promptContext: '',
      instruction: 'Jawab pesan user secara natural. Conversation layer sedang fallback, jadi jangan mengandalkan pending action internal.'
    };
  }
}

function recordConversationReplySafe(input = {}) {
  try {
    return conversationManager.recordBotReply(input);
  } catch (err) {
    log.warn('Conversation reply record skipped:', err.message);
    return null;
  }
}

function buildNaturalChatPrompt(userText, conversationState, route) {
  const context = [
    conversationState?.promptContext ? `Konteks percakapan:\n${conversationState.promptContext}` : '',
    conversationState?.instruction ? `Instruksi follow-up:\n${conversationState.instruction}` : '',
    route?.normalizedText && route.normalizedText !== userText ? `Normalisasi routing: ${route.normalizedText}` : ''
  ].filter(Boolean).join('\n\n');

  return [
    context,
    'Jawab seperti asisten AI umum yang ramah, natural, dan membantu.',
    'Jika pesan user berupa keluhan, tanggapi dengan empati.',
    'Jika tidak yakin, minta klarifikasi singkat.',
    'Jangan mengulang jawaban lama; lanjutkan konteks jika user sedang follow-up.',
    '',
    `Pesan user asli:\n${userText}`
  ].filter(Boolean).join('\n\n');
}

async function askGeneralNaturalChat(userId, userText, conversationState, route) {
  const systemPrompt = [
    getSystemPrompt(userId),
    'Kamu sedang berada di jalur fallback natural language.',
    'Prioritaskan jawaban langsung, hangat, dan relevan seperti AI assistant umum.',
    'Untuk follow-up pendek seperti "kenapa?" atau "maksudnya?", gunakan konteks percakapan terakhir.'
  ].join('\n\n');

  return askAI(
    systemPrompt,
    buildNaturalChatPrompt(userText, conversationState, route),
    {
      userId,
      question: `natural:${userText}`,
      allowSearch: true,
      allowCache: false,
      temperature: 0.55,
      maxTokens: 900
    }
  );
}

async function sendNaturalLanguageAnswer(chatId, userId, userText, msg, answer, intent) {
  const finalAnswer = personalityResponse(
    ensureUser(userId).mode,
    humanAISafety.applyHumanJudgmentFooter(sanitizeOutgoingText(answer), userText)
  );

  let interactionExtra = {};
  try {
    const interactive = await interactions.manager.buildInteractiveResponse({
      userId,
      chatId,
      userText,
      answerText: finalAnswer,
      mode: ensureUser(userId).mode,
      intent
    });
    if (interactive?.reply_markup) {
      interactionExtra.reply_markup = interactive.reply_markup;
    }
  } catch (err) {
    log.warn('Natural interaction keyboard skipped:', err.message);
  }

  await sendStreamingAnswer(chatId, finalAnswer, {
    reply_to_message_id: msg.message_id,
    disable_web_page_preview: true,
    ...interactionExtra
  });

  pushChatHistory({
    userId,
    chatId,
    role: 'assistant',
    text: finalAnswer,
    timestamp: nowMs()
  });
  await saveConversationPair(userId, userText, finalAnswer);
  await rememberImportantFact(userId, userText);
  await autoLearn(userText, finalAnswer);
  recordConversationReplySafe({
    userId,
    chatId,
    userText,
    botText: finalAnswer,
    intent
  });
  return finalAnswer;
}

async function handleNaturalLanguageRoute(chatId, userId, userText, msg, conversationState) {
  try {
    const route = naturalLanguage.detectNaturalIntent(userText, { conversationState });
    logMessageFlow('natural_route_detected', {
      userId,
      chatId,
      intent: route.intent,
      confidence: route.confidence,
      text: route.normalizedText
    });

    if (route.intent === 'UNIT_CONVERSION') {
      return sendNaturalLanguageAnswer(chatId, userId, userText, msg, route.conversion.answer, route.intent);
    }

    if (route.intent === 'MATH_CALCULATION') {
      return sendNaturalLanguageAnswer(chatId, userId, userText, msg, calculate(route.expression), 'HITUNG');
    }

    if (route.intent === 'HEALTH_ADVICE') {
      return sendNaturalLanguageAnswer(chatId, userId, userText, msg, naturalLanguage.buildHealthAdvice(userText), route.intent);
    }

    if (['FOLLOW_UP', 'EXPLANATION_REQUEST', 'EMOTIONAL_SUPPORT'].includes(route.intent)) {
      const answer = await askGeneralNaturalChat(userId, userText, conversationState, route);
      return sendNaturalLanguageAnswer(chatId, userId, userText, msg, answer, route.intent);
    }
  } catch (err) {
    log.warn('Natural language route fallback:', err.message);
    return sendNaturalLanguageAnswer(
      chatId,
      userId,
      userText,
      msg,
      'Maaf, aku sempat gagal memahami pesanmu. Bisa kirim ulang atau jelaskan sedikit lagi?',
      'NATURAL_ROUTE_ERROR'
    );
  }

  return null;
}

function logMessageFlow(stage, data = {}) {
  const payload = {
    ...data,
    text: data.text ? String(data.text).slice(0, 180) : undefined,
    answerPreview: data.answerPreview ? String(data.answerPreview).slice(0, 180) : undefined
  };
  log.info(`message_flow:${stage}`, payload);
}

function isPlainGreetingInput(text) {
  const lower = safeLower(text)
    .replace(/[.!?😊🙏]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    'halo',
    'hai',
    'hi',
    'hello',
    'pagi',
    'siang',
    'sore',
    'malam',
    'assalamualaikum'
  ].includes(lower);
}

function isSubstantiveUserMessage(text) {
  const clean = String(text || '').trim();
  if (!clean || isPlainGreetingInput(clean)) return false;
  if (clean.length >= 18) return true;
  return /(jelaskan|spesifikasi|buatkan|kode|coding|analisis|kenapa|bagaimana|iphone|xiaomi|next\.?js|login|\?)/i.test(clean);
}

function looksLikeDefaultGreeting(answer) {
  const lower = safeLower(answer)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!lower) return false;
  if (lower.includes('ada yang bisa saya bantu')) return true;
  if (lower.includes('ada yang bisa aku bantu')) return true;
  if (lower.includes('apa yang bisa saya bantu')) return true;
  if (lower.includes('how can i help')) return true;
  return lower.startsWith('halo') && lower.length <= 90 && lower.includes('bantu');
}

function looksLikeNonAnswer(answer) {
  const lower = safeLower(answer)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    'aku belum bisa menjawab itu',
    'saya belum bisa menjawab itu',
    'aku tidak bisa menjawab itu',
    'saya tidak bisa menjawab itu'
  ].some(phrase => lower.includes(phrase));
}

function shouldRejectGenericGreeting(answer, userText) {
  return isSubstantiveUserMessage(userText) && (looksLikeDefaultGreeting(answer) || looksLikeNonAnswer(answer));
}

async function handleAdaptiveCommands(chatId, userId, cmd, args, msg) {
  if (cmd !== '/adaptive') return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  const u = ensureUser(userId);
  const action = safeLower(args).trim() || 'status';

  if (action === 'on') {
    u.adaptive.enabled = true;
    u.manualModeOverride = false;
    u.mode = 'auto';
    await persist();
    await safeSendMessage(chatId, 'Adaptive mode aktif. Bot akan memilih mode otomatis untuk pesan natural.', replyOpt);
    return true;
  }

  if (action === 'off') {
    u.adaptive.enabled = false;
    u.adaptive.activeMode = null;
    await persist();
    await safeSendMessage(chatId, 'Adaptive mode dimatikan. Gunakan /mode untuk memilih mode manual.', replyOpt);
    return true;
  }

  if (action === 'reset') {
    adaptiveSystem.reset(u);
    await persist();
    await safeSendMessage(chatId, 'Adaptive profile direset. Mode kembali ke auto.', replyOpt);
    return true;
  }

  if (action !== 'status') {
    await safeSendMessage(chatId, 'Format: /adaptive | /adaptive status | /adaptive on | /adaptive off | /adaptive reset', replyOpt);
    return true;
  }

  const status = adaptiveSystem.status(u, getAiosStatusSafe(userId));
  const text =
`Adaptive Mode
Enabled: ${status.enabled ? 'ya' : 'tidak'}
Manual override: ${status.manualModeOverride ? 'ya' : 'tidak'}
Current mode: ${status.currentMode}
Active adaptive mode: ${status.activeMode || '-'}
Last reason: ${status.lastReason}
Last confidence: ${Number(status.lastConfidence || 0).toFixed(2)}
Active goals/workflows: ${status.activeGoals}/${status.activeWorkflows}

Priority:
1. Safety/governance
2. Explicit command
3. Manual /mode override
4. Adaptive auto mode
5. Default simple assistant`;
  await sendChunkedMessage(chatId, text, replyOpt);
  return true;
}

async function handleCollaborationCommands(chatId, userId, cmd, args, msg) {
  if (!collaborationSystem.commands.has(cmd)) return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  const u = ensureUser(userId);
  const needsText = !['/journal', '/collab', '/collab-reset'].includes(cmd);
  if (needsText && !String(args || '').trim()) {
    await safeSendMessage(chatId, `Format: ${cmd} <topik atau masalah>`, replyOpt);
    return true;
  }
  try {
    const response = await collaborationSystem.respond(cmd, args, userId, u, getAiosServices());
    await persist();
    await sendChunkedMessage(chatId, response, replyOpt);
  } catch (err) {
    log.warn('Collaboration command fallback:', err.message);
    const fallback = await askAI(
      getSystemPrompt(userId),
      `Jawab sebagai thinking partner yang ringkas dan aman. Command: ${cmd}\nTopik: ${args || '-'}`,
      {
        userId,
        question: `collaboration-fallback:${cmd}:${args || ''}`,
        allowSearch: false,
        allowCache: false,
        temperature: 0.45,
        maxTokens: 700
      }
    );
    await sendChunkedMessage(chatId, fallback || 'Maaf, collaboration module sedang fallback. Coba jelaskan topiknya sekali lagi.', replyOpt);
  }
  return true;
}

async function handleFeedback(chatId, msg) {
  const last = abLog
    .slice(-5)
    .map(l => `${l.style}: ${String(l.question || '').slice(0, 30)}...`)
    .join('\n');

  await safeSendMessage(
    chatId,
    `Feedback terakhir:\n${last || 'Belum ada'}`,
    {
      reply_to_message_id: msg.message_id
    }
  );
}

async function handleImage(chatId, args, msg) {
  const prompt = args.trim();

  if (!prompt) {
    await safeSendMessage(
      chatId,
      'Tulis deskripsi gambarnya dulu.',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return;
  }

  const img = await generateImage(prompt);

  const ok = await sendPhotoUrl(
    chatId,
    img,
    `✨ ${prompt}`
  );

  if (!ok) {
    await safeSendMessage(
      chatId,
      '❌ Gagal membuat gambar.',
      {
        reply_to_message_id: msg.message_id
      }
    );
  }
}

async function handleAuth(chatId, userId, msg) {
  if (msg.chat.type !== 'private') {
    await safeSendMessage(
      chatId,
      'Gunakan /auth di chat pribadi.',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return;
  }

  if (
    !googleLib ||
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI
  ) {
    await safeSendMessage(
      chatId,
      '❌ Google Calendar belum dikonfigurasi.',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return;
  }

  const authUrl = getAuthUrl(userId);

  if (!authUrl) {
    await safeSendMessage(
      chatId,
      '❌ Gagal membuat link autentikasi.',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return;
  }

  await safeSendMessage(
    chatId,
    `🔐 Klik tautan:\n${authUrl}`,
    {
      reply_to_message_id: msg.message_id
    }
  );
}
// =====================================================
// PART 6
// =====================================================

async function handleAddEvent(chatId, userId, args, msg) {
  const calendar = await getCalendarClient(userId);

  if (!calendar) {
    await safeSendMessage(
      chatId,
      '❌ Belum autentikasi. Gunakan /auth dulu.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return;
  }

  const parts = args.split('|');

  if (parts.length < 3) {
    await safeSendMessage(
      chatId,
      'Format: /addevent Judul | YYYY-MM-DD HH:MM | YYYY-MM-DD HH:MM',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return;
  }

  const summary = parts[0].trim();
  const startDateTime = parseFlexibleDateTime(parts[1].trim(), '09:00');
  const endDateTime = parseFlexibleDateTime(parts[2].trim(), '10:00');

  if (!isValidDate(startDateTime) || !isValidDate(endDateTime)) {
    await safeSendMessage(
      chatId,
      'Format tanggal/waktu salah.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return;
  }

  try {
    await calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Asia/Jakarta'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Asia/Jakarta'
        }
      }
    });

    await safeSendMessage(
      chatId,
      `✅ Event "${summary}" ditambahkan ke Google Calendar.`,
      {
        reply_to_message_id: msg.message_id
      }
    );
  } catch (err) {
    console.error(err.response?.data || err.message);

    await safeSendMessage(
      chatId,
      '❌ Gagal menambahkan event.',
      {
        reply_to_message_id: msg.message_id
      }
    );
  }
}

async function handleMood(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);
  cleanupStaleUserState(u);

  if (cmd === '/mood') {
    await safeSendMessage(
      chatId,
      'Apa kabarmu hari ini? (senang/biasa/sedih/cemas/energik)',
      {
        reply_to_message_id: msg.message_id
      }
    );

    u.awaitingMood = true;
    u.awaitingMoodAt = nowMs();

    await persist();
    return true;
  }

  if (u.awaitingMood && !cmd) {
    const mood = safeLower(msg.text || args).trim();
    const valid = ['senang', 'biasa', 'sedih', 'cemas', 'energik'];

    if (valid.includes(mood)) {
      u.mood = mood;
      u.lastMoodUpdate = nowMs();
      delete u.awaitingMood;
      delete u.awaitingMoodAt;

      await persist();

      await safeSendMessage(
        chatId,
        `Terima kasih! Suasana hatimu "${mood}" tercatat.`,
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      await safeSendMessage(
        chatId,
        'Pilihan: senang, biasa, sedih, cemas, energik.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  return false;
}

async function scheduleReminderFromParams(chatId, userId, message, timeValue, msg) {
  const u = ensureUser(userId);

  if (!message || !timeValue) {
    await safeSendMessage(
      chatId,
      '❌ Pesan atau waktu pengingat belum lengkap.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  const reminderDate = parseFlexibleDateTime(timeValue, '09:00');

  if (!isValidDate(reminderDate) || reminderDate <= new Date()) {
    await safeSendMessage(
      chatId,
      '❌ Waktu pengingat tidak valid.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  const reminder = {
    id: String(nowMs()),
    chatId,
    time: reminderDate.toISOString(),
    message
  };

  u.reminders.push(reminder);

  const scheduled = scheduleReminderJob(userId, reminder);

  await persist();

  if (!scheduled) {
    await safeSendMessage(
      chatId,
      '⚠️ Pengingat tersimpan, tetapi scheduler tidak aktif di server ini.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  await safeSendMessage(
    chatId,
    `✅ Pengingat dijadwalkan pada ${reminderDate.toString()}`,
    {
      reply_to_message_id: msg.message_id
    }
  );

  return true;
}

async function handleReminder(chatId, userId, cmd, args, msg) {
  if (cmd !== '/remind') {
    return false;
  }

  const data = parseReminderFromArgs(args);

  if (!data) {
    await safeSendMessage(
      chatId,
      'Format: /remind YYYY-MM-DD HH:MM pesan',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  const datetime = parseJakartaDateTime(data.dateStr, data.timeStr);

  if (!isValidDate(datetime) || datetime <= new Date()) {
    await safeSendMessage(
      chatId,
      'Tanggal/waktu tidak valid atau sudah lewat.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  const u = ensureUser(userId);
  const reminder = {
    id: String(nowMs()),
    chatId,
    time: datetime.toISOString(),
    message: data.message
  };

  u.reminders.push(reminder);

  const scheduled = scheduleReminderJob(userId, reminder);

  await persist();

  if (!scheduled) {
    await safeSendMessage(
      chatId,
      '⚠️ Pengingat tersimpan, tetapi scheduler tidak aktif di server ini.',
      {
        reply_to_message_id: msg.message_id
      }
    );
    return true;
  }

  await safeSendMessage(
    chatId,
    `✅ Pengingat dijadwalkan pada ${datetime.toString()}`,
    {
      reply_to_message_id: msg.message_id
    }
  );

  return true;
}

async function handleTodo(chatId, userId, cmd, args, msg) {
  const u = ensureUser(userId);

  if (cmd === '/todo') {
    const tasks = u.todos || [];

    if (tasks.length === 0) {
      await safeSendMessage(
        chatId,
        '📝 Daftar tugas kosong. Gunakan /add <tugas>',
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      const list = tasks.map((t, i) => `${i + 1}. ${t.done ? '✅' : '❌'} ${t.text}`).join('\n');

      await sendChunkedMessage(
        chatId,
        `📋 To-Do List:\n${list}`,
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  if (cmd === '/add') {
    const taskText = args.trim();

    if (!taskText) {
      await safeSendMessage(
        chatId,
        'Isi tugasnya dulu.',
        {
          reply_to_message_id: msg.message_id
        }
      );
      return true;
    }

    u.todos.push({
      text: taskText,
      done: false,
      createdAt: nowMs()
    });

    await persist();

    await safeSendMessage(
      chatId,
      `✅ Tugas "${taskText}" ditambahkan.`,
      {
        reply_to_message_id: msg.message_id
      }
    );

    return true;
  }

  if (cmd === '/done') {
    const idx = parseInt(args, 10) - 1;

    if (!u.todos || Number.isNaN(idx) || idx < 0 || idx >= u.todos.length) {
      await safeSendMessage(
        chatId,
        'Nomor tugas tidak valid.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    } else {
      u.todos[idx].done = true;

      await persist();

      await safeSendMessage(
        chatId,
        `✅ Tugas "${u.todos[idx].text}" selesai.`,
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  if (cmd === '/cleartodo') {
    u.todos = [];

    await persist();

    await safeSendMessage(
      chatId,
      '🗑️ Semua tugas dihapus.',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return true;
  }

  return false;
}

async function handleQuizPoll(chatId, cmd, args, msg) {
  if (cmd === '/quiz') {
    const question = args.trim();

    if (!question) {
      await safeSendMessage(
        chatId,
        'Ketik pertanyaan kuisnya dulu.',
        {
          reply_to_message_id: msg.message_id
        }
      );
      return true;
    }

    quizState[chatId] = {
      type: 'quiz',
      question,
      createdAt: nowMs()
    };

    await safeSendMessage(
      chatId,
      'Kirim opsi jawaban (pisahkan dengan koma):',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return true;
  }

  if (cmd === '/poll') {
    const question = args.trim();

    if (!question) {
      await safeSendMessage(
        chatId,
        'Ketik pertanyaan pollingnya dulu.',
        {
          reply_to_message_id: msg.message_id
        }
      );
      return true;
    }

    quizState[chatId] = {
      type: 'poll',
      question,
      createdAt: nowMs()
    };

    await safeSendMessage(
      chatId,
      'Kirim opsi polling (pisahkan dengan koma):',
      {
        reply_to_message_id: msg.message_id
      }
    );

    return true;
  }

  if (quizState[chatId] && !cmd) {
    const state = quizState[chatId];
    const options = String(msg.text || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    if (options.length < 2) {
      await safeSendMessage(
        chatId,
        'Minimal 2 opsi.',
        {
          reply_to_message_id: msg.message_id
        }
      );

      delete quizState[chatId];
      return true;
    }

    if (options.length > 10) {
      await safeSendMessage(
        chatId,
        'Maksimal 10 opsi.',
        {
          reply_to_message_id: msg.message_id
        }
      );

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
  if (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
    return false;
  }

  if (!isAdmin(msg.from?.id)) {
    return false;
  }

  if (cmd === '/kick' && msg.reply_to_message) {
    try {
      await telegramPost('banChatMember', {
        chat_id: chatId,
        user_id: msg.reply_to_message.from.id
      });

      await safeSendMessage(
        chatId,
        `User ${msg.reply_to_message.from.first_name} dikeluarkan.`,
        {
          reply_to_message_id: msg.message_id
        }
      );
    } catch (_) {
      await safeSendMessage(
        chatId,
        'Gagal mengeluarkan user. Pastikan bot punya izin admin.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  if (cmd === '/pin' && msg.reply_to_message) {
    try {
      await telegramPost('pinChatMessage', {
        chat_id: chatId,
        message_id: msg.reply_to_message.message_id
      });

      await safeSendMessage(
        chatId,
        'Pesan disematkan.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    } catch (_) {
      await safeSendMessage(
        chatId,
        'Gagal pin pesan. Pastikan bot punya izin admin.',
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    return true;
  }

  return false;
}

// =====================================================
// PART 7
// =====================================================

async function handleImageEdit(chatId, cmd, args, msg) {
  if (cmd === '/resize' && msg.reply_to_message?.photo) {
    if (!sharpLib) {
      await safeSendMessage(
        chatId,
        'Fitur resize belum aktif karena package sharp belum terpasang.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    const size = args.toLowerCase().split('x');

    if (size.length !== 2) {
      await safeSendMessage(
        chatId,
        'Format: /resize widthxheight (balas foto)',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    const width = parseInt(size[0], 10);
    const height = parseInt(size[1], 10);

    if (Number.isNaN(width) || Number.isNaN(height) || width < 1 || height < 1) {
      await safeSendMessage(
        chatId,
        'Lebar/tinggi tidak valid.',
        { reply_to_message_id: msg.message_id }
      );
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
      await safeSendMessage(
        chatId,
        'Gagal memproses gambar.',
        { reply_to_message_id: msg.message_id }
      );
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

async function handleKnowledge(chatId, userId, cmd, args, msg) {
  if (cmd === '/learn') {
    const content = args.trim();

    if (!content) {
      await safeSendMessage(
        chatId,
        'Isi pengetahuan yang mau disimpan.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    knowledgeBase.push({
      content,
      timestamp: nowMs()
    });

    if (knowledgeBase.length > botSettings.maxKnowledge) {
      knowledgeBase.shift();
    }

    await persist();

    await safeSendMessage(
      chatId,
      '✅ Pengetahuan ditambahkan.',
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  if (cmd === '/askkb') {
    const query = args.trim().toLowerCase();

    if (!query) {
      await safeSendMessage(
        chatId,
        'Tulis pertanyaannya.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    const relevant = knowledgeBase.filter(k =>
      String(k.content || '').toLowerCase().includes(query)
    );

    if (relevant.length === 0) {
      await safeSendMessage(
        chatId,
        'Tidak ada informasi terkait.',
        { reply_to_message_id: msg.message_id }
      );
    } else {
      const answer = relevant
        .slice(-3)
        .map(k => `- ${k.content}`)
        .join('\n\n');

      await sendChunkedMessage(
        chatId,
        `📚 Basis Pengetahuan:\n${answer}`,
        { reply_to_message_id: msg.message_id }
      );
    }

    return true;
  }

  return false;
}

async function handleMode(chatId, userId, cmd, args, msg) {
  if (cmd !== '/mode') {
    return false;
  }

  const u = ensureUser(userId);
  const mode = safeLower(args).trim();

  const modeAliases = {
    simple: 'simple',
    coding: 'coding',
    health: 'health',
    ops: 'ops',
    decision: 'decision',
    reflection: 'reflection',
    strategic: 'strategic',
    learning: 'belajar',
    critical: 'kritis',
    research: 'riset',
    'self-reflection': 'refleksi',
    analysis: 'deep',
    'deep-analysis': 'deep',
    optimization: 'optimasi',
    collaborative: 'kolaborasi',
    'collaborative-thinking': 'kolaborasi',
    'research-intelligence': 'research-intelligence',
    'mentor-intelligence': 'mentor-intelligence',
    'strategic-planning': 'strategis',
    'system-analysis': 'system-analysis',
    'analisis-sistem': 'system-analysis',
    document: 'document-analysis',
    dokumen: 'document-analysis',
    'document-analysis': 'document-analysis',
    visual: 'visual-analysis',
    gambar: 'visual-analysis',
    'visual-analysis': 'visual-analysis',
    data: 'data-understanding',
    spreadsheet: 'data-understanding',
    'data-understanding': 'data-understanding',
    multimodal: 'cross-modal',
    'cross-modal-reasoning': 'cross-modal',
    'cross-modal': 'cross-modal',
    'research-file': 'research-file',
    'riset-file': 'research-file',
    safe: 'safe-mode',
    aman: 'safe-mode',
    'safe-mode': 'safe-mode',
    governance: 'governance-review',
    'governance-review': 'governance-review',
    controlled: 'controlled-agent',
    'controlled-agent': 'controlled-agent',
    explain: 'explainability',
    explainability: 'explainability',
    recovery: 'recovery',
    'recovery-mode': 'recovery',
    'strategic-thinking': 'strategic-thinking',
    'strategic-os': 'strategic-thinking',
    'personal-intelligence': 'personal-intelligence',
    'deep-research-os': 'deep-research-os',
    'research-os': 'deep-research-os',
    'cognitive-workspace': 'cognitive-workspace',
    'workspace-os': 'cognitive-workspace',
    'meta-reasoning': 'meta-reasoning',
    meta: 'meta-reasoning',
    'health-watch': 'health-watch',
    opshealth: 'health-watch',
    benchmark: 'benchmark',
    incident: 'incident-response',
    'incident-response': 'incident-response',
    cost: 'cost-optimization',
    'cost-optimization': 'cost-optimization',
    'continuous-improvement': 'continuous-improvement',
    'learning-mentor': 'learning-mentor',
    'decision-support': 'decision-support',
    'decision-basic': 'decision',
    debugging: 'coding-debugging',
    'coding-debugging': 'coding-debugging'
  };
  const normalizedMode = modeAliases[mode] || mode;

  if (['kerja', 'santai', 'auto', 'simple', 'coding', 'learning', 'strategic', 'decision', 'reflection', 'research', 'ops', 'health', 'belajar', 'kritis', 'riset', 'builder', 'refleksi', 'deep', 'mentor', 'optimasi', 'kolaborasi', 'research-intelligence', 'mentor-intelligence', 'strategis', 'system-analysis', 'document-analysis', 'visual-analysis', 'data-understanding', 'cross-modal', 'research-file', 'safe-mode', 'governance-review', 'controlled-agent', 'explainability', 'recovery', 'strategic-thinking', 'personal-intelligence', 'deep-research-os', 'cognitive-workspace', 'meta-reasoning', 'health-watch', 'benchmark', 'incident-response', 'cost-optimization', 'continuous-improvement', 'learning-mentor', 'decision-support', 'coding-debugging'].includes(normalizedMode)) {
    u.mode = normalizedMode;
    u.manualModeOverride = normalizedMode !== 'auto';
    if (normalizedMode === 'auto') {
      u.adaptive.enabled = true;
      u.adaptive.activeMode = null;
    }
    await persist();

    await safeSendMessage(
      chatId,
      `✅ Mode disetel ke "${normalizedMode}".`,
      { reply_to_message_id: msg.message_id }
    );
  } else {
    await safeSendMessage(
      chatId,
      'Format: /mode auto | simple | coding | learning | strategic | decision | reflection | research | ops | health | kerja | santai | belajar | kritis | riset | builder | refleksi | deep | mentor',
      { reply_to_message_id: msg.message_id }
    );
  }

  return true;
}

async function handleAlias(chatId, userId, cmd, args, msg) {
  if (cmd !== '/alias') {
    return false;
  }

  const u = ensureUser(userId);

  if (safeLower(args).trim() === 'list') {
    const list = Object.entries(u.aliases || {})
      .map(([k, v]) => `${k} => ${v}`)
      .join('\n');

    await safeSendMessage(
      chatId,
      list ? `Alias kamu:\n${list}` : 'Belum ada alias.',
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  const parts = args.split('=');

  if (parts.length < 2) {
    await safeSendMessage(
      chatId,
      'Format: /alias nama_alias = /command',
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }

  const alias = parts[0].trim().toLowerCase();
  const target = parts[1].trim().toLowerCase();

  if (!alias || !target.startsWith('/')) {
    await safeSendMessage(
      chatId,
      'Format: /alias nama_alias = /command',
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }

  u.aliases[alias] = target;
  await persist();

  await safeSendMessage(
    chatId,
    `✅ Alias "${alias}" disimpan ke "${target}".`,
    { reply_to_message_id: msg.message_id }
  );

  return true;
}

async function handleRiwayat(chatId, userId, cmd, args, msg) {
  if (cmd !== '/riwayat') {
    return false;
  }

  const result = searchConversationHistory(userId, args);

  await sendChunkedMessage(
    chatId,
    `🧾 Riwayat percakapan:\n\n${result}`,
    { reply_to_message_id: msg.message_id }
  );

  return true;
}

async function handleDigest(chatId, userId, cmd, args, msg) {
  if (cmd !== '/digest') {
    return false;
  }

  const u = ensureUser(userId);
  const parts = cleanupSpaces(args).split(' ').filter(Boolean);
  const action = safeLower(parts[0] || '');

  if (action === 'on') {
    u.digest.enabled = true;

    if (parts[1] && /^\d{2}:\d{2}$/.test(parts[1])) {
      u.digest.time = parts[1];
    }

    await persist();
    scheduleDigestJob(userId);

    await safeSendMessage(
      chatId,
      `✅ Digest diaktifkan. Jam: ${u.digest.time}`,
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  if (action === 'off') {
    u.digest.enabled = false;

    if (digestJobs.has(userId)) {
      try { digestJobs.get(userId).cancel(); } catch (_) {}
      digestJobs.delete(userId);
    }

    await persist();

    await safeSendMessage(
      chatId,
      '✅ Digest dimatikan.',
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  if (action === 'now') {
    const summary = await generateDigestForUser(userId);

    await sendChunkedMessage(
      chatId,
      `🧾 Digest sekarang:\n\n${summary}`,
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  if (/^\d{2}:\d{2}$/.test(action)) {
    u.digest.enabled = true;
    u.digest.time = action;

    await persist();
    scheduleDigestJob(userId);

    await safeSendMessage(
      chatId,
      `✅ Jam digest disetel ke ${action}.`,
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }

  await safeSendMessage(
    chatId,
    'Format: /digest on [HH:MM] | off | HH:MM | now',
    { reply_to_message_id: msg.message_id }
  );

  return true;
}

async function handleModeration(chatId, userId, cmd, args, msg) {
  if (cmd === '/antispam') {
    const u = ensureUser(userId);
    const v = safeLower(args).trim();

    if (v === 'on' || v === 'off') {
      u.moderation.antispam = v === 'on';
      await persist();

      await safeSendMessage(
        chatId,
        `✅ Antispam: ${v}`,
        { reply_to_message_id: msg.message_id }
      );
    } else {
      await safeSendMessage(
        chatId,
        'Format: /antispam on | off',
        { reply_to_message_id: msg.message_id }
      );
    }

    return true;
  }

  if (cmd === '/welcome') {
    const u = ensureUser(userId);
    const v = safeLower(args).trim();

    if (v === 'on' || v === 'off') {
      u.moderation.welcome = v === 'on';
      await persist();

      await safeSendMessage(
        chatId,
        `✅ Welcome message: ${v}`,
        { reply_to_message_id: msg.message_id }
      );
    } else {
      await safeSendMessage(
        chatId,
        'Format: /welcome on | off',
        { reply_to_message_id: msg.message_id }
      );
    }

    return true;
  }

  return false;
}

async function handleDocumentSmart(chatId, userId, msg) {
  const doc = msg.document;

  if (!doc) {
    return false;
  }

  const fileName = String(doc.file_name || 'file').toLowerCase();
  const mime = String(doc.mime_type || '');

  let buffer;
  try {
    buffer = await downloadTelegramFile(doc.file_id);
  } catch (err) {
    console.error('Document download error:', err.message);
    await safeSendMessage(
      chatId,
      'Gagal mengambil file dari Telegram.',
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }

  let text = '';

  if (mime === 'application/pdf' || fileName.endsWith('.pdf')) {
    if (pdfParseLib) {
      try {
        const data = await pdfParseLib(buffer);
        text = String(data.text || '');
      } catch (_) {}
    }
  } else if (
    mime.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.json') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.xml') ||
    fileName.endsWith('.log') ||
    fileName.endsWith('.js') ||
    fileName.endsWith('.ts') ||
    fileName.endsWith('.py') ||
    fileName.endsWith('.html') ||
    fileName.endsWith('.css')
  ) {
    text = buffer.toString('utf-8');
  }

  const u = ensureUser(userId);
  u.lastFileName = fileName;
  u.lastFileText = text ? text.slice(0, 50000) : '';
  await persist();

  const caption = String(msg.caption || '').toLowerCase();
  const wantsSummary = caption.includes('ringkas') || caption.includes('summary') || caption.includes('tanya') || caption.includes('jelaskan');

  if (!text.trim()) {
    await safeSendMessage(
      chatId,
      `Aku menerima file "${fileName}", tapi belum bisa membaca isinya otomatis.\nCoba PDF/text biasa, atau tambahkan caption seperti "ringkas" lalu kirim lagi.`,
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }

  if (wantsSummary) {
    const summary = await askAI(
      getSystemPrompt(userId),
      `Ringkas isi file ini dalam bahasa Indonesia yang jelas dan singkat.\n\nNama file: ${fileName}\nIsi:\n${text.slice(0, 15000)}`,
      {
        userId,
        question: `ringkas file ${fileName}`,
        allowSearch: false,
        temperature: 0.2,
        maxTokens: 700
      }
    );

    await sendChunkedMessage(
      chatId,
      `📄 Ringkasan file:\n\n${summary}`,
      { reply_to_message_id: msg.message_id }
    );
  } else {
    await safeSendMessage(
      chatId,
      `File "${fileName}" sudah kubaca.\nKalau mau, balas file itu dengan /ringkasfile atau /tanyafile pertanyaan.`,
      { reply_to_message_id: msg.message_id }
    );
  }

  return true;
}
// =====================================================
// PART 8
// =====================================================

// ==================== HELP ====================

async function handleHelp(chatId, msg) {
  const help =
`/start - mulai
/ping - cek bot hidup
/reset - reset memory pribadi
/help - bantuan
/menu atau /actions - menu interaktif
/belajar - catatan belajar arsitektur bot
/stats - statistik
/system - status agent production [admin]
/improve - laporan self-improvement [admin]
/adaptive status|on|off|reset - adaptive mode otomatis
/think masalah - thinking partner
/learnplan topik - roadmap belajar
/mentalmodel konsep - mental model
/decision pilihan/masalah - decision support
/blindspot rencana - cari blind spot
/assumptions argumen - cek asumsi
/perspectives masalah - multi perspektif
/insight catatan - simpan insight
/journal [catatan] - journal refleksi
/collab - status Human-AI Collaboration
/collab-reset - reset data collaboration user
/ops - status AI Production Ops [admin]
/health - health monitor [admin]
/perf - latency, token, dan cost summary [admin]
/cost - cost/token efficiency [admin]
/tokens - estimasi token usage [admin]
/benchmark [type] - benchmark ringan manual [admin]
/benchmarkfull - benchmark lengkap lebih berat [admin]
/benchmarks - riwayat benchmark [admin]
/diag atau /diagnose - diagnosis operasional [admin]
/incidents - daftar incident [admin]
/incident incidentId - detail incident [admin]
/recover - rekomendasi recovery aman [admin]
/recover confirm action - jalankan recovery aman [admin]
/reliability - reliability score [admin]
/regression - cek regresi [admin]
/tuning - rekomendasi tuning [admin]
/rollbackplan [alasan] - rencana rollback aman [admin]
/opslessons - knowledge base ops [admin]
/opskb query - cari ops knowledge base [admin]
/canary - rollout canary ringan [admin]
/canary create nama | deskripsi [admin]
/canary metric id | nama | nilai | catatan [admin]
/canary compare id [admin]
/canary promote id [admin]
/canary rollback id [admin]
/ops-reset - reset data ops runtime [admin]
/aios - status ringkas AI OS
/memory - 10 memory terbaru AI OS
/remember teks - simpan memory manual
/forget memoryId - hapus memory AI OS
/goals - daftar goal AI OS
/goaladd judul | deskripsi | prioritas | targetDate
/goalupdate goalId | status/progress/description | value
/workflows - workflow aktif
/workflowadd judul | deskripsi | goalId
/workflowstep workflowId | step
/workflowdone workflowId | stepNumber
/workflowdecision workflowId | decision
/workflowblocker workflowId | blocker
/workflownext workflowId | next action
/graph - knowledge graph
/insights - insight penting
/workspace - cognitive workspace
/workspaceadd judul | deskripsi
/reflect <teks/topik>
/strategy <goal/masalah>
/aios-reset - reset data AI OS user
/rollback - hapus aturan terakhir
/feedback - log A/B
/plugins - daftar plugin
/reloadplugins - muat ulang plugin
/summary atau /memori - ringkasan memori

/image <deskripsi> - buat gambar
/hitung <expr> - kalkulator
/jam [lokasi]
/tanggal - tanggal hari ini
/cuaca <kota>
/lokasi <tempat>
/cari <topik>

/setname <nama> - ganti nama bot
/savepref k = v - simpan preferensi
/mode kerja | santai | auto | belajar | kritis | riset | builder | refleksi | deep | mentor | optimasi | kolaborasi | research-intelligence | mentor-intelligence | strategis | system-analysis | document-analysis | visual-analysis | data-understanding | cross-modal | research-file | safe-mode | governance-review | controlled-agent | explainability | recovery | strategic-thinking | personal-intelligence | deep-research-os | cognitive-workspace | meta-reasoning | health-watch | benchmark | incident-response | cost-optimization | continuous-improvement | learning-mentor | decision-support | coding-debugging
/alias nama_alias = /command
/riwayat kata

/digest on [HH:MM] | off | now
/antispam on | off
/welcome on | off

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

- /ringkasfile (balas file)
- /tanyafile pertanyaan

Bahasa alami:
- "Tambah event rapat besok jam 10"
- "Tambah tugas beli susu"
- "Cuaca di Bandung"
- "Jam berapa di New York"
- "Gambar kucing lucu"
- "Cari lalu rangkum tentang AI terbaru"`;

  await sendChunkedMessage(
    chatId,
    help,
    {
      reply_to_message_id: msg.message_id,
      reply_markup: interactions.keyboardBuilder.mainMenuKeyboard()
    }
  );
}

function isUnknownCommand(cmd) {
  const known = new Set([
    '/start',
    '/ping',
    '/reset',
    '/help',
    '/menu',
    '/actions',
    '/belajar',
    '/stats',
    '/system',
    '/improve',
    '/adaptive',
    '/think',
    '/learnplan',
    '/mentalmodel',
    '/decision',
    '/blindspot',
    '/assumptions',
    '/perspectives',
    '/insight',
    '/journal',
    '/collab',
    '/collab-reset',
    '/ops',
    '/health',
    '/perf',
    '/cost',
    '/tokens',
    '/benchmark',
    '/benchmarkfull',
    '/benchmarks',
    '/diag',
    '/diagnose',
    '/incidents',
    '/incident',
    '/recover',
    '/reliability',
    '/regression',
    '/tuning',
    '/opslessons',
    '/opskb',
    '/rollbackplan',
    '/canary',
    '/opsreset',
    '/ops-reset',
    '/aios',
    '/memory',
    '/remember',
    '/forget',
    '/goals',
    '/goaladd',
    '/goalupdate',
    '/workflows',
    '/workflowadd',
    '/workflowstep',
    '/workflowdone',
    '/workflowdecision',
    '/workflowblocker',
    '/workflownext',
    '/graph',
    '/insights',
    '/workspace',
    '/workspaceadd',
    '/reflect',
    '/strategy',
    '/aios-reset',
    '/rollback',
    '/feedback',
    '/image',
    '/hitung',
    '/jam',
    '/tanggal',
    '/cuaca',
    '/lokasi',
    '/cari',
    '/setname',
    '/koreksi',
    '/mood',
    '/remind',
    '/todo',
    '/add',
    '/done',
    '/cleartodo',
    '/quiz',
    '/poll',
    '/kick',
    '/pin',
    '/resize',
    '/sticker',
    '/learn',
    '/askkb',
    '/auth',
    '/addevent',
    '/savepref',
    '/plugins',
    '/summary',
    '/memori',
    '/reloadplugins',
    '/mode',
    '/alias',
    '/riwayat',
    '/digest',
    '/antispam',
    '/welcome',
    '/ringkasfile',
    '/tanyafile'
  ]);

  return cmd && !known.has(cmd);
}

// ==================== FILE COMMAND ====================

async function handleFileCommands(chatId, userId, cmd, args, msg) {

  if (cmd === '/ringkasfile') {

    if (!msg.reply_to_message?.document) {
      await safeSendMessage(
        chatId,
        'Balas pesan file lalu pakai /ringkasfile.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    if (typeof handleDocumentSmart !== 'function') {
      await safeSendMessage(
        chatId,
        'Fitur baca file belum aktif di kode ini.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    return await handleDocumentSmart(
      chatId,
      userId,
      msg.reply_to_message
    );
  }

  if (cmd === '/tanyafile') {

    const query = String(args || '').trim();

    if (!query) {
      await safeSendMessage(
        chatId,
        'Format: /tanyafile pertanyaan',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    const u = ensureUser(userId);

    const fileText = String(u.lastFileText || '').trim();

    if (!fileText) {
      await safeSendMessage(
        chatId,
        'Belum ada file yang tersimpan di sesi ini.',
        { reply_to_message_id: msg.message_id }
      );
      return true;
    }

    try {

      const answer = await askAI(
        getSystemPrompt(userId),
        `Jawab berdasarkan isi file berikut.

Pertanyaan:
${query}

Isi file:
${fileText.slice(0, 20000)}`,
        {
          userId,
          question: query,
          allowSearch: false,
          temperature: 0.2,
          maxTokens: 700
        }
      );

      await sendChunkedMessage(
        chatId,
        `📄 Jawaban dari file:\n\n${answer}`,
        { reply_to_message_id: msg.message_id }
      );

    } catch (err) {

      console.error('handleFileCommands error:', err.message);

      await safeSendMessage(
        chatId,
        '❌ Gagal memproses pertanyaan file.',
        { reply_to_message_id: msg.message_id }
      );
    }

    return true;
  }

  return false;
}

// ==================== PLUGINS ====================

async function loadPlugins() {

  pluginModules = [];
  pluginCommandMap = new Map();
  pluginMessageHooks = [];

  const pluginDir = path.join(FILE_DIR, 'plugins');

  if (!fs.existsSync(pluginDir)) {
    return { count: 0 };
  }

  const files = fs.readdirSync(pluginDir)
    .filter(f => f.endsWith('.js'));

  for (const file of files) {

    const pluginPath = path.join(pluginDir, file);

    try {

      delete require.cache[require.resolve(pluginPath)];

      const plugin = require(pluginPath);

      if (!plugin) continue;

      const name = plugin.name || path.basename(file, '.js');

      pluginModules.push({
        name,
        ...plugin
      });

      if (plugin.commands && typeof plugin.commands === 'object') {

        for (const [cmd, handler] of Object.entries(plugin.commands)) {

          pluginCommandMap.set(
            String(cmd).toLowerCase(),
            {
              plugin: name,
              handler
            }
          );
        }
      }

      if (typeof plugin.onMessage === 'function') {

        pluginMessageHooks.push({
          plugin: name,
          handler: plugin.onMessage
        });
      }

    } catch (err) {

      console.error(
        `Plugin gagal dimuat ${file}:`,
        err.message
      );
    }
  }

  return {
    count: pluginModules.length
  };
}

async function handlePluginCommand(
  chatId,
  userId,
  cmd,
  args,
  msg,
  text
) {

  const found = pluginCommandMap.get(
    String(cmd || '').toLowerCase()
  );

  if (!found) {
    return false;
  }

  try {

    const result = await found.handler({
      chatId,
      userId,
      cmd,
      args,
      msg,
      text,

      bot: {
        telegramPost,
        safeSendMessage,
        sendChunkedMessage,
        sendStreamingAnswer,
        askAI,
        searchWebTavily,
        searchWebTavilyRaw,
        summarizeSearchWithRefs,
        getWeather,
        searchLocation,
        generateImage,
        ensureUser,
        persist,
        getSystemPrompt
      }
    });

    if (typeof result === 'string' && result.trim()) {

      await sendChunkedMessage(
        chatId,
        result,
        { reply_to_message_id: msg.message_id }
      );

    } else if (
      result &&
      typeof result === 'object' &&
      result.text
    ) {

      await sendChunkedMessage(
        chatId,
        result.text,
        { reply_to_message_id: msg.message_id }
      );
    }

    return true;

  } catch (err) {

    console.error(
      `Plugin command error [${found.plugin} ${cmd}]:`,
      err.message
    );

    await safeSendMessage(
      chatId,
      '❌ Plugin error.',
      { reply_to_message_id: msg.message_id }
    );

    return true;
  }
}

async function runPluginMessageHooks(ctx) {

  for (const hook of pluginMessageHooks) {

    try {

      const result = await hook.handler(ctx);

      if (result) {
        return result;
      }

    } catch (err) {

      console.error(
        `Plugin message hook error [${hook.plugin}]:`,
        err.message
      );
    }
  }

  return null;
}

async function handlePluginsList(chatId, msg) {

  const list = pluginModules.length
    ? pluginModules.map(p => `- ${p.name}`).join('\n')
    : 'Belum ada plugin dimuat.';

  await safeSendMessage(
    chatId,
    `🔌 Plugin aktif:\n${list}`,
    { reply_to_message_id: msg.message_id }
  );
}

async function handleReloadPlugins(chatId, userId, msg) {

  if (!isAdmin(userId)) {

    await safeSendMessage(
      chatId,
      '❌ Hanya admin yang boleh reload plugin.',
      { reply_to_message_id: msg.message_id }
    );

    return;
  }

  const result = await loadPlugins();

  await safeSendMessage(
    chatId,
    `✅ Plugin dimuat ulang. Total: ${result.count}`,
    { reply_to_message_id: msg.message_id }
  );
}

async function handleSummary(chatId, userId, msg) {

  const u = ensureUser(userId);

  await safeSendMessage(
    chatId,
    u.summary
      ? `🧠 Ringkasan memori:\n${u.summary}`
      : 'Belum ada ringkasan memori.',
    { reply_to_message_id: msg.message_id }
  );
}

// ==================== NLP ====================

function heuristicIntent(userMessage) {

  const q = safeLower(naturalLanguage.normalizeInputForRouting(userMessage)).trim();

  if (!q) {
    return {
      intent: 'NONE',
      params: {}
    };
  }

  if (
    !naturalLanguage.shouldBypassMathTool(q) &&
    (
      q.includes('hitung') ||
      /^[0-9\s()+\-*/%.]+$/.test(q)
    )
  ) {

    const expr = q.includes('hitung')
      ? q.replace(/.*hitung/i, '').trim()
      : q;

    const clean = expr.replace(/[^0-9+\-*/().%]/g, '');

    if (clean) {
      return {
        intent: 'HITUNG',
        params: {
          expression: clean
        }
      };
    }
  }

  if (
    q.includes('tanggal') &&
    (
      q.includes('hari ini') ||
      q.includes('sekarang') ||
      q.includes('berapa')
    )
  ) {

    return {
      intent: 'TANGGAL',
      params: {}
    };
  }

  const isCurrentTimeQuestion = (q.includes('jam') || q.includes('waktu')) &&
    !/\d+(?:[.,]\d+)?\s+(jam|hari|menit|minggu|bulan|tahun|detik)\b/i.test(q) &&
    (q.includes('sekarang') || q.includes('pukul') || q.includes('jam berapa') || q.includes('waktu di') || /^jam\s+berapa/.test(q));

  if (isCurrentTimeQuestion) {

    let location = q
      .replace(
        /(jam|waktu|di|pukul|sekarang|berapa|di mana|dimana)/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    location = location || 'jakarta';

    return {
      intent: 'JAM',
      params: {
        location
      }
    };
  }

  if (
    q.includes('cuaca') ||
    q.includes('weather')
  ) {

    let city = q
      .replace(
        /(cuaca|weather|di|kota|bagaimana|sekarang|bagaimanakah)/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    city = city || 'jakarta';

    return {
      intent: 'CUACA',
      params: {
        city
      }
    };
  }

  if (
    q.includes('lokasi') ||
    q.includes('alamat') ||
    q.includes('dimana') ||
    q.includes('di mana')
  ) {

    let place = q
      .replace(
        /(cari|lokasi|alamat|dimana|di mana|tempat|tunjukkan|lihat|di|adalah)/g,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();

    if (place) {
      return {
        intent: 'LOKASI',
        params: {
          place
        }
      };
    }
  }

  return null;
}

// =====================================================
// PART 9
// =====================================================

async function universalNLP(userMessage, userId) {
  const heuristic = heuristicIntent(userMessage);

  if (heuristic) {
    return heuristic;
  }

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
- TAMBAH_EVENT
- TAMBAH_TUGAS
- TAMBAH_PENGINGAT
- TAMBAH_MOOD
- CUACA
- SEARCH
- HITUNG
- JAM
- TANGGAL
- GAMBAR
- LOKASI
- NONE

Pesan user:
"${userMessage}"${patternHint}

Aturan:
- Output harus JSON saja.
- Jangan tambahkan markdown, penjelasan, atau teks lain.
- Jangan tampilkan code fence.

Contoh:
{"intent":"TAMBAH_TUGAS","params":{"task":"beli susu"}}
{"intent":"CUACA","params":{"city":"Bandung"}}
{"intent":"NONE"}`;

  try {
    const response = await askAI(
      'Kamu hanya boleh mengeluarkan JSON valid untuk klasifikasi intent. Tidak boleh ada teks lain.',
      prompt,
      {
        userId,
        question: userMessage,
        allowSearch: false,
        temperature: 0.2,
        maxTokens: 300,
        allowCache: false,
        allowRawJson: true
      }
    );

    const cleaned = stripCodeFences(response);
    const parsed = extractJsonObject(cleaned);

    if (!parsed || !parsed.intent) {
      return { intent: 'NONE', params: {} };
    }

    const validIntents = [
      'TAMBAH_EVENT',
      'TAMBAH_TUGAS',
      'TAMBAH_PENGINGAT',
      'TAMBAH_MOOD',
      'CUACA',
      'SEARCH',
      'HITUNG',
      'JAM',
      'TANGGAL',
      'GAMBAR',
      'LOKASI',
      'NONE'
    ];

    if (!validIntents.includes(parsed.intent)) {
      return { intent: 'NONE', params: {} };
    }

    return {
      intent: parsed.intent,
      params: parsed.params || {}
    };
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

  if (u.nlpPatterns.length > 100) {
    u.nlpPatterns.shift();
  }

  await persist();
}

async function askClarification(chatId, userId, originalText, msg) {
  await safeSendMessage(
    chatId,
    `🤔 Maaf, aku kurang paham dengan:\n"${originalText}"\n\nCoba tulis lebih jelas, misalnya:\n- Cari dan rangkum AI agent terbaru\n- Tambah event rapat besok jam 10\n- Tambah tugas beli susu\n- Cuaca di Bandung\n- Ingatkan saya besok jam 8\n- Hitung 25*4\n- Jam berapa di New York\n- Gambar kucing lucu`,
    { reply_to_message_id: msg.message_id }
  );

  const u = ensureUser(userId);
  u.awaitingClarification = originalText;
  u.awaitingClarificationAt = nowMs();
  await persist();
}

async function executeUniversalIntent(intent, params, chatId, userId, msg, systemPrompt = getSystemPrompt(userId)) {
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
      const endDT = parseFlexibleDateTime(`${endDate || startDate} ${endTime}`, '10:00') ||
        (startDT ? new Date(startDT.getTime() + 60 * 60 * 1000) : null);

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

    case 'TAMBAH_TUGAS':
      if (!params.task) {
        await safeSendMessage(chatId, '❌ Tugasnya belum jelas.', { reply_to_message_id: msg.message_id });
        return true;
      }
      u.todos.push({ text: params.task, done: false, createdAt: nowMs() });
      await persist();
      await safeSendMessage(chatId, `✅ Tugas "${params.task}" ditambahkan.`, { reply_to_message_id: msg.message_id });
      return true;

    case 'TAMBAH_PENGINGAT':
      return await scheduleReminderFromParams(chatId, userId, params.message, params.time, msg);

    case 'TAMBAH_MOOD': {
      const mood = safeLower(params.mood || '');
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

    case 'CUACA':
      await safeSendMessage(chatId, await getWeather(params.city || 'jakarta'), { reply_to_message_id: msg.message_id });
      return true;

    case 'SEARCH':
      await sendChunkedMessage(chatId, await summarizeSearchWithRefs(params.query || '', userId, systemPrompt), { reply_to_message_id: msg.message_id });
      return true;

    case 'HITUNG':
      await safeSendMessage(chatId, calculate(params.expression || ''), { reply_to_message_id: msg.message_id });
      return true;

    case 'JAM':
      await safeSendMessage(chatId, getCurrentTime(params.location || 'jakarta'), { reply_to_message_id: msg.message_id });
      return true;

    case 'TANGGAL':
      await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id });
      return true;

    case 'GAMBAR': {
      if (!params.prompt) {
        await safeSendMessage(chatId, '❌ Prompt gambar belum ada.', { reply_to_message_id: msg.message_id });
        return true;
      }
      await safeSendMessage(chatId, `🎨 Membuat gambar: ${params.prompt}...`, { reply_to_message_id: msg.message_id });
      const img = await generateImage(params.prompt);
      const ok = await sendPhotoUrl(chatId, img, `✨ ${params.prompt}`);
      if (!ok) await safeSendMessage(chatId, '❌ Gagal membuat gambar.', { reply_to_message_id: msg.message_id });
      return true;
    }

    case 'LOKASI':
      if (!params.place) {
        await safeSendMessage(chatId, '❌ Nama lokasi belum ada.', { reply_to_message_id: msg.message_id });
        return true;
      }
      await safeSendMessage(chatId, await searchLocation(params.place), { reply_to_message_id: msg.message_id });
      return true;

    default:
      return false;
  }
}
async function handleTools(msgText, userId = '0') {
  const normalizedToolText = naturalLanguage.normalizeInputForRouting(msgText);
  const low = safeLower(normalizedToolText);

  if (low.includes('tanggal') && (low.includes('berapa') || low.includes('hari ini') || low.includes('sekarang'))) {
    return getCurrentDate();
  }

  const isTimeQuestion = (low.includes('jam') || low.includes('waktu')) &&
    !/\d+(?:[.,]\d+)?\s+(jam|hari|menit|minggu|bulan|tahun|detik)\b/i.test(low) &&
    (low.includes('berapa') || low.includes('sekarang') || low.includes('pukul'));

  if (isTimeQuestion) {
    let q = low
      .replace(/(jam|waktu|di|pukul|berapa|sekarang|hari ini|hari\s+ini)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    q = q || 'jakarta';
    return getCurrentTime(q);
  }

  if (!naturalLanguage.shouldBypassMathTool(low) && (low.includes('hitung') || low.match(/\d+[\+\-\*\/]\d+/)) && !low.includes('cuaca')) {
    const expr = String(normalizedToolText || '').replace(/[^0-9+\-*/().%]/g, '');
    if (expr) return calculate(expr);
  }

  if (low.includes('alamat') || low.includes('lokasi') || low.includes('dimana') || low.includes('di mana')) {
    const q = String(msgText || '').replace(/alamat|lokasi|dimana|di mana|cari tempat|di|tempat/gi, '').trim();
    return q ? await searchLocation(q) : 'Sebutkan tempat';
  }

  if (low.includes('cuaca')) {
    const city = String(msgText || '').replace(/cuaca|weather|di|kota|bagaimana|sekarang/gi, '').trim();
    return city ? await getWeather(city) : 'Contoh: cuaca Tokyo';
  }

  const searchKw = ['cari', 'search', 'google', 'apa itu', 'informasi', 'berita', 'ringkas', 'rangkum', 'summary'];
  if (searchKw.some(k => low.includes(k))) {
    let q = String(msgText || '');
    for (const k of searchKw) q = q.replace(new RegExp(escapeRegExp(k), 'gi'), ' ');
    q = q.trim();
    return q ? await summarizeSearchWithRefs(q, userId, getSystemPrompt(userId)) : 'Apa yang ingin dicari?';
  }

  return null;
}
// =====================================================
// WEBHOOK
// =====================================================

app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => {
  res.json(autonomousEngine.getRuntimeStatus());
});

app.get('/api/dashboard', (req, res) => {
  const ops = opsSystem.getStatus(getOpsServices());
  const runtime = autonomousEngine.getRuntimeStatus();
  const storage = storageManager.getStorageStatus();
  res.json({
    name: 'Human-AI Cognitive Operating System',
    version: 'final-cognitive-os',
    public: true,
    note: 'Endpoint ini hanya metadata publik. Memory user, prompt internal, token, dan data sensitif tidak diekspos.',
    storage: {
      persistentType: storage.persistentType,
      postgresConfigured: Boolean(DATABASE_URL),
      postgresConnected: Boolean(storage.postgresAvailable),
      cacheType: storage.cache?.type || 'memory-cache',
      redisConfigured: Boolean(REDIS_URL)
    },
    health: {
      status: ops.health.status,
      uptimeSeconds: ops.health.uptimeSeconds,
      memory: ops.health.memory,
      queue: runtime.queue || {}
    },
    modules: [
      'conversation-continuity',
      'interaction-layer',
      'adaptive-mode-router',
      'human-ai-collaboration',
      'ai-os',
      'ops',
      'storage-manager',
      'knowledge-graph',
      'goal-workflow',
      'human-judgment-safety'
    ],
    commands: {
      adaptive: ['/adaptive status', '/adaptive on', '/adaptive off', '/adaptive reset'],
      collaboration: ['/think', '/strategy', '/reflect', '/learnplan', '/mentalmodel', '/decision', '/blindspot', '/assumptions', '/perspectives', '/insight', '/journal', '/collab'],
      aiOS: ['/aios', '/goals', '/goaladd', '/workflows', '/workflowadd', '/graph', '/insights', '/workspace'],
      ops: ['/ops', '/health', '/diag', '/benchmark', '/reliability', '/perf', '/cost', '/tokens', '/regression'],
      interaction: ['/menu', '/actions', '/help']
    },
    dashboardTargets: [
      'Memory',
      'Goals',
      'Workflows',
      'Knowledge Graph',
      'Insights',
      'Reflections',
      'Research',
      'Ops/Health',
      'Benchmarks',
      'Settings'
    ],
    futureStack: ['Next.js', 'Tailwind CSS', 'shadcn/ui', 'PostgreSQL', 'Redis', 'Auth.js/Clerk/Supabase Auth']
  });
});

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

app.post(WEBHOOK_PATH, async (req, res) => {
  const webhookStart = nowMs();
  res.on('finish', () => {
    opsSystem.performanceProfiler.recordOperation('webhook', nowMs() - webhookStart, getOpsServices(), {
      statusCode: res.statusCode
    });
  });

  try {
    const update = req.body;
    opsSystem.telemetry.recordRequest({
      name: 'telegram_update',
      hasText: Boolean(update?.message?.text || update?.message?.caption),
      hasAttachment: Boolean(update?.message?.photo || update?.message?.document || update?.message?.voice)
    }, getOpsServices());

    if (isDuplicateIncomingUpdate(update)) {
  return res.sendStatus(200);
}
    if (!update || typeof update !== 'object') return res.sendStatus(200);

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const feedbackUserId = cb.from?.id;

      const handledInteraction = await interactions.callbackRouter.handleCallbackQuery(getInteractionServices(), cb);
      if (handledInteraction) {
        return res.sendStatus(200);
      }

      if (cb.data === 'positive') {
        if (feedbackUserId) {
          await agentLearning.registerFeedback('telegram_callback', feedbackUserId, 'positive', {
            ensureUser,
            persist
          });
          await selfImprovementAgent.recordUserFeedback('telegram_callback', feedbackUserId, 'positive', {
            ensureUser,
            persist
          });
        }
        await safeSendMessage(chatId, '👍 Terima kasih!');
      } else if (cb.data === 'negative') {
        if (feedbackUserId) {
          await agentLearning.registerFeedback('telegram_callback', feedbackUserId, 'negative', {
            ensureUser,
            persist
          });
          await selfImprovementAgent.recordUserFeedback('telegram_callback', feedbackUserId, 'negative', {
            ensureUser,
            persist
          });
        }
        await safeSendMessage(chatId, '👎 Gunakan /koreksi untuk mengajari saya.');
      }

      try {
        await telegramPost('answerCallbackQuery', { callback_query_id: cb.id });
      } catch (_) {}

      return res.sendStatus(200);
    }

    if (!update.message) return res.sendStatus(200);
    if (update.message.from?.is_bot) return res.sendStatus(200);
    if (update.edited_message) return res.sendStatus(200);

const msg = update.message;
const chatId = msg.chat.id;
const userId = normalizeId(msg.from.id);

await withUserActionLock(userId, async () => {
  const text = String(msg.text || '').trim();
  const captionText = String(msg.caption || '').trim();
  const userText = text || captionText || ((msg.photo || msg.document || msg.voice) ? 'Analisis attachment ini.' : '');
  const cmd = getCommandBase(text);
  const args = getCommandArgs(text);

  logMessageFlow('incoming', {
    userId,
    chatId,
    text: userText,
    hasText: Boolean(text),
    hasCaption: Boolean(captionText),
    hasAttachment: Boolean(msg.photo || msg.document || msg.voice)
  });

  const msgKey = getMessageKey(update);
  if (!rememberWithTTL(processedMessageKeys, msgKey, 5 * 60 * 1000)) {
    return;
  }

  if (!text && !msg.photo && !msg.document && !msg.voice) {
    await safeSendMessage(chatId, 'Maaf, saya hanya bisa membaca pesan teks biasa saat ini.');
    return;
  }

  const rl = rateLimit(userId);
  if (!rl.ok) {
    await safeSendMessage(chatId, 'Terlalu cepat. Coba sebentar lagi ya.', { reply_to_message_id: msg.message_id });
    return;
  }

  const u = ensureUser(userId);
  u.lastChatId = chatId;
  u.msgCount += 1;
  u.lastSeen = nowMs();
  cleanupStaleUserState(u);

  pushChatHistory({
    userId,
    chatId,
    role: 'user',
    text: userText,
    timestamp: nowMs()
  });

  updateUserTags(u, userText);

  const modAction = moderationCheckIncoming(msg);
  if (modAction?.type === 'delete') {
    try { await telegramPost('deleteMessage', { chat_id: chatId, message_id: msg.message_id }); } catch (_) {}
    return;
  }

  if (modAction?.type === 'welcome') {
    await safeSendMessage(chatId, modAction.text);
    return;
  }

  const resolvedCmd = resolveAlias(userId, cmd);
  logMessageFlow('route_detected', {
    userId,
    chatId,
    route: resolvedCmd ? 'command' : 'non-command',
    command: resolvedCmd || null,
    text: userText
  });
  if (resolvedCmd) {
    opsSystem.telemetry.recordCommand(resolvedCmd, userId, getOpsServices());
  }

  if (resolvedCmd === '/start') {
    await safeSendMessage(chatId, `🤖 Halo! Aku ${u.botName}. Ketik /help untuk semua perintah.`, { reply_to_message_id: msg.message_id });
    return;
  }

  if (resolvedCmd === '/ping') { await handlePing(chatId, msg); return; }
  if (resolvedCmd === '/reset') { await handleReset(chatId, userId, msg); return; }
  if (resolvedCmd === '/menu' || resolvedCmd === '/actions') {
    await interactions.interactiveMenu.showMainMenu(getInteractionServices(), {
      chatId,
      userId,
      messageId: msg.message_id
    });
    return;
  }
  if (resolvedCmd === '/help') { await handleHelp(chatId, msg); return; }
  if (resolvedCmd === '/belajar') { await sendChunkedMessage(chatId, buildLearningGuide(), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/stats') { await handleStats(chatId, userId, msg); return; }
  if (resolvedCmd === '/system') { await handleSystemStatus(chatId, userId, msg); return; }
  if (resolvedCmd === '/improve') { await handleImproveStatus(chatId, userId, msg); return; }
  if (await handleAdaptiveCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleCollaborationCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleOpsCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleAiosCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (resolvedCmd === '/feedback') { await handleFeedback(chatId, msg); return; }
  if (resolvedCmd === '/image') { await handleImage(chatId, args, msg); return; }
  if (resolvedCmd === '/tanggal') { await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/jam') { await safeSendMessage(chatId, getCurrentTime(args || 'jakarta'), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/hitung') { await safeSendMessage(chatId, args ? calculate(args) : 'Contoh: /hitung 25*4', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/cuaca') { await safeSendMessage(chatId, args ? await getWeather(args) : 'Contoh: /cuaca Bandung', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/lokasi') { await safeSendMessage(chatId, args ? await searchLocation(args) : 'Contoh: /lokasi Monas', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/cari') { await sendChunkedMessage(chatId, args ? await summarizeSearchWithRefs(args, userId, getSystemPrompt(userId)) : 'Contoh: /cari sejarah Jakarta', { reply_to_message_id: msg.message_id }); return; }

  if (await handleSettings(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleCalibration(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleMood(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleReminder(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleTodo(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleQuizPoll(chatId, resolvedCmd, args, msg)) return;
  if (await handleGroupManagement(chatId, resolvedCmd, args, msg)) return;
  if (await handleImageEdit(chatId, resolvedCmd, args, msg)) return;
  if (await handleStickerHint(chatId, resolvedCmd, args, msg)) return;
  if (await handleKnowledge(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleMode(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleAlias(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleRiwayat(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleDigest(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleModeration(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleFileCommands(chatId, userId, resolvedCmd, args, msg)) return;

  if (resolvedCmd === '/auth') { await handleAuth(chatId, userId, msg); return; }
  if (resolvedCmd === '/addevent') { await handleAddEvent(chatId, userId, args, msg); return; }
  if (resolvedCmd === '/plugins') { await handlePluginsList(chatId, msg); return; }
  if (resolvedCmd === '/reloadplugins') { await handleReloadPlugins(chatId, userId, msg); return; }
  if (resolvedCmd === '/summary' || resolvedCmd === '/memori') { await handleSummary(chatId, userId, msg); return; }

  if (await handlePluginCommand(chatId, userId, resolvedCmd, args, msg, text)) return;

  if (isUnknownCommand(resolvedCmd)) {
    await safeSendMessage(chatId, 'Perintah tidak dikenal. Ketik /help untuk daftar perintah.', { reply_to_message_id: msg.message_id });
    return;
  }

  const pluginHookResult = await runPluginMessageHooks({
    chatId,
    userId,
    msg,
    text: userText,
    cmd: resolvedCmd,
    args,
    bot: {
      telegramPost,
      safeSendMessage,
      sendChunkedMessage,
      sendStreamingAnswer,
      askAI,
      searchWebTavily,
      searchWebTavilyRaw,
      summarizeSearchWithRefs,
      getWeather,
      searchLocation,
      generateImage,
      ensureUser,
      persist,
      getSystemPrompt
    }
  });

  if (pluginHookResult) {
    let pluginText = '';
    if (typeof pluginHookResult === 'string') {
      pluginText = pluginHookResult;
      await sendChunkedMessage(chatId, pluginText, { reply_to_message_id: msg.message_id });
    } else if (pluginHookResult && typeof pluginHookResult === 'object' && pluginHookResult.text) {
      pluginText = pluginHookResult.text;
      await sendChunkedMessage(chatId, pluginText, { reply_to_message_id: msg.message_id });
    }
    if (pluginText) {
      recordConversationReplySafe({
        userId,
        chatId,
        userText,
        botText: pluginText,
        intent: 'plugin_hook'
      });
    }
    return;
  }

  const conversationState = prepareConversationStateSafe(userId, chatId, userText, resolvedCmd, msg);
  logMessageFlow('conversation_state', {
    userId,
    chatId,
    action: conversationState.action,
    reason: conversationState.reason,
    text: userText
  });

  if (conversationState.action === 'direct') {
    const directText = conversationState.responseText || 'Bisa jelaskan sedikit lagi maksudnya?';
    await sendChunkedMessage(chatId, directText, { reply_to_message_id: msg.message_id });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: directText,
      intent: conversationState.reason || 'conversation_direct'
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: directText,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, directText);
    return;
  }

  const naturalAnswer = await handleNaturalLanguageRoute(chatId, userId, userText, msg, conversationState);
  if (naturalAnswer) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_language_route',
      processed: true,
      answerPreview: naturalAnswer
    });
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }

  const adaptiveDecision = detectAdaptiveModeForMessage(userId, userText, resolvedCmd, msg);
  await hydrateAIOSForMessageSafe(userId, userText, adaptiveDecision);
  logMessageFlow('ai_pipeline_calling', {
    userId,
    chatId,
    pipeline: 'autonomous',
    adaptiveMode: adaptiveDecision?.mode,
    text: userText
  });

  const hasAttachment = Boolean(msg?.photo || msg?.document || msg?.voice);
  const conversationAction = conversationState?.action || 'normal';
  if (
    adaptiveDecision?.applied &&
    adaptiveDecision.mode === 'simple' &&
    !hasAttachment &&
    ['normal', 'new_topic', 'clear_pending'].includes(conversationAction)
  ) {
    logMessageFlow('ai_pipeline_calling', {
      userId,
      chatId,
      pipeline: 'adaptive_simple_chat',
      adaptiveMode: adaptiveDecision.mode,
      text: userText
    });
    const simpleAnswer = await processAIMessage(chatId, userId, userText, msg);
    if (simpleAnswer) {
      logMessageFlow('ai_pipeline_result', {
        userId,
        chatId,
        pipeline: 'adaptive_simple_chat',
        processed: true,
        answerPreview: simpleAnswer
      });
      recordConversationReplySafe({
        userId,
        chatId,
        userText,
        botText: simpleAnswer,
        intent: adaptiveDecision.mode
      });
      if (u.digest?.enabled) scheduleDigestJob(userId);
      return;
    }
  }

  // Salurkan ke modul Autonomous AI Engine baru
  const autonomousResult = await autonomousEngine.processMessage(userId, chatId, userText, msg, {
    telegramPost,
    safeSendMessage,
    sendChunkedMessage,
    sendStreamingAnswer,
    askAI,
    getWeather,
    searchLocation,
    summarizeSearchWithRefs,
    generateImage,
    sendPhotoUrl,
    getCalendarClient,
    ensureUser,
    persist,
    getSystemPrompt,
    getSmartAnswer,
    pushChatHistory,
    autoSummarizeMemory,
    saveConversationPair,
    scheduleReminderFromParams,
    parseFlexibleDateTime,
    isValidDate,
    calculate,
    getCurrentTime,
    getCurrentDate,
    downloadFile: downloadTelegramFile,
    opsSystem,
    opsServices: getOpsServices(),
    interactionManager: interactions.manager,
    adaptiveDecision,
    adaptiveSystem,
    conversationState,
    shouldRejectGenericGreeting,
    env: {
      OWNER_CHAT_ID,
      ADMIN_SET
    },
    shortMemory
  });

  if (autonomousResult && autonomousResult.processed) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'autonomous',
      processed: true,
      answerPreview: autonomousResult.answerText
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: autonomousResult.answerText,
      intent: adaptiveDecision?.mode || 'autonomous'
    });
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }

  logMessageFlow('ai_pipeline_result', {
    userId,
    chatId,
    pipeline: 'autonomous',
    processed: false,
    reason: autonomousResult?.reason || 'not_processed',
    answerPreview: autonomousResult?.answerText,
    text: userText
  });
  logMessageFlow('ai_pipeline_calling', {
    userId,
    chatId,
    pipeline: 'legacy_chat_fallback',
    text: userText
  });
  const fallbackAnswer = await processAIMessage(chatId, userId, userText, msg);
  if (fallbackAnswer) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'legacy_chat_fallback',
      processed: true,
      answerPreview: fallbackAnswer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: fallbackAnswer,
      intent: 'legacy_ai_fallback'
    });
  }
  if (u.digest?.enabled) scheduleDigestJob(userId);
});

    return res.sendStatus(200);
  } catch (error) {
    opsSystem.telemetry.recordError(error, getOpsServices(), {
      scope: 'webhook',
      component: 'telegram-webhook',
      severity: 'warning'
    });
    console.error('Webhook error:', error);
    return res.sendStatus(200);
  }
});
// ==================== MAIN AI RESPONSE ====================

async function generateContextualPrompt(userId, text, extraContext = '') {
  const u = ensureUser(userId);

  const recentMemory = shortMemory
    .filter(m => normalizeId(m.userId) === normalizeId(userId))
    .slice(-8)
    .map(m => `User: ${m.q}\nBot: ${m.a}`)
    .join('\n\n');

  const todos = (u.todos || [])
    .filter(t => !t.done)
    .slice(-5)
    .map(t => `- ${t.text}`)
    .join('\n');

  const reminders = (u.reminders || [])
    .slice(-5)
    .map(r => `- ${r.message} (${r.time})`)
    .join('\n');

  return `
Nama bot: ${u.botName}
Mode: ${u.mode}
Mood user: ${u.mood || 'tidak diketahui'}

Summary User:
${u.summary || '-'}

Tag User:
${(u.tags || []).join(', ') || '-'}

Todo:
${todos || '-'}

Reminder:
${reminders || '-'}

Riwayat:
${recentMemory || '-'}

${extraContext}

${humanAISafety.buildContextNote(text)}

Pesan user:
${text}
`;
}

async function smartReply(userId, text, systemPrompt) {
  const contextPrompt = await generateContextualPrompt(userId, text);

  const answer = await askAI(
    systemPrompt,
    contextPrompt,
    {
      userId,
      question: text,
      allowSearch: true,
      temperature: 0.7,
      maxTokens: 1000
    }
  );

  return sanitizeOutgoingText(answer);
}

// ==================== ADVANCED MEMORY ====================

async function saveConversationPair(userId, question, answer) {
  shortMemory.push({
    userId,
    q: question,
    a: answer,
    timestamp: nowMs()
  });

  if (shortMemory.length > botSettings.maxShortMemory) {
    shortMemory = shortMemory.slice(-botSettings.maxShortMemory);
  }

  await persist();
}

async function rememberImportantFact(userId, text) {
  const u = ensureUser(userId);

  const importantKeywords = [
    'nama saya',
    'aku suka',
    'saya suka',
    'hobi',
    'ulang tahun',
    'kerja',
    'kuliah',
    'sekolah',
    'tinggal',
    'makanan favorit',
    'game favorit'
  ];

  const lower = safeLower(text);

  if (importantKeywords.some(k => lower.includes(k))) {
    if (!u.summary.includes(text.slice(0, 80))) {
      u.summary += `\n- ${text}`;
      u.summary = u.summary.trim().slice(-2000);
      await persist();
    }
  }
}

// ==================== ADVANCED SEARCH MODE ====================

async function deepSearchAndSummarize(query, userId) {
  if (!TAVILY_API_KEY) {
    return '❌ TAVILY_API_KEY belum diatur.';
  }

  const raw = await searchWebTavilyRaw(query, 8);

  const content = raw.results
    .map((r, i) => {
      return `
[${i + 1}]
Judul: ${r.title}
URL: ${r.url}
Isi:
${r.content}
`;
    })
    .join('\n');

  const prompt = `
Buat ringkasan mendalam dari hasil pencarian berikut.

Topik:
${query}

Data:
${content}

Aturan:
- Bahasa Indonesia
- Jangan mengarang
- Buat poin penting
- Sertakan referensi
`;

  const summary = await askAI(
    'Kamu adalah AI research assistant.',
    prompt,
    {
      userId,
      question: query,
      allowSearch: false,
      temperature: 0.3,
      maxTokens: 1200
    }
  );

  return summary;
}

// ==================== ADVANCED IMAGE PROMPT ====================

async function buildEnhancedImagePrompt(prompt, userId) {
  const u = ensureUser(userId);

  const style =
    u.preferences?.imageStyle ||
    'cinematic, ultra detailed, high quality';

  return `${prompt}, ${style}`;
}

// ==================== AI FILE ANALYZER ====================

async function analyzeFileContent(userId, fileName, fileText, question) {
  const system = `
Kamu adalah AI analyzer file.
Jawab hanya berdasarkan isi file.
Jangan mengarang.
`;

  const prompt = `
Nama file:
${fileName}

Isi file:
${fileText.slice(0, 25000)}

Pertanyaan:
${question}
`;

  const result = await askAI(
    system,
    prompt,
    {
      userId,
      question,
      allowSearch: false,
      temperature: 0.2,
      maxTokens: 1000
    }
  );

  return result;
}

// ==================== ADVANCED GROUP FEATURE ====================

async function autoWelcomeFeature(msg) {
  if (!msg.new_chat_members?.length) return;

  const chatId = msg.chat.id;

  const names = msg.new_chat_members
    .map(x => x.first_name)
    .join(', ');

  await safeSendMessage(
    chatId,
    `👋 Selamat datang ${names}!\nSemoga betah di grup ini.`
  );
}

async function antiLinkModeration(msg) {
  const text = String(msg.text || '');

  if (
    text.includes('http://') ||
    text.includes('https://') ||
    text.includes('t.me/')
  ) {
    try {
      await telegramPost('deleteMessage', {
        chat_id: msg.chat.id,
        message_id: msg.message_id
      });

      return true;
    } catch (_) {}
  }

  return false;
}

// ==================== SMART COMMAND SUGGESTION ====================

function suggestCommand(text) {
  const q = safeLower(text);

  const mapping = [
    ['gambar', '/image'],
    ['cuaca', '/cuaca'],
    ['todo', '/todo'],
    ['pengingat', '/remind'],
    ['hitung', '/hitung'],
    ['lokasi', '/lokasi'],
    ['ringkas', '/cari']
  ];

  for (const [key, cmd] of mapping) {
    if (q.includes(key)) {
      return cmd;
    }
  }

  return null;
}

// ==================== BOT PERSONALITY ENGINE ====================

function personalityResponse(mode, text) {
  if (mode === 'kerja') {
    return `📌 ${text}`;
  }

  if (mode === 'santai') {
    return `✨ ${text}`;
  }

  return text;
}

// ==================== AI SELF LEARNING ====================

async function autoLearn(question, answer) {
  if (!question || !answer) return;

  const quality = scoreAnswerQuality(question, answer);

  if (quality >= 0.7) {
    lessons.rules.push({
      trigger: question.slice(0, 80),
      answer,
      source: 'auto-ai',
      timestamp: nowMs()
    });

    if (lessons.rules.length > botSettings.maxRules) {
      lessons.rules.shift();
    }

    await persist();
  }
}

// ==================== DAILY AUTO SUMMARY ====================

async function generateDailySummary(userId) {
  const history = chatHistory
    .filter(x => normalizeId(x.userId) === normalizeId(userId))
    .slice(-50);

  if (!history.length) return 'Tidak ada aktivitas.';

  const content = history
    .map(h => `${h.role}: ${h.text}`)
    .join('\n');

  const prompt = `
Buat summary aktivitas user hari ini.

Data:
${content}

Aturan:
- Ringkas
- Bahasa Indonesia
- Fokus hal penting
`;

  return await askAI(
    'Kamu membuat daily summary.',
    prompt,
    {
      userId,
      question: 'daily summary',
      allowSearch: false,
      temperature: 0.3,
      maxTokens: 500
    }
  );
}

// ==================== AI CHAT ROUTER ====================

async function processAIMessage(chatId, userId, text, msg) {
  const systemPrompt = getSystemPrompt(userId);

  let answer;

  try {
    logMessageFlow('legacy_ai_start', {
      userId,
      chatId,
      text
    });
    answer = await smartReply(userId, text, systemPrompt);

    if (shouldRejectGenericGreeting(answer, text)) {
      logMessageFlow('legacy_ai_generic_greeting_retry', {
        userId,
        chatId,
        answerPreview: answer,
        text
      });
      answer = await askAI(
        `${systemPrompt}\n\nJawab langsung isi pesan user. Jangan gunakan greeting pembuka generik kecuali user hanya menyapa.`,
        `Pesan user asli:\n${text}`,
        {
          userId,
          question: `direct:${text}`,
          allowSearch: true,
          allowCache: false,
          temperature: 0.55,
          maxTokens: 1000
        }
      );
      answer = sanitizeOutgoingText(answer);
    }
  } catch (err) {
    log.error('AI fallback gagal:', {
      userId,
      chatId,
      error: err.message
    });

    answer =
      '❌ Maaf, AI sedang sibuk atau terjadi error sementara.';
  }

  if (!answer || answer.length < 2) {
    answer = 'Aku belum yakin menangkap maksudnya. Bisa jelaskan sedikit lagi atau beri contoh yang kamu maksud?';
  }

  answer = personalityResponse(
    getEffectiveMode(ensureUser(userId)),
    humanAISafety.applyHumanJudgmentFooter(answer, text)
  );

  let interactionExtra = {};
  try {
    const interactive = await interactions.manager.buildInteractiveResponse({
      userId,
      chatId,
      userText: text,
      answerText: answer,
      mode: getEffectiveMode(ensureUser(userId)),
      intent: 'legacy_ai_fallback'
    });
    if (interactive?.reply_markup) {
      interactionExtra.reply_markup = interactive.reply_markup;
    }
  } catch (err) {
    log.warn('Interaction keyboard skipped:', err.message);
  }

  await sendStreamingAnswer(chatId, answer, {
    reply_to_message_id: msg.message_id,
    disable_web_page_preview: true,
    ...interactionExtra
  });

  pushChatHistory({
    userId,
    chatId,
    role: 'assistant',
    text: answer,
    timestamp: nowMs()
  });

  await saveConversationPair(userId, text, answer);

  await rememberImportantFact(userId, text);

  await autoLearn(text, answer);

  return answer;
}

// ==================== SMART FILE QUESTION ====================

async function smartFileQuestion(chatId, userId, text, msg) {
  const u = ensureUser(userId);

  if (!u.lastFileText) return false;

  const lower = safeLower(text);

  const triggers = [
    'di file',
    'dari file',
    'isi file',
    'berdasarkan file',
    'menurut file'
  ];

  if (!triggers.some(t => lower.includes(t))) {
    return false;
  }

  const result = await analyzeFileContent(
    userId,
    u.lastFileName || 'file',
    u.lastFileText,
    text
  );

  await sendChunkedMessage(
    chatId,
    `📄 Jawaban berdasarkan file:\n\n${result}`,
    {
      reply_to_message_id: msg.message_id
    }
  );

  return true;
}

// ==================== AI AUTOCORRECT ====================

function autoFixText(text) {
  let t = String(text || '');

  const fixes = [
    ['gmn', 'gimana'],
    ['knp', 'kenapa'],
    ['sy', 'saya'],
    ['aq', 'aku'],
    ['yg', 'yang']
  ];

  for (const [a, b] of fixes) {
    t = t.replace(
      new RegExp(`\\b${escapeRegExp(a)}\\b`, 'gi'),
      b
    );
  }

  return cleanupSpaces(t);
}

// ==================== AI TYPING SIMULATION ====================

async function sendTyping(chatId, duration = 2000) {
  try {
    await telegramPost('sendChatAction', {
      chat_id: chatId,
      action: 'typing'
    });

    await sleep(duration);
  } catch (_) {}
}

// ==================== AUTO REACTION ====================

function detectEmotion(text) {
  const q = safeLower(text);

  if (
    q.includes('sedih') ||
    q.includes('capek') ||
    q.includes('kecewa')
  ) {
    return 'sad';
  }

  if (
    q.includes('senang') ||
    q.includes('bahagia') ||
    q.includes('happy')
  ) {
    return 'happy';
  }

  if (
    q.includes('marah') ||
    q.includes('kesal')
  ) {
    return 'angry';
  }

  return 'neutral';
}

function emotionPrefix(emotion) {
  switch (emotion) {
    case 'sad':
      return '🤍 ';
    case 'happy':
      return '😄 ';
    case 'angry':
      return '🔥 ';
    default:
      return '';
  }
}
// =====================================================
// PART 11
// =====================================================

// ==================== AUTO-CLEANUP ====================

setInterval(() => {
  cleanupRuntimeState({
    userMemory,
    botSettings,
    getShortMemory: () => shortMemory,
    setShortMemory: (value) => { shortMemory = value; },
    getKnowledgeBase: () => knowledgeBase,
    setKnowledgeBase: (value) => { knowledgeBase = value; },
    getAbLog: () => abLog,
    setAbLog: (value) => { abLog = value; },
    aiCache,
    cleanupPatchState: cleanupPatch4State,
    rateBuckets,
    now: nowMs
  });

  if (global.gc) {
    try { global.gc(); } catch (_) {}
  }
}, 60000);

// ==================== ERROR HANDLER ====================

// ==================== SHUTDOWN ====================

async function shutdown() {
  try {
    console.log('🛑 Shutdown...');
    await persist().catch(() => {});

    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (_) {}
    }

    try {
      await storageManager.closeStorage();
    } catch (_) {}

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
installProcessGuards({ logger: log, shutdown });

// ==================== STARTUP ====================

async function start() {
  await initRedis();
  interactions.configure({ redisClient });
  await initStorage();
  await loadAllMemories();
  await loadPlugins();
  await restoreAllReminders();
  await restoreAllDigests();

  const webhookUrl = WEBHOOK_BASE_URL
    ? `${WEBHOOK_BASE_URL}/webhook/${TELEGRAM_TOKEN}`
    : null;

  server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);

    if (webhookUrl) {
      console.log(`🔗 Webhook URL: ${webhookUrl}`);
    }

    if (webhookUrl) {
      try {
        const result = await telegramPost('setWebhook', {
          url: webhookUrl,
          drop_pending_updates: false,
          allowed_updates: ['message', 'callback_query']
        });

        if (result.data?.ok) {
          console.log('✅ Webhook terpasang.');
        } else {
          console.error(
            '❌ Gagal set webhook:',
            result.data?.description || 'unknown'
          );
        }
      } catch (e) {
        console.error(
          '❌ Gagal set webhook:',
          e.response?.data || e.message
        );
      }
    } else {
      console.warn(
        '⚠️ Webhook URL belum diset. Isi WEBHOOK_URL, TELEGRAM_WEBHOOK_URL, atau RENDER_EXTERNAL_HOSTNAME.'
      );
    }
  });
}

start().catch(err => {
  console.error('❌ Startup gagal:', err);
  process.exit(1);
});

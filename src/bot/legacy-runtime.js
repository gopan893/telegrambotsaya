const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { readEnv, validateConfig } = require('../../config/env');
const { createLogger } = require('../../core/logger');
const { BoundedTTLMap } = require('../../core/ttl-map');
const { KeyedQueue } = require('../../core/keyed-queue');
const { CircuitBreaker } = require('../../core/circuit-breaker');
const { withRetry } = require('../../utils/retry');
const { readJsonFile, writeJsonFileAtomic } = require('../../storage/json-store');
const { installProcessGuards } = require('../../middleware/process-guards');
const { cleanupRuntimeState } = require('../../scheduler/cleanup');
const { chooseProviderOrder, shouldUseSearchFallback } = require('../../services/ai-router');
const { buildLearningGuide } = require('../../handlers/learning');
const autonomousEngine = require('../core/autonomous-engine');
const agentLearning = require('../agents/learning');
const selfImprovementAgent = require('../agents/self-improvement');
const aiOS = require('../ai-os');
const opsSystem = require('../ops');
const { createStorageManager } = require('../storage');
const adaptiveSystem = require('../adaptive');
const collaborationSystem = require('../collaboration');
const multiDeviceUX = require('../ux/multi-device-response');
const humanAISafety = require('../ux/human-ai-safety');
const conversationManager = require('../conversation');
const interactions = require('../interactions');
const naturalLanguage = require('../natural-language/natural-router');
const naturalToolRouter = require('../natural-language/natural-tool-router');
const dashboard = require('../dashboard');
const workspaceSystem = require('../workspace');
const plannerSystem = require('../planner');
const executorSystem = require('../executor');
const toolsSystem = require('../tools');
const backupSystem = require('../backup');
const integrationsSystem = require('../integrations');
const observabilitySystem = require('../observability');
const portfolioSystem = require('../portfolio');
const researchSystem = require('../research');
const lifeosSystem = require('../lifeos');
const telegramControl = require('../telegram-control');
const multibotSystem = require('../multibot');
const smartAgentSystem = require('../agents');
const {
  formatDashboardStorageStatus,
  formatDbStatus,
  formatRedisStatus
} = require('../dashboard/storage-status-formatters');
const outputSanitizer = require('../ai-os/output-sanitizer');
const fileIntentGuard = require('../multimodal/file-intent-guard');
const {
  sendTelegramMessage,
  sendTelegramWithKeyboard
} = require('../utils/telegram-sender');


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
const voiceService = require('../voice/voice-service');

const config = readEnv();

try {
  validateConfig(config);
} catch (err) {
  const msg = err.message || '';
  if (msg.includes('TELEGRAM_TOKEN')) {
    throw new Error(msg + '.');
  }
  console.warn('⚠️ ' + msg + '.');
}

const {
  TELEGRAM_TOKEN,
  MISTRAL_API_KEY,
  GROQ_API_KEY,
  GACOR_API_KEY,
  GACOR_BASE_URL = 'https://rbeafse.abc-tunnel.us/v1',
  GACOR_MODEL = 'gacor',
  TAVILY_API_KEY,
  GOOGLE_SEARCH_API_KEY,
  GOOGLE_SEARCH_CX,
  OPENWEATHER_API_KEY,
  DATABASE_URL,
  STORAGE_DRIVER,
  REDIS_URL,
  DASHBOARD_ENABLED,
  DASHBOARD_ADMIN_TOKEN,
  DASHBOARD_WRITE_TOKEN,
  DASHBOARD_DANGER_TOKEN,
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

multibotSystem.botRegistry.loadBotConfigs(config);
for (const warning of multibotSystem.botRegistry.detectConfigWarnings?.(config) || []) {
  console.warn(`[multibot] ${warning.message}`);
}

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
let chatMemory = {}; // per-chat: {chatId: {topics:[], participants:[], summary:'', lastActive:ts}}
let chatMode = {};  // per-chat: {chatId: 'auto'|'santai'|'formal'}
let chatTodos = {}; // per-chat: {chatId: [{text, done}]}
let chatCalendar = {}; // per-chat calendar tokens
let abLog = [];
let knowledgeBase = [];
let chatHistory = [];
let chatHistoryMap = {}; // per-chat: {chatId: [{userId, chatId, role, text, timestamp}]}
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

function sanitizeOutgoingText(text, opts = {}) {
  const original = String(text || '').trim();
  let t = stripCodeFences(original);

  if (looksLikeIntentJSON(t)) {
    const parsed = extractJsonObject(t);

    if (parsed && parsed.intent) {
      return '';
    }
  }

  // Phase 10 Hotfix 2: strip internal debug markers / project context leakage
  const sanitized = outputSanitizer.sanitizeAssistantVisibleText(original, {
    isAdmin: Boolean(opts.isAdmin),
    userText: opts.userText || '',
    forceClean: Boolean(opts.forceClean),
    fileRelated: Boolean(opts.fileRelated) || fileIntentGuard.isFileRelatedMessage(opts.userText || '', opts)
  });
  return multiDeviceUX.normalizeForTelegram(sanitized);
}

function splitTelegramSendOptions(extra = {}) {
  const {
    fileRelated,
    userText,
    hasAttachment,
    msg,
    update,
    forceClean,
    ...telegramExtra
  } = extra || {};
  return {
    telegramExtra,
    sanitizerOptions: {
      fileRelated: Boolean(fileRelated) || fileIntentGuard.isFileRelatedMessage(userText || '', { hasAttachment, msg, update }),
      userText: userText || '',
      hasAttachment,
      forceClean
    }
  };
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
  // Always push to global for backward compat
  chatHistory.push(entry);
  if (chatHistory.length > 400) chatHistory.shift();

  // Also push per-chat for multi-chat context
  if (entry?.chatId) {
    if (!chatHistoryMap[entry.chatId]) chatHistoryMap[entry.chatId] = [];
    const arr = chatHistoryMap[entry.chatId];
    arr.push(entry);
    if (arr.length > 200) arr.splice(0, arr.length - 200);
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

function ensureChat(chatId) {
  const id = String(chatId);
  if (!chatMemory[id]) chatMemory[id] = { topics: [], participants: {}, summary: '', lastActive: 0 };
  if (!chatMode[id]) chatMode[id] = 'auto';
  if (!chatTodos[id]) chatTodos[id] = [];
  chatMemory[id].lastActive = nowMs();
  return { memory: chatMemory[id], mode: chatMode[id], todos: chatTodos[id] };
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
      lastChatId: null,
      voiceReplyEnabled: false
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

Catatan kemampuan internet:
- Model AI tidak browsing langsung.
- Server bot dapat memakai tool/API seperti OpenWeather untuk cuaca dan Tavily untuk pencarian jika env tersedia.
- Untuk data real-time, arahkan ke tool/API atau jelaskan env yang dibutuhkan; jangan berkata mutlak bahwa bot tidak punya akses internet jika tool tersedia.

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
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 2000)),
      lazyConnect: true
    });
    redisClient.on('error', () => {});

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
  const safeChatHistoryMap = chatHistoryMap && typeof chatHistoryMap === 'object' ? chatHistoryMap : {};
  const safeLessons = lessons && typeof lessons === 'object' ? lessons : { rules: [] };
  if (!Array.isArray(safeLessons.rules)) safeLessons.rules = [];

  await Promise.all([
    saveData('memory', safeShortMemory.slice(-botSettings.maxShortMemory)),
    saveData('lessons', safeLessons),
    saveData('user_memory', userMemory),
    saveData('ab_log', safeAbLog.slice(-botSettings.maxAbLog)),
    saveData('knowledge', safeKnowledgeBase.slice(-botSettings.maxKnowledge)),
    saveData('bot_settings', botSettings),
    saveData('chat_history', safeChatHistory.slice(-400)),
    saveData('chat_history_map', safeChatHistoryMap),
    saveData('chat_memory', chatMemory),
    saveData('chat_mode', chatMode)
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
  chatHistoryMap = await loadData('chat_history_map', {});
  chatMemory = await loadData('chat_memory', {});
  chatMode = await loadData('chat_mode', {});
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
  const { telegramExtra, sanitizerOptions } = splitTelegramSendOptions(extra);
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    sanitizeOutgoingText(text, sanitizerOptions),
    telegramExtra
  );
}

async function sendChunkedMessage(chatId, text, extra = {}) {
  const { telegramExtra, sanitizerOptions } = splitTelegramSendOptions(extra);
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    sanitizeOutgoingText(text, sanitizerOptions),
    telegramExtra
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

async function transcribeVoice(fileId) {
  try {
    const buffer = await downloadTelegramFile(fileId);
    const FormData = FormDataLib;
    if (!FormData) return null;
    const form = new FormData();
    form.append('file', buffer, { filename: 'voice.ogg', contentType: 'audio/ogg' });
    form.append('model', GACOR_MODEL);
    const res = await axios.post(`${GACOR_BASE_URL}/audio/transcriptions`, form, {
      headers: { Authorization: `Bearer ${GACOR_API_KEY}`, ...form.getHeaders() },
      timeout: 30000
    });
    return res.data.text || '';
  } catch (err) {
    log.warn('Voice transcribe error:', err.message);
    return null;
  }
}

async function sendVoiceMessage(chatId, text) {
  try {
    const res = await axios.post('http://localhost:5000/tts', { text }, { timeout: 30000 });
    if (res.data && res.data.audio) {
      const audioBytes = Buffer.from(res.data.audio, 'base64');
      const FormData = FormDataLib;
      if (!FormData) return false;
      const form = new FormData();
      form.append('voice', audioBytes, { filename: 'reply.ogg', contentType: 'audio/ogg' });
      form.append('chat_id', String(chatId));
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendVoice`, form, {
        headers: form.getHeaders(), timeout: 30000
      });
      return true;
    }
    return false;
  } catch (err) {
    log.warn('Voice send error:', err.message);
    return false;
  }
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
  const { telegramExtra, sanitizerOptions } = splitTelegramSendOptions(extra);
  return sendTelegramMessage(
    { telegramPost, logger: log },
    chatId,
    sanitizeOutgoingText(text, sanitizerOptions),
    telegramExtra
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

async function searchWebGoogle(query, maxResults = 5) {
  if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
    return null;
  }
  try {
    const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_SEARCH_API_KEY,
        cx: GOOGLE_SEARCH_CX,
        q: query,
        num: Math.min(maxResults, 10)
      },
      timeout: 10000
    });
    const items = res.data.items || [];
    return {
      answer: res.data.searchInformation?.formattedTotalResults ? `~${res.data.searchInformation.formattedTotalResults} hasil` : null,
      results: items.map(item => ({
        title: item.title || '',
        url: item.link || '',
        content: (item.snippet || '').slice(0, 250)
      }))
    };
  } catch (err) {
    log.warn('Google Search error:', err.message);
    return null;
  }
}

async function searchWebFallback(query) {
  const googleRes = await searchWebGoogle(query, 5);
  if (googleRes && googleRes.results.length > 0) return googleRes;
  return await searchWebTavilyRaw(query, 6);
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

async function askGacor(systemPrompt, userPrompt, temperature = 0.7, maxTokens = 800) {
  if (!GACOR_API_KEY) {
    throw new Error('GACOR_API_KEY tidak diset');
  }

  const res = await withRetry(
    () => axios.post(
      `${GACOR_BASE_URL}/chat/completions`,
      {
        model: GACOR_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      },
      {
        headers: { Authorization: `Bearer ${GACOR_API_KEY}` },
        timeout: 30000
      }
    ),
    {
      retries: 1,
      baseDelayMs: 500,
      onRetry: (err, attempt) => log.warn(`Gacor retry #${attempt}:`, err.message)
    }
  );

  const choice = res.data.choices?.[0]?.message;
  return choice?.content || choice?.reasoning_content || '';
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

  return 'gacor';
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
      gacor: Boolean(GACOR_API_KEY),
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
        : m === 'gacor'
          ? await askGacor(systemPrompt, userPrompt, temperature, maxTokens)
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
Migration: ${storage.migrations || 'skipped'}
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
	Storage: ${storage.persistentType}, cache ${storage.cache?.type || '-'}, migration ${storage.migrations || 'skipped'}
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

function formatProductionHealth(health = {}) {
  const checks = health.checks || [];
  const problemChecks = checks.filter(check => check.status !== 'healthy');
  return [
    'Production Health',
    '',
    `Status: ${health.status || 'unknown'}`,
    `Checks: ${checks.length}`,
    `Warnings: ${(health.warnings || []).length}`,
    `Blockers: ${(health.blockers || []).length}`,
    '',
    problemChecks.length ? 'Degraded checks:' : 'Semua check utama sehat.',
    ...(problemChecks.length ? problemChecks.map(check => `- ${check.id}: ${check.status}${(check.warnings || check.blockers || [])[0] ? ` — ${(check.warnings || check.blockers || [])[0]}` : ''}`) : []),
    '',
    'Catatan: health check read-only dan output sudah disanitasi.'
  ].join('\n');
}

function formatProductionIncidentLine(incident = {}, index = 0) {
  return `${index + 1}. ${incident.id} — ${incident.title} [${incident.severity}/${incident.status}] ${incident.updatedAt || incident.lastSeenAt || ''}`;
}

function formatProductionIncidentDetail(incident = {}, timeline = []) {
  if (!incident) return 'Incident tidak ditemukan.';
  return [
    `Incident: ${incident.id}`,
    `Title: ${incident.title}`,
    `Severity: ${incident.severity}`,
    `Status: ${incident.status}`,
    `Affected: ${(incident.affectedSystems || []).join(', ') || '-'}`,
    `First seen: ${incident.firstSeenAt || '-'}`,
    `Last seen: ${incident.lastSeenAt || '-'}`,
    '',
    incident.summary || '-',
    '',
    incident.rootCauseHypothesis ? [
      'Root cause hypothesis:',
      `- Confidence: ${incident.rootCauseHypothesis.confidence}`,
      `- Cause: ${incident.rootCauseHypothesis.likelyCause}`,
      `- Mitigation: ${incident.rootCauseHypothesis.recommendedMitigation}`
    ].join('\n') : 'Root cause belum dianalisis. Gunakan /analyze_incident <id>.',
    '',
    'Timeline:',
    ...(timeline.length ? timeline.slice(-6).map(event => `- ${event.time || '-'} ${event.type || 'event'}: ${event.summary || '-'}`) : ['- belum ada event']),
    '',
    'Actions:',
    `/responseplan ${incident.id}`,
    `/propose_incident_repair ${incident.id}`,
    `/propose_incident_rollback ${incident.id}`
  ].join('\n');
}

async function getLatestProductionIncident(services) {
  const incidents = await observabilitySystem.incidentStore.listIncidents({ status: 'open', limit: 1 }, services);
  return incidents[0] || null;
}

async function handleObservabilityCommands(chatId, userId, cmd, args, msg) {
  const commands = new Set([
    '/prodhealth',
    '/incidents',
    '/incident',
    '/analyze_incident',
    '/incident_timeline',
    '/responseplan',
    '/propose_incident_repair',
    '/propose_incident_rollback',
    '/close_incident'
  ]);
  if (!commands.has(cmd)) return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    await sendChunkedMessage(chatId, 'Production Observability hanya untuk admin/owner.', replyOpt);
    return true;
  }

  const services = getObservabilityServices(userId);

  if (cmd === '/prodhealth') {
    const health = await observabilitySystem.productionHealthMonitor.runProductionHealthCheck(services);
    const detection = await observabilitySystem.incidentDetector.detectIncidentFromHealthCheck(health, services);
    const suffix = detection.incident ? `\nIncident: ${detection.incident.id} (${detection.deduped ? 'existing' : 'new'})` : '';
    await sendChunkedMessage(chatId, `${formatProductionHealth(health)}${suffix}`, replyOpt);
    return true;
  }

  if (cmd === '/incidents') {
    const incidents = await observabilitySystem.incidentStore.listIncidents({ status: 'open', limit: 10 }, services);
    const opsIncidents = !incidents.length && opsSystem?.incidentHandler?.listRecentIncidents
      ? opsSystem.incidentHandler.listRecentIncidents(getOpsServices(), 5)
      : [];
    const body = incidents.length
      ? incidents.map(formatProductionIncidentLine).join('\n')
      : (opsIncidents.length ? `Production incident belum ada.\n\nOps incidents lama:\n${opsIncidents.map(formatIncidentLine).join('\n')}` : 'Belum ada production incident terbuka.');
    await sendChunkedMessage(chatId, `Production Incidents\n\n${body}`, replyOpt);
    return true;
  }

  if (cmd === '/incident') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, 'Format: /incident <incidentId>', replyOpt);
      return true;
    }
    const incident = await observabilitySystem.incidentStore.getIncident(incidentId, services);
    if (incident) {
      const tl = await observabilitySystem.incidentTimeline.getIncidentTimeline(incident.id, services);
      await sendChunkedMessage(chatId, formatProductionIncidentDetail(incident, tl), replyOpt);
      return true;
    }
    const oldIncident = opsSystem.incidentHandler.getIncident(incidentId, getOpsServices());
    await sendChunkedMessage(chatId, formatIncidentDetail(oldIncident), replyOpt);
    return true;
  }

  if (cmd === '/analyze_incident') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, 'Format: /analyze_incident <incidentId>', replyOpt);
      return true;
    }
    const incident = await observabilitySystem.incidentStore.getIncident(incidentId, services);
    if (!incident) {
      await sendChunkedMessage(chatId, `Incident tidak ditemukan: ${incidentId}`, replyOpt);
      return true;
    }
    const analysis = await observabilitySystem.rootCauseAnalyzer.analyzeRootCause(incident, services);
    await observabilitySystem.incidentStore.updateIncident(incident.id, { rootCauseHypothesis: analysis, status: 'investigating' }, services);
    await sendChunkedMessage(chatId, [
      'Root Cause Hypothesis',
      '',
      `Confidence: ${analysis.confidence}`,
      `Likely cause: ${analysis.likelyCause}`,
      `Evidence: ${(analysis.evidence || []).join('; ') || '-'}`,
      `Next checks: ${(analysis.recommendedNextChecks || []).join('; ') || '-'}`,
      `Mitigation: ${analysis.recommendedMitigation}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/incident_timeline') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, 'Format: /incident_timeline <incidentId>', replyOpt);
      return true;
    }
    const incident = await observabilitySystem.incidentStore.getIncident(incidentId, services);
    const summary = incident ? await observabilitySystem.incidentTimeline.summarizeIncidentTimeline(incident, services) : 'Incident tidak ditemukan.';
    await sendChunkedMessage(chatId, `Incident Timeline\n\n${summary}`, replyOpt);
    return true;
  }

  if (cmd === '/responseplan') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, 'Format: /responseplan <incidentId>', replyOpt);
      return true;
    }
    const result = await observabilitySystem.incidentResponsePlanner.createIncidentResponsePlan(incidentId, services);
    await sendChunkedMessage(chatId, result.ok
      ? `${observabilitySystem.incidentResponsePlanner.buildIncidentResponseSummary(result.plan)}\n\nBelum ada action dijalankan. Proposal repair/rollback harus dibuat dan di-approve.`
      : `Response plan gagal: ${result.error || 'unknown'}`, replyOpt);
    return true;
  }

  if (cmd === '/propose_incident_repair' || cmd === '/propose_incident_rollback') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, `Format: ${cmd} <incidentId>`, replyOpt);
      return true;
    }
    const incident = await observabilitySystem.incidentStore.getIncident(incidentId, services);
    if (!incident) {
      await sendChunkedMessage(chatId, `Incident tidak ditemukan: ${incidentId}`, replyOpt);
      return true;
    }
    let planId = incident.responsePlanId;
    if (!planId) {
      const planned = await observabilitySystem.incidentResponsePlanner.createIncidentResponsePlan(incidentId, services);
      planId = planned.plan?.id;
    }
    const result = cmd === '/propose_incident_rollback'
      ? await observabilitySystem.incidentProposalBuilder.createIncidentRollbackProposal(planId, services, { actorId: userId, userId })
      : await observabilitySystem.incidentProposalBuilder.createIncidentRepairProposal(planId, services, { actorId: userId, userId });
    await sendChunkedMessage(chatId, result.ok ? [
      cmd === '/propose_incident_rollback' ? 'Rollback proposal dibuat.' : 'Repair proposal dibuat.',
      `Proposal: ${result.proposal.id}`,
      `Risk: ${result.proposal.riskLevel}`,
      `Evaluation gate: ${result.evaluation?.passed ? 'passed' : result.evaluation?.reason || 'not passed'}`,
      '',
      'Belum dijalankan.',
      `Approve: /approve ${result.proposal.id}`,
      `Run setelah approve: /runexec ${result.proposal.id}`
    ].join('\n') : `Proposal gagal: ${result.error || 'Evaluation/executor unavailable'}`, replyOpt);
    return true;
  }

  if (cmd === '/close_incident') {
    const incidentId = String(args || '').trim();
    if (!incidentId) {
      await sendChunkedMessage(chatId, 'Format: /close_incident <incidentId>', replyOpt);
      return true;
    }
    const incident = await observabilitySystem.incidentStore.getIncident(incidentId, services);
    if (!incident) {
      await sendChunkedMessage(chatId, `Incident tidak ditemukan: ${incidentId}`, replyOpt);
      return true;
    }
    await observabilitySystem.incidentStore.updateIncident(incident.id, { status: 'closed', closedAt: new Date().toISOString() }, services);
    await sendChunkedMessage(chatId, `Incident ${incident.id} ditutup.`, replyOpt);
    return true;
  }

  return false;
}

function detectNaturalObservabilityIntent(text = '') {
  const q = String(text || '').toLowerCase();
  if (!q || q.startsWith('/')) return { handled: false };
  if (/cek .*production health|production health|prodhealth|health produksi|status produksi/.test(q)) return { handled: true, type: 'health' };
  if (/ada incident apa|incident apa|insiden apa|daftar incident|incident terbuka/.test(q)) return { handled: true, type: 'list' };
  if (/kenapa deploy gagal|deploy gagal|app down setelah deploy|dashboard error setelah push/.test(q)) return { handled: true, type: 'analyze_latest_deploy' };
  if (/buat response plan|buat rencana response|response plan/.test(q)) return { handled: true, type: 'response_plan' };
  if (/rollback kalau perlu|buat rollback|rollback proposal|perlu rollback/.test(q)) return { handled: true, type: 'rollback_proposal' };
  if (/tutup incident ini|close incident|tutup insiden/.test(q)) return { handled: true, type: 'close_help' };
  return { handled: false };
}

async function handleNaturalObservabilityRoute(chatId, userId, userText, msg) {
  const intent = detectNaturalObservabilityIntent(userText);
  if (!intent.handled) return { handled: false };
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    const answer = 'Production Observability hanya untuk admin/owner. Saya tidak menjalankan diagnosis produksi dari akun non-admin.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }
  const services = getObservabilityServices(userId);

  if (intent.type === 'health') {
    const health = await observabilitySystem.productionHealthMonitor.runProductionHealthCheck(services);
    const detection = await observabilitySystem.incidentDetector.detectIncidentFromHealthCheck(health, services);
    const answer = `${formatProductionHealth(health)}${detection.incident ? `\nIncident: ${detection.incident.id}` : ''}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'list') {
    const incidents = await observabilitySystem.incidentStore.listIncidents({ status: 'open', limit: 8 }, services);
    const answer = incidents.length
      ? `Production incidents terbuka:\n${incidents.map(formatProductionIncidentLine).join('\n')}`
      : 'Belum ada production incident terbuka.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  const incident = await getLatestProductionIncident(services);
  if (!incident && ['response_plan', 'rollback_proposal', 'analyze_latest_deploy'].includes(intent.type)) {
    const created = await observabilitySystem.incidentDetector.detectIncidentFromDeployFailure({
      summary: 'User asked about deploy failure; incident created for investigation.'
    }, services);
    const answer = `Saya buat incident investigasi deploy: ${created.incident.id}.\nBelum ada aksi dijalankan.\nLanjut: /analyze_incident ${created.incident.id}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'analyze_latest_deploy') {
    const analysis = await observabilitySystem.rootCauseAnalyzer.analyzeRootCause(incident, services);
    await observabilitySystem.incidentStore.updateIncident(incident.id, { rootCauseHypothesis: analysis, status: 'investigating' }, services);
    const answer = [
      `Incident terbaru: ${incident.id}`,
      `Kemungkinan penyebab: ${analysis.likelyCause}`,
      `Confidence: ${analysis.confidence}`,
      `Next checks: ${(analysis.recommendedNextChecks || []).join('; ') || '-'}`,
      '',
      'Saya belum menjalankan repair/rollback. Jika perlu: /responseplan ' + incident.id
    ].join('\n');
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'response_plan') {
    const result = await observabilitySystem.incidentResponsePlanner.createIncidentResponsePlan(incident.id, services);
    const answer = result.ok
      ? `${observabilitySystem.incidentResponsePlanner.buildIncidentResponseSummary(result.plan)}\n\nBelum ada aksi dijalankan. Repair/rollback harus proposal + approval.`
      : `Response plan gagal: ${result.error || 'unknown'}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'rollback_proposal') {
    let planId = incident.responsePlanId;
    if (!planId) {
      const planned = await observabilitySystem.incidentResponsePlanner.createIncidentResponsePlan(incident.id, services);
      planId = planned.plan?.id;
    }
    const result = await observabilitySystem.incidentProposalBuilder.createIncidentRollbackProposal(planId, services, { actorId: userId, userId });
    const answer = result.ok ? [
      'Rollback proposal dibuat, belum dijalankan.',
      `Proposal: ${result.proposal.id}`,
      `Risk: ${result.proposal.riskLevel}`,
      `Approve: /approve ${result.proposal.id}`,
      `Run setelah approve: /runexec ${result.proposal.id}`
    ].join('\n') : `Rollback proposal belum dibuat: ${result.error || 'Evaluation/executor unavailable'}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'close_help') {
    const answer = incident
      ? `Untuk menutup incident terbaru gunakan: /close_incident ${incident.id}`
      : 'Tidak ada incident terbuka untuk ditutup.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  return { handled: false };
}

function formatPortfolioPriorityLine(item = {}, index = 0) {
  return `${index + 1}. ${item.goal?.title || item.goalId || '-'} — score ${item.priorityScore || 0}/100, health ${item.health?.score ?? '-'} (${item.health?.status || '-'})`;
}

function formatPortfolioNextAction(result = {}) {
  return [
    'Portfolio Next Action',
    '',
    result.summary || 'Belum ada rekomendasi.',
    '',
    result.requiresProposal
      ? 'Action berisiko harus dibuat sebagai proposal. Tidak ada aksi dijalankan otomatis.'
      : 'Ini rekomendasi read-only. Action write/external tetap butuh proposal + approval.'
  ].join('\n');
}

async function handlePortfolioCommands(chatId, userId, cmd, args, msg) {
  const commands = new Set([
    '/portfolio',
    '/projects',
    '/projecthealth',
    '/priorities',
    '/nextproject',
    '/portfolio_next',
    '/weeklyplan',
    '/monthlyplan',
    '/staleprojects',
    '/projectrisks',
    '/portfolioreport',
    '/portfolio_proposal'
  ]);
  if (!commands.has(cmd)) return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    await sendChunkedMessage(chatId, 'Portfolio Manager hanya untuk admin/owner karena membaca data project lintas workspace.', replyOpt);
    return true;
  }
  const services = getPortfolioServices(userId);
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);

  if (cmd === '/portfolio' || cmd === '/projects') {
    const snapshot = await portfolioSystem.portfolioScanner.buildPortfolioSnapshot(workspaceId, services);
    await sendChunkedMessage(chatId, [
      'Portfolio Manager',
      '',
      `Workspace: ${snapshot.workspaceId}`,
      `Active projects: ${snapshot.totals.activeGoals}`,
      `Open tasks: ${snapshot.totals.activeTasks}`,
      `Blocked tasks: ${snapshot.totals.blockedTasks}`,
      `Pending approvals: ${snapshot.totals.pendingApprovals}`,
      `Open incidents: ${snapshot.totals.openIncidents}`,
      '',
      'Projects:',
      ...(snapshot.activeGoals.length ? snapshot.activeGoals.slice(0, 10).map((goal, i) => `${i + 1}. ${goal.title} (${goal.priority || 'medium'}, ${goal.status || 'active'})`) : ['- belum ada active project']),
      '',
      `Dashboard: ${WEBHOOK_URL ? `${WEBHOOK_URL.replace(/\/$/, '')}/dashboard#portfolio` : '/dashboard#portfolio'}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/projecthealth') {
    const goalId = String(args || '').trim();
    if (goalId) {
      const summary = await portfolioSystem.projectHealthScorer.buildProjectHealthSummary(goalId, services);
      await sendChunkedMessage(chatId, summary, replyOpt);
      return true;
    }
    const snapshot = await portfolioSystem.portfolioScanner.buildPortfolioSnapshot(workspaceId, services);
    const rows = [];
    for (const goal of snapshot.activeGoals.slice(0, 10)) {
      const health = await portfolioSystem.projectHealthScorer.scoreProjectHealth(goal.id, services);
      rows.push(`- ${goal.title}: ${health.score}/100 (${health.status})`);
    }
    await sendChunkedMessage(chatId, `Project Health\n\n${rows.join('\n') || '- belum ada project aktif'}`, replyOpt);
    return true;
  }

  if (cmd === '/priorities' || cmd === '/nextproject') {
    const ranked = await portfolioSystem.projectPriorityEngine.rankProjects(workspaceId, services);
    await sendChunkedMessage(chatId, [
      'Portfolio Priorities',
      '',
      ranked.length ? ranked.slice(0, 8).map(formatPortfolioPriorityLine).join('\n') : 'Belum ada project aktif.',
      '',
      ranked[0] ? `Rekomendasi: ${ranked[0].recommendation}` : ''
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/portfolio_next') {
    const next = await portfolioSystem.portfolioNextActionEngine.recommendPortfolioNextAction(workspaceId, services);
    await sendChunkedMessage(chatId, formatPortfolioNextAction(next), replyOpt);
    return true;
  }

  if (cmd === '/weeklyplan' || cmd === '/monthlyplan') {
    const plan = cmd === '/monthlyplan'
      ? await portfolioSystem.portfolioStrategyPlanner.createMonthlyPortfolioPlan(workspaceId, services)
      : await portfolioSystem.portfolioStrategyPlanner.createWeeklyPortfolioPlan(workspaceId, services);
    await sendChunkedMessage(chatId, [
      plan.title,
      '',
      `Type: ${plan.type}`,
      `Risk: ${plan.riskLevel}`,
      '',
      ...(plan.steps || []).map((step, i) => `${i + 1}. ${step}`),
      '',
      'Belum ada aksi dijalankan.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/staleprojects') {
    const stale = await portfolioSystem.projectStalenessDetector.detectStaleProjects(workspaceId, services);
    const body = stale.stale.length
      ? stale.stale.slice(0, 10).map(item => `- ${item.goal.title}: ${item.suggestedAction}`).join('\n')
      : 'Tidak ada stale project besar.';
    await sendChunkedMessage(chatId, `Stale Projects\n\n${body}`, replyOpt);
    return true;
  }

  if (cmd === '/projectrisks') {
    const risk = await portfolioSystem.portfolioRiskReview.reviewPortfolioRisk(workspaceId, services);
    await sendChunkedMessage(chatId, [
      'Portfolio Risk',
      '',
      `Risk: ${risk.riskLevel}`,
      `Warnings: ${risk.warnings.length ? risk.warnings.join('; ') : '-'}`,
      `Recommendations: ${risk.recommendations.join(' ')}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/portfolioreport') {
    const report = await portfolioSystem.portfolioReportGenerator.generatePortfolioWeeklyReport(workspaceId, services);
    await sendChunkedMessage(chatId, report.text, replyOpt);
    return true;
  }

  if (cmd === '/portfolio_proposal') {
    const next = await portfolioSystem.portfolioNextActionEngine.recommendPortfolioNextAction(workspaceId, services);
    const actionPlan = await portfolioSystem.portfolioProposalBridge.createPortfolioActionPlan({ ...next, userId, workspaceId }, services);
    if (!actionPlan.ok) {
      await sendChunkedMessage(chatId, `Proposal belum dibuat: ${actionPlan.reason || actionPlan.error || 'unknown'}`, replyOpt);
      return true;
    }
    const proposal = await portfolioSystem.portfolioProposalBridge.createPortfolioExecutorProposal(actionPlan.actionPlan, services);
    await sendChunkedMessage(chatId, proposal.ok ? [
      'Portfolio proposal dibuat, belum dijalankan.',
      `Action plan: ${actionPlan.actionPlan.id}`,
      `Proposal: ${proposal.proposal.id}`,
      `Risk: ${proposal.proposal.riskLevel}`,
      `Evaluation: ${proposal.evaluation?.passed ? 'passed' : proposal.evaluation?.reason || 'not available'}`,
      '',
      `Approve: /approve ${proposal.proposal.id}`,
      `Run setelah approve: /runexec ${proposal.proposal.id}`
    ].join('\n') : `Portfolio proposal diblokir: ${proposal.reason || proposal.error || 'Evaluation gate required'}`, replyOpt);
    return true;
  }

  return false;
}

function formatResearchBriefForTelegram(summary = {}) {
  const facts = (summary.facts || []).slice(0, 4).map((item) => `- ${item}`).join('\n') || '- belum ada fakta terverifikasi';
  const unknowns = (summary.unknowns || []).slice(0, 4).map((item) => `- ${item}`).join('\n') || '- tidak ada gap besar dari sumber lokal';
  const recommendations = (summary.recommendations || []).slice(0, 4).map((item) => `- ${item}`).join('\n') || '- kumpulkan evidence tambahan';
  return [
    `Research: ${summary.topic || '-'}`,
    '',
    'Fakta berbasis evidence:',
    facts,
    '',
    'Unknown/gaps:',
    unknowns,
    '',
    'Rekomendasi:',
    recommendations,
    '',
    `Confidence: ${summary.confidence || 0}`,
    'Catatan: bagian live/current dianggap unknown jika connector tidak tersedia.'
  ].join('\n');
}

async function createAnalyzeResearchFromText(userId, text, options = {}) {
  const services = getResearchServices(userId);
  const workspaceId = options.workspaceId || await getDefaultWorkspaceIdForUser(userId);
  const taskResult = await researchSystem.researchTaskPlanner.createResearchTask({
    topic: options.topic || text,
    question: text,
    workspaceId,
    userId
  }, services);
  if (!taskResult.ok) return taskResult;
  const collected = await researchSystem.sourceCollector.collectSourcesForTask(taskResult.task.id, services);
  if (!collected.ok) return collected;
  await researchSystem.evidenceExtractor.buildEvidencePack(collected.task, null, services);
  const summary = await researchSystem.researchSummarizer.summarizeResearchTask(taskResult.task.id, services);
  if (!summary.ok) return summary;
  await researchSystem.researchKnowledgeLinker.linkResearchToKnowledgeGraph(taskResult.task.id, services).catch(() => null);
  return { ok: true, task: summary.task, summary: summary.summary };
}

async function handleResearchCommands(chatId, userId, cmd, args, msg) {
  const commands = new Set([
    '/research',
    '/research_task',
    '/research_sources',
    '/research_report',
    '/evidence',
    '/docs_agent',
    '/docs_gaps',
    '/docs_draft',
    '/docs_plan',
    '/propose_docs_update',
    '/source_check'
  ]);
  if (!commands.has(cmd)) return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    await sendChunkedMessage(chatId, 'Research/docs command hanya untuk admin/owner agar tidak menyimpan data sensitif tanpa kontrol.', replyOpt);
    return true;
  }
  const services = getResearchServices(userId);
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);

  if (cmd === '/research') {
    const summary = await researchSystem.researchReportGenerator.generateResearchActivitySummary({ workspaceId, limit: 10 }, services);
    const latest = (summary.latest || []).map((item, index) => `${index + 1}. ${item.id} - ${item.topic} [${item.status}/${item.scope}]`).join('\n') || '- belum ada task';
    await sendChunkedMessage(chatId, `Research / Docs Agent\n\nTasks: ${summary.totalTasks}\n${latest}\n\nBuat task: /research_task topik riset`, replyOpt);
    return true;
  }

  if (cmd === '/research_task') {
    if (!args) {
      await safeSendMessage(chatId, 'Format: /research_task topik atau pertanyaan riset', replyOpt);
      return true;
    }
    const result = await createAnalyzeResearchFromText(userId, args, { workspaceId });
    await sendChunkedMessage(chatId, result.ok
      ? `Research task dibuat: ${result.task.id}\n\n${formatResearchBriefForTelegram(result.summary)}`
      : `Research ditolak/gagal: ${result.reason || result.error || 'unknown'}`, replyOpt);
    return true;
  }

  if (cmd === '/research_sources' || cmd === '/source_check') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, `Format: ${cmd} <researchTaskId>`, replyOpt);
      return true;
    }
    const result = await researchSystem.sourceCollector.collectSourcesForTask(taskId, services);
    const sources = (result.sources || []).slice(0, 8).map((source, index) => `${index + 1}. ${source.title} [${source.type}, credibility ${source.credibilityScore || 0}, ${source.status}]`).join('\n') || '- tidak ada source';
    await sendChunkedMessage(chatId, result.ok ? `Sources untuk ${taskId}:\n${sources}` : `Source check gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/research_report' || cmd === '/evidence') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, `Format: ${cmd} <researchTaskId>`, replyOpt);
      return true;
    }
    const result = await researchSystem.researchSummarizer.createResearchBrief(taskId, services);
    await sendChunkedMessage(chatId, result.ok ? result.brief.text : `Report gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/docs_agent' || cmd === '/docs_gaps') {
    const report = await researchSystem.researchReportGenerator.generateDocumentationGapReport(services);
    const text = (report.items || []).map((item, index) => `${index + 1}. ${item.topic} -> ${item.docType} (${item.needsUpdate ? 'needs review' : 'ok'})`).join('\n') || '- tidak ada gap';
    await sendChunkedMessage(chatId, `Docs Gap Report:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/docs_draft') {
    const topic = args || 'dokumentasi env project ini';
    const plan = researchSystem.documentationAgent.createDocumentationPlan({ topic, question: topic, workspaceId, userId }, services);
    const draft = researchSystem.documentationDraftGenerator.generateDocumentationDraft(plan.plan, services);
    await sendChunkedMessage(chatId, draft.ok ? `Docs draft (${draft.draft.docType}):\n\n${draft.draft.body}` : `Draft gagal: ${draft.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/docs_plan' || cmd === '/propose_docs_update') {
    const topic = args || 'documentation update';
    const plan = researchSystem.documentationAgent.createDocumentationPlan({ topic, question: topic, workspaceId, userId }, services);
    const draft = researchSystem.documentationDraftGenerator.generateDocumentationDraft(plan.plan, services);
    const updatePlan = await researchSystem.documentationUpdatePlanner.createDocumentationUpdatePlan(draft.draft, services);
    if (cmd === '/docs_plan') {
      await sendChunkedMessage(chatId, updatePlan.ok ? `Docs update plan:\n${JSON.stringify(updatePlan.updatePlan, null, 2)}` : `Plan gagal: ${updatePlan.reason}`, replyOpt);
      return true;
    }
    const proposal = updatePlan.ok ? await researchSystem.documentationUpdatePlanner.createDocsUpdateProposal(updatePlan.updatePlan, services) : updatePlan;
    await sendChunkedMessage(chatId, proposal.ok
      ? `Docs proposal dibuat: ${proposal.proposal.id}\nBelum menulis file.\n\n${proposal.proposal.nextPrompt}`
      : `Proposal docs gagal: ${proposal.reason}`, replyOpt);
    return true;
  }

  return true;
}

async function handleNaturalResearchRoute(chatId, userId, userText, msg) {
  const q = safeLower(userText).trim();
  const wantsResearch = /^(riset|research|teliti|cari sumber|sumbernya|apa sumbernya)|\b(riset|research|source|evidence|sumber|kredibilitas)\b/.test(q);
  const wantsDocs = /(buat|update|perbarui|sinkron|cek|cari).*(dokumentasi|docs|readme|env|troubleshooting|phase|command)|docs.*(gap|belum sinkron|draft)/.test(q);
  if (!wantsResearch && !wantsDocs) return { handled: false };
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    const answer = 'Research/docs automation hanya untuk admin/owner agar tidak menyimpan data sensitif tanpa kontrol.';
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'research_denied', answer };
  }
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);
  const services = getResearchServices(userId);
  if (/github_token|ghp_|sk-|database_url|redis_url|token saya|secret saya/i.test(userText)) {
    const safety = researchSystem.researchSafetyGate.runResearchSafetyGate({ question: userText, userId, workspaceId }, services);
    const answer = `Saya tidak akan menyimpan secret sebagai source.\nStatus: ${safety.reason || 'redacted'}\nGunakan placeholder [REDACTED_SECRET] dan rotate secret jika pernah tertempel.`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'research_secret_blocked', answer };
  }
  if (wantsDocs) {
    const plan = researchSystem.documentationAgent.createDocumentationPlan({ topic: userText, question: userText, workspaceId, userId }, services);
    const draft = researchSystem.documentationDraftGenerator.generateDocumentationDraft(plan.plan, services);
    const answer = [
      `Saya buat draft dokumentasi (${draft.draft.docType}). Belum menulis file.`,
      '',
      draft.draft.body,
      '',
      'Jika perlu update repo, gunakan /propose_docs_update <topik>. Itu membuat proposal/prompt saja, bukan commit langsung.'
    ].join('\n');
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'docs_draft', answer };
  }
  const result = await createAnalyzeResearchFromText(userId, userText, { workspaceId });
  const answer = result.ok
    ? formatResearchBriefForTelegram(result.summary)
    : `Research gagal/terblokir: ${result.reason || result.error || 'unknown'}`;
  await sendChunkedMessage(chatId, answer, replyOpt);
  return { handled: true, type: 'research', answer };
}

function formatLifeDailyPlan(plan = {}) {
  const priorities = (plan.data?.topPriorities || []).slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join('\n') || '1. Satu task kecil';
  return [
    `Life OS Daily Plan (${plan.data?.date || plan.scheduledAt || 'today'})`,
    priorities,
    `Focus: ${plan.data?.focusBlock?.durationMinutes || 25} menit`,
    `Break: ${plan.data?.breakReminder || 'ambil jeda pendek'}`,
    `Refleksi: ${plan.data?.reflectionQuestion || 'Apa satu hal kecil yang cukup?'}`
  ].join('\n');
}

async function handleLifeOsCommands(chatId, userId, cmd, args, msg) {
  const commands = new Set([
    '/lifeos',
    '/daily',
    '/weekly',
    '/today',
    '/tasks',
    '/taskdone',
    '/habits',
    '/habitcheck',
    '/reminders',
    '/focus',
    '/mood',
    '/energy',
    '/lifegoals',
    '/lifereport',
    '/eveningreview'
  ]);
  if (!commands.has(cmd)) return false;
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    await safeSendMessage(chatId, 'Life OS command hanya untuk admin/owner agar catatan pribadi tidak tersimpan tanpa kontrol.', replyOpt);
    return true;
  }
  const services = getLifeOsServices(userId);
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);

  if (cmd === '/lifeos' || cmd === '/lifereport') {
    const summary = await lifeosSystem.lifeReportGenerator.generateLifeOSSummary(userId, { ...services, workspaceId });
    await sendChunkedMessage(chatId, summary.text, replyOpt);
    return true;
  }
  if (cmd === '/daily' || cmd === '/today') {
    const result = await lifeosSystem.dailyPlanner.createDailyPlan({ workspaceId, userId }, services);
    await sendChunkedMessage(chatId, result.ok ? formatLifeDailyPlan(result.plan) : `Daily plan gagal: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/weekly') {
    const result = await lifeosSystem.weeklyPlanner.createWeeklyPlan({ workspaceId, userId }, services);
    await sendChunkedMessage(chatId, result.ok ? `Weekly plan:\nMain goal: ${result.plan.data.mainGoal}\nRisk: ${result.plan.data.riskBlocker}` : `Weekly plan gagal: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/tasks') {
    if (args) {
      const created = await lifeosSystem.personalTaskManager.createPersonalTask({ title: args, workspaceId, userId }, services);
      await safeSendMessage(chatId, created.ok ? `Task dibuat: ${created.task.id} — ${created.task.title}` : `Task ditolak: ${created.reason}`, replyOpt);
      return true;
    }
    const tasks = await lifeosSystem.personalTaskManager.listPersonalTasks({ workspaceId, userId, limit: 10 }, services);
    await sendChunkedMessage(chatId, tasks.length ? tasks.map((task, i) => `${i + 1}. ${task.id} — ${task.title} [${task.status}]`).join('\n') : 'Belum ada personal task.', replyOpt);
    return true;
  }
  if (cmd === '/taskdone') {
    const taskId = String(args || '').trim();
    const result = taskId ? await lifeosSystem.personalTaskManager.completePersonalTask(taskId, services) : { ok: false, reason: 'TASK_ID_REQUIRED' };
    await safeSendMessage(chatId, result.ok ? `Task selesai: ${result.task.title}` : `Gagal: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/habits') {
    if (args) {
      const created = await lifeosSystem.habitTracker.createHabit({ title: args, workspaceId, userId }, services);
      await safeSendMessage(chatId, created.ok ? `Habit dibuat: ${created.habit.id} — ${created.habit.title}` : `Habit ditolak: ${created.reason}`, replyOpt);
      return true;
    }
    const habits = await lifeosSystem.lifeStore.listLifeItems({ workspaceId, userId, type: 'habit', limit: 10 }, services);
    await sendChunkedMessage(chatId, habits.length ? habits.map((habit, i) => `${i + 1}. ${habit.id} — ${habit.title} streak ${habit.data?.streak || 0}`).join('\n') : 'Belum ada habit.', replyOpt);
    return true;
  }
  if (cmd === '/habitcheck') {
    const habitId = String(args || '').trim();
    const result = habitId ? await lifeosSystem.habitTracker.logHabitCheckin(habitId, new Date(), true, services) : { ok: false, reason: 'HABIT_ID_REQUIRED' };
    await safeSendMessage(chatId, result.ok ? `Check-in habit. Streak: ${result.streak}` : `Gagal: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/reminders') {
    const result = args
      ? await lifeosSystem.reminderPlanner.createReminderPlan({ title: args, workspaceId, userId }, services)
      : { ok: true, items: await lifeosSystem.reminderPlanner.listReminderPlans({ workspaceId, userId, limit: 10 }, services) };
    await sendChunkedMessage(chatId, result.reminder ? `Reminder plan dibuat: ${result.reminder.title}\nScheduled: ${result.reminder.scheduledAt}\nPlan-only.` : (result.items || []).map((item, i) => `${i + 1}. ${item.title} [${item.scheduledAt || '-'}]`).join('\n') || 'Belum ada reminder.', replyOpt);
    return true;
  }
  if (cmd === '/focus') {
    const result = await lifeosSystem.focusSessionManager.createFocusSession({ title: args || 'Focus session', workspaceId, userId }, services);
    await safeSendMessage(chatId, result.ok ? `Focus session dibuat: ${result.session.id} (${result.session.data.durationMinutes} menit)` : `Focus gagal: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/mood' || cmd === '/energy') {
    const result = await lifeosSystem.energyMoodJournal.createEnergyMoodNote({ note: args || 'Mood/energy note', type: cmd === '/energy' ? 'energy_note' : 'mood_note', workspaceId, userId }, services);
    await sendChunkedMessage(chatId, result.ok ? `Catatan privat tersimpan.\n${result.supportiveMessage}` : `Catatan ditolak: ${result.reason}`, replyOpt);
    return true;
  }
  if (cmd === '/lifegoals') {
    if (args) {
      const result = await lifeosSystem.personalGoalManager.createPersonalGoal({ title: args, workspaceId, userId }, services);
      await safeSendMessage(chatId, result.ok ? `Personal goal dibuat: ${result.goal.id} — ${result.goal.title}` : `Goal ditolak: ${result.reason}`, replyOpt);
      return true;
    }
    const goals = await lifeosSystem.personalGoalManager.listPersonalGoals({ workspaceId, userId, limit: 10 }, services);
    await sendChunkedMessage(chatId, goals.length ? goals.map((goal, i) => `${i + 1}. ${goal.title} (${goal.data?.category || 'personal_growth'})`).join('\n') : 'Belum ada personal goal.', replyOpt);
    return true;
  }
  if (cmd === '/eveningreview') {
    const review = await lifeosSystem.lifeReportGenerator.generateEveningReview(userId, { ...services, workspaceId });
    await safeSendMessage(chatId, review.text, replyOpt);
    return true;
  }
  return true;
}

async function handleNaturalLifeOsRoute(chatId, userId, userText, msg) {
  const q = safeLower(userText).trim();
  if (!q || q.startsWith('/')) return { handled: false };
  const isLifePrompt = /(rencana hari ini|kerjakan sekarang|rutinitas belajar|catat mood|catat energy|catat energi|jadwalkan meeting|draft email|ringkasan minggu|ingat saya ingin|fokus belajar|selesaikan semua hidup)/i.test(userText);
  if (!isLifePrompt) return { handled: false };
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    const answer = 'Life OS hanya aktif untuk admin/owner agar data pribadi tidak tersimpan tanpa kontrol.';
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'lifeos_denied', answer };
  }
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);
  const services = getLifeOsServices(userId);
  if (/token|secret|database_url|redis_url|telegram_token|github_token/i.test(userText)) {
    const gate = lifeosSystem.lifeMemoryGovernance.runLifeMemorySafetyGate({ text: userText, workspaceId, userId }, services);
    const answer = `Saya tidak akan menyimpan secret sebagai Life OS memory.\nStatus: ${gate.reason || 'blocked/redacted'}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_secret_blocked', answer };
  }
  if (/selesaikan semua hidup/i.test(userText)) {
    const answer = 'Saya tidak bisa mengotomatisasi semua hidupmu. Saya bisa bantu buat plan kecil dan proposal untuk aksi eksternal, tapi semua write/external action tetap butuh approval.';
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_unsafe_automation_refused', answer };
  }
  if (/jadwalkan meeting/i.test(userText)) {
    const result = await lifeosSystem.lifeIntegrationProposal.createCalendarEventProposal({ title: userText, workspaceId, userId }, services);
    const answer = result.ok ? `Saya buat calendar proposal: ${result.proposal.id}\nBelum dijadwalkan. Approval dan run tetap terpisah.` : `Proposal gagal: ${result.reason}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_calendar_proposal', answer };
  }
  if (/draft email|buat draft email/i.test(userText)) {
    const result = await lifeosSystem.lifeIntegrationProposal.createGmailDraftProposal({ title: userText, workspaceId, userId }, services);
    const answer = result.ok ? `Saya buat Gmail draft proposal: ${result.proposal.id}\nBelum dibuat/dikirim. Gmail send disabled by default.` : `Proposal gagal: ${result.reason}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_gmail_proposal', answer };
  }
  if (/catat mood|catat energy|catat energi|capek/i.test(userText)) {
    const result = await lifeosSystem.energyMoodJournal.createEnergyMoodNote({ note: userText, workspaceId, userId }, services);
    const answer = result.ok ? `Dicatat privat.\n${result.supportiveMessage}` : `Catatan ditolak: ${result.reason}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_mood_note', answer };
  }
  if (/rutinitas belajar/i.test(userText)) {
    const result = await lifeosSystem.lifeIntegrationProposal.createRoutineProposalFromLifePlan({ title: userText, workspaceId, userId }, services);
    const answer = result.ok ? `Saya buat routine proposal: ${result.proposal.id}\nBelum dijadwalkan otomatis. Approval wajib sebelum scheduler aktif.` : `Proposal gagal: ${result.reason}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_routine_proposal', answer };
  }
  if (/ingat saya ingin/i.test(userText)) {
    const result = await lifeosSystem.lifeMemoryGovernance.storeSafeLifeMemory({ text: userText, workspaceId, userId }, services);
    const answer = result.ok && result.stored ? 'Saya simpan sebagai Life OS memory yang aman dan scoped privat bila sensitif.' : `Tidak disimpan: ${result.reason || 'tidak ada intent memory yang cukup jelas'}`;
    await safeSendMessage(chatId, answer, replyOpt);
    return { handled: true, type: 'life_memory', answer };
  }
  if (/ringkasan minggu/i.test(userText)) {
    const report = await lifeosSystem.lifeReportGenerator.generateWeeklyLifeReport(userId, { ...services, workspaceId });
    await sendChunkedMessage(chatId, report.text || 'Weekly report belum tersedia.', replyOpt);
    return { handled: true, type: 'life_weekly_report', answer: report.text || '' };
  }
  const plan = await lifeosSystem.dailyPlanner.createDailyPlan({ workspaceId, userId }, services);
  const answer = plan.ok ? formatLifeDailyPlan(plan.plan) : `Life OS gagal: ${plan.reason}`;
  await sendChunkedMessage(chatId, answer, replyOpt);
  return { handled: true, type: 'life_daily_plan', answer };
}

function detectNaturalPortfolioIntent(text = '') {
  const q = String(text || '').toLowerCase();
  if (!q || q.startsWith('/')) return { handled: false };
  if (/project mana.*lanjut|lanjutkan.*project|next project|project.*prioritas/.test(q)) return { handled: true, type: 'next_project' };
  if (/prioritas minggu ini|weekly plan|rencana minggu ini|apa prioritas/.test(q)) return { handled: true, type: 'weekly_plan' };
  if (/paling berisiko|project risk|mana yang.*risiko|risiko project/.test(q)) return { handled: true, type: 'risk' };
  if (/project.*macet|kenapa.*macet|blocked project|stale project/.test(q)) return { handled: true, type: 'stale' };
  if (/codex atau opencode|opencode atau codex|hermes.*project|agent.*project/.test(q)) return { handled: true, type: 'agent' };
  if (/rapikan semua project|organisasi.*project|atur semua project/.test(q)) return { handled: true, type: 'weekly_plan' };
  if (/lanjutkan yang paling penting|lanjut yang penting|kerjakan yang paling penting/.test(q)) return { handled: true, type: 'next_action' };
  if (/push dan deploy project paling penting|deploy project paling penting|push project paling penting/.test(q)) return { handled: true, type: 'proposal' };
  return { handled: false };
}

async function handleNaturalPortfolioRoute(chatId, userId, userText, msg) {
  const intent = detectNaturalPortfolioIntent(userText);
  if (!intent.handled) return { handled: false };
  const replyOpt = { reply_to_message_id: msg.message_id };
  if (!isAdmin(userId)) {
    const answer = 'Portfolio Manager hanya untuk admin/owner karena membaca data project lintas workspace.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }
  const services = getPortfolioServices(userId);
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);

  if (intent.type === 'next_project') {
    const top = await portfolioSystem.projectPriorityEngine.recommendTopProject(workspaceId, services);
    const answer = top.topProject
      ? `Project yang sebaiknya dilanjutkan: ${top.topProject.goal.title}\n\n${top.summary}\n\nLangkah aman: cek /portfolio_next untuk task berikutnya.`
      : 'Belum ada project aktif yang bisa diranking.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'weekly_plan') {
    const plan = await portfolioSystem.portfolioStrategyPlanner.createWeeklyPortfolioPlan(workspaceId, services);
    const answer = `${plan.title}\n\n${(plan.steps || []).map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nTidak ada aksi dijalankan otomatis.`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'risk') {
    const risk = await portfolioSystem.portfolioRiskReview.reviewPortfolioRisk(workspaceId, services);
    const answer = `Portfolio risk: ${risk.riskLevel}\n\n${risk.warnings.length ? risk.warnings.map(item => `- ${item}`).join('\n') : '- belum ada risiko besar'}\n\n${risk.recommendations.join(' ')}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'stale') {
    const stale = await portfolioSystem.projectStalenessDetector.detectStaleProjects(workspaceId, services);
    const answer = stale.stale.length
      ? `Project macet/stale:\n${stale.stale.slice(0, 6).map(item => `- ${item.goal.title}: ${item.suggestedAction}`).join('\n')}`
      : 'Belum ada project stale besar. Kalau terasa macet, pilih satu next action kecil dan update task.';
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'agent') {
    const next = await portfolioSystem.portfolioNextActionEngine.recommendPortfolioNextAction(workspaceId, services);
    const answer = `${next.recommendedAgent} paling cocok.\n\n${next.summary}\n\nHermes untuk strategi, Codex untuk implementasi, OpenCode untuk audit/recovery, Ops untuk deploy/monitoring.`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  if (intent.type === 'proposal') {
    const next = await portfolioSystem.portfolioNextActionEngine.recommendPortfolioNextAction(workspaceId, services);
    const actionPlan = await portfolioSystem.portfolioProposalBridge.createPortfolioActionPlan({ ...next, userId, workspaceId }, services);
    const proposal = actionPlan.ok
      ? await portfolioSystem.portfolioProposalBridge.createPortfolioExecutorProposal(actionPlan.actionPlan, services)
      : actionPlan;
    const answer = proposal.ok
      ? `Saya buat proposal portfolio, belum push/deploy.\nProposal: ${proposal.proposal.id}\nApprove: /approve ${proposal.proposal.id}\nRun setelah approve: /runexec ${proposal.proposal.id}`
      : `Saya tidak menjalankan push/deploy langsung. Proposal diblokir/menunggu gate: ${proposal.reason || proposal.error || 'Evaluation v2 required'}`;
    await sendChunkedMessage(chatId, answer, replyOpt);
    return { handled: true, answer, type: intent.type };
  }

  const next = await portfolioSystem.portfolioNextActionEngine.recommendPortfolioNextAction(workspaceId, services);
  const answer = formatPortfolioNextAction(next);
  await sendChunkedMessage(chatId, answer, replyOpt);
  return { handled: true, answer, type: intent.type };
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
    const storageHealth = await storageManager.healthCheck?.();
    const text =
`${opsSystem.healthMonitor.formatHealth(health)}
Storage:
- PostgreSQL: ${storageHealth?.postgres || 'unknown'}
- Redis: ${storageHealth?.redis || 'unknown'}
- Driver: ${storageHealth?.storageDriver || storageManager.getStorageStatus().driver}
- Migration: ${storageHealth?.migrations || 'skipped'}

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

function getUsersSnapshot() {
  return userMemory && typeof userMemory === 'object' ? userMemory : {};
}

function getDashboardBaseUrl() {
  return WEBHOOK_BASE_URL || WEBHOOK_URL || TELEGRAM_WEBHOOK_URL || (RENDER_EXTERNAL_HOSTNAME ? `https://${RENDER_EXTERNAL_HOSTNAME}` : '');
}

function getDashboardStatusText() {
  const enabled = String(DASHBOARD_ENABLED || '').toLowerCase() === 'true';
  const tokenSet = Boolean(DASHBOARD_ADMIN_TOKEN || DASHBOARD_WRITE_TOKEN || DASHBOARD_DANGER_TOKEN);
  return {
    enabled,
    tokenSet,
    protectedStatus: enabled && tokenSet ? 'active' : 'disabled',
    staticAssets: 'configured'
  };
}

function buildDashboardInfoText() {
  const base = getDashboardBaseUrl();
  const status = getDashboardStatusText();
  return [
    'Dashboard Web UI + API',
    '',
    `Dashboard: ${status.enabled ? 'enabled' : 'disabled'}`,
    `Admin token: ${status.tokenSet ? 'set' : 'missing'}`,
    `Protected endpoints: ${status.protectedStatus}`,
    `Static UI: ${status.staticAssets}`,
    '',
    `Dashboard URL: ${base ? `${base}/dashboard` : 'WEBHOOK_URL belum diset'}`,
    `API health: ${base ? `${base}/api/dashboard/health` : '/api/dashboard/health'}`,
    'Storage API: /api/dashboard/storage',
    '',
    'Endpoint data user membutuhkan header:',
    'Authorization: Bearer <DASHBOARD_ADMIN_TOKEN>',
    '',
    'Cek dari Telegram:',
    '/dashboardstatus',
    '/dbstatus',
    '/redisstatus',
    '',
    'Token tidak akan pernah ditampilkan oleh bot.'
  ].join('\n');
}

function isRelationalStorageActive() {
  return Boolean(storageManager.isPostgresEnabled?.());
}

function getStorageRepositoriesSafe() {
  try {
    return storageManager.getRepositories?.() || null;
  } catch (err) {
    console.warn('Storage repositories unavailable:', err.message);
    return null;
  }
}

async function enrichWorkflowsWithSteps(userId, workflows, repositories) {
  if (!repositories?.workflows?.listWorkflowSteps) return workflows;
  const enriched = [];
  for (const workflow of workflows) {
    try {
      const steps = await repositories.workflows.listWorkflowSteps(userId, workflow.id);
      enriched.push({
        ...workflow,
        steps: steps.map(step => ({
          ...step,
          done: step.status === 'done',
          text: step.title
        }))
      });
    } catch (_) {
      enriched.push({ ...workflow, steps: workflow.steps || [] });
    }
  }
  return enriched;
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
      GACOR_API_KEY,
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

function updateGraphFromEntitySafe(userId, entity = {}, text = '', source = 'aios-command', services = getAiosServices()) {
  try {
    const label = entity.label || entity.title || entity.content || entity.text;
    if (!label || !text) return null;
    const node = aiOS.knowledgeGraph.upsertConcept(userId, {
      label: aiOS.utils?.compactText ? aiOS.utils.compactText(label, 120) : String(label).slice(0, 120),
      type: entity.type || 'concept',
      summary: text,
      source,
      sourceId: entity.id,
      confidence: entity.confidence || 0.72,
      importance: entity.importance || 0.68
    }, services);
    const evolved = aiOS.knowledgeGraph.evolveGraphFromText(userId, text, services, {
      source,
      confidence: entity.confidence || 0.72,
      maxConcepts: 6
    });
    if (node?.ok && evolved?.nodes?.length) {
      for (const concept of evolved.nodes.slice(0, 5)) {
        aiOS.knowledgeGraph.linkConcepts(userId, node.node.label, concept.label, entity.relationship || 'related_to', text, services);
      }
    }
    return { node, evolved };
  } catch (err) {
    log.warn('Graph entity update skipped:', err.message);
    return null;
  }
}

function formatGraphCommandSnapshot(snapshot = {}) {
  const nodes = snapshot.nodes || [];
  const edges = snapshot.edges || [];
  const labelById = new Map(nodes.map(node => [node.id, node.label]));
  return [
    'Konsep:',
    ...(nodes.length ? nodes.map((node, index) => `${index + 1}. ${node.label} (${node.type}, confidence ${Number(node.confidence || 0).toFixed(2)})`) : ['- belum ada data']),
    '',
    'Relasi:',
    ...(edges.length ? edges.map((edge, index) => `${index + 1}. ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to} (${Number(edge.confidence || 0).toFixed(2)})`) : ['- belum ada relasi'])
  ].join('\n');
}

function getWorkspaceServices() {
  return {
    storageManager,
    env: {
      OWNER_CHAT_ID
    },
    aiOS,
    getUsersSnapshot
  };
}

function getPlannerServices(actorId = '') {
  return {
    ...getWorkspaceServices(),
    actorId: actorId || '',
    actorType: 'telegram',
    log
  };
}

function getExecutorServices(actorId = '') {
  return {
    ...getWorkspaceServices(),
    actorId: actorId || '',
    actorType: 'telegram',
    aiOS,
    opsSystem,
    getOpsServices,
    getUsersSnapshot,
    log
  };
}

function getToolServices(actorId = '') {
  return {
    ...getExecutorServices(actorId),
    env: {
      ...process.env,
      OWNER_CHAT_ID,
      OPENWEATHER_API_KEY,
      TAVILY_API_KEY
    }
  };
}

function getBackupServices(actorId = '') {
  return {
    ...getToolServices(actorId),
    actorId: actorId || '',
    actorType: 'telegram'
  };
}

function getObservabilityServices(actorId = '') {
  return {
    ...getExecutorServices(actorId),
    actorId: actorId || '',
    actorType: 'telegram',
    env: config,
    evaluationSystem: evaluationSystem || smartAgentSystem.agentEvaluationV2 || null,
    executorSystem,
    integrationsSystem,
    selfHealingSystem,
    autoHealingSystem,
    monitoringSystem,
    cicdSystem,
    observabilitySystem,
    ownerChatId: OWNER_CHAT_ID,
    sendChunkedMessage,
    logger: log
  };
}

function getPortfolioServices(actorId = '') {
  return {
    ...getObservabilityServices(actorId),
    actorId: actorId || '',
    userId: actorId || '',
    actorType: 'telegram',
    portfolioSystem,
    operatorSystem: null,
    costSystem: opsSystem.costOptimizer || null
  };
}

function getResearchServices(actorId = '') {
  return {
    ...getPortfolioServices(actorId),
    actorId: actorId || '',
    userId: actorId || '',
    actorType: 'telegram',
    researchSystem,
    evaluationSystem: evaluationSystem || smartAgentSystem.agentEvaluationV2 || null,
    logger: log
  };
}

function getLifeOsServices(actorId = '') {
  return {
    ...getResearchServices(actorId),
    actorId: actorId || '',
    userId: actorId || '',
    actorType: 'telegram',
    lifeosSystem,
    routineRegistry: routineRegistry || null,
    routineRunner: routineRunner || null,
    routineScheduler: routineScheduler || null,
    logger: log
  };
}

function getAgentServices(actorId = '') {
  return {
    ...getBackupServices(actorId),
    actorId: actorId || '',
    actorType: 'telegram',
    env: config,
    botRegistry: multibotSystem.botRegistry,
    telegramClient: multibotSystem.telegramClient,
    agentMemoryStore: smartAgentSystem.agentMemoryStore,
    auditLog: dashboard.auditLog,
    safeSendMessage,
    sendChunkedMessage,
    sanitizeOutgoingText,
    telegramPost,
    logger: log
  };
}

function getTelegramRuntimeServices(actorId = '', extra = {}) {
  return {
    ...getAgentServices(actorId),
    naturalRouter: telegramControl.naturalRouter,
    runtimeDispatcher: telegramControl.runtimeDispatcher,
    messageSyncChecker: telegramControl.messageSyncChecker,
    botRegistry: multibotSystem.botRegistry,
    telegramClient: multibotSystem.telegramClient,
    sendMessageAsBot: (botId, chatId, text, options = {}, services = {}) =>
      multibotSystem.telegramClient.sendMessageAsBot(botId, chatId, text, options, {
        ...getAgentServices(actorId),
        ...services
      }),
    webhookRoute: extra.webhookRoute || WEBHOOK_PATH || '/webhook',
    env: config,
    logger: log
  };
}

function getIntegrationServices(actorId = '') {
  return {
    ...getAgentServices(actorId),
    integrationsSystem,
    getCalendarClient,
    actorRole: 'owner',
    integrationConnectors: integrationsSystem.connectorExecutor
  };
}

async function getIntegrationContext(userId = '', text = '') {
  const workspaceId = await getDefaultWorkspaceIdForUser(userId);
  return {
    userId,
    actorId: userId,
    workspaceId,
    actorRole: 'owner',
    text
  };
}

function formatBotStatusList() {
  const status = multibotSystem.botRegistry.buildBotStatusSummary(config);
  const lines = status.bots.map(bot => {
    const secret = bot.webhookSecretConfigured ? 'secret:set' : 'secret:missing';
    const token = bot.tokenConfigured ? 'token:set' : 'token:missing';
    return `- ${bot.id} -> ${bot.agentId} [${token}, ${secret}, ${bot.enabled ? 'enabled' : 'disabled'}]`;
  });
  return [
    'Multi-Bot Status',
    `Enabled bots: ${status.enabled}/${status.total}`,
    `Multi-bot: ${status.multiBotEnabled ? 'yes' : 'no'}`,
    `Default bot: ${status.defaultBotId || '-'}`,
    '',
    ...lines
  ].join('\n');
}

function formatAgentList() {
  const agents = smartAgentSystem.agentRegistry.listAgents({}, getAgentServices());
  return [
    'Agent Registry',
    '',
    ...agents.map(agent => `- ${agent.id}: ${agent.displayName} (${agent.role})${agent.defaultSilent ? ' [silent default]' : ''}`)
  ].join('\n');
}

async function formatBotMappingList(chatId, services) {
  const agents = smartAgentSystem.agentRegistry.listAgents({}, services);
  const bots = multibotSystem.botRegistry.listBotConfigsSafe(config);
  const byId = new Map(bots.map(bot => [bot.id, bot]));
  const warnings = multibotSystem.botRegistry.detectConfigWarnings?.(config) || [];
  const lines = [
    'Agent → Bot Mapping',
    '',
    ...agents.map(agent => {
      const bot = byId.get(agent.botId);
      return `- ${agent.id} -> ${agent.botId} configured: ${bot?.tokenConfigured ? 'true' : 'false'}`;
    })
  ];
  if (warnings.length) {
    lines.push('', 'Warnings:', ...warnings.map(item => `- ${item.message}`));
  }
  if (chatId) {
    const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, services);
    lines.push('', `Visible replies: ${settings.multiBotVisibleReplies ? 'on' : 'off'} (${settings.visibleSpecialistReplies})`, `Max specialist bots: ${settings.maxVisibleSpecialistBots}`);
  }
  return lines.join('\n');
}

async function formatVisibleAgentSettings(chatId, services) {
  const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, services);
  return [
    'Visible Multi-Bot Replies',
    `Enabled: ${settings.multiBotVisibleReplies ? 'yes' : 'no'}`,
    `Mode: ${settings.visibleSpecialistReplies}`,
    `Max specialist bots: ${settings.maxVisibleSpecialistBots}`,
    `Router mode: ${settings.mode}`,
    '',
    'Gunakan /multibot_on untuk specialist bot terpilih, atau /multibot_off untuk Orchestrator saja.'
  ].join('\n');
}

async function formatRouterStatus(chatId) {
  const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, getAgentServices());
  return [
    'Smart Agent Router',
    `Mode: ${settings.mode}`,
    `Max visible agents: ${settings.maxAutoAgents}`,
    `All agents allowed: ${settings.allowAllAgents ? 'yes' : 'no'}`,
    '',
    'Natural chat aktif: pesan biasa akan diklasifikasi topic/risk, lalu agent relevan dipilih. Agent tidak relevan diam.'
  ].join('\n');
}

async function renderAgentRoutePreview(text, mode, chatId, userId) {
  const services = getAgentServices(userId);
  const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, services);
  const route = smartAgentSystem.agentRouter.routeMessage(text, {
    forceMode: mode || settings.mode || 'natural_smart',
    chatId,
    userId,
    groupSettings: settings
  }, services);
  const event = {
    chatId: String(chatId),
    userId: String(userId),
    botId: 'default',
    text,
    createdAt: new Date().toISOString()
  };
  const drafts = ['council', 'debate', 'allagents'].includes(mode)
    ? await smartAgentSystem.conversationBus.collectAgentDrafts(event, route, services)
    : [];
  await smartAgentSystem.conversationBus.recordAgentActivity(event, route, drafts, services);
  if (['council', 'debate', 'allagents'].includes(mode)) {
    return [
      'Agent Council',
      '',
      smartAgentSystem.agentResponseRenderer.renderCouncilReply(drafts, { route, event })
    ].join('\n');
  }
  return smartAgentSystem.agentResponseRenderer.renderDebugRouterReply(route, route.scores || [], {
    reason: route.reason || route.policy?.reason || ''
  });
}

function formatCouncilTelegramResult(result = {}, options = {}) {
  const session = result.session || result;
  const opinions = result.opinions || session.opinions || [];
  const critiques = result.critiques || session.critiques || [];
  const decision = result.decision || session.decision || {};
  const riskReview = result.riskReview || session.riskReview || {};
  const lines = [
    options.title || 'Agent Council',
    `Session: ${session.id || result.sessionId || '-'}`,
    `Mode: ${session.mode || '-'}`,
    `Risk: ${riskReview.riskLevel || session.riskLevel || 'low'}`,
    `Approval required: ${riskReview.approvalRequired || session.approvalRequired ? 'yes' : 'no'}`,
    '',
    decision.recommendation ? `Rekomendasi: ${decision.recommendation}` : (result.finalSummary || session.finalSummary || ''),
    ''
  ];
  if (opinions.length) {
    lines.push('Opini agent:');
    for (const opinion of opinions.slice(0, 5)) {
      lines.push(`- ${opinion.agentId}: ${opinion.summary || (opinion.recommendations || [])[0] || '-'}`);
    }
    lines.push('');
  }
  if (critiques.length) {
    lines.push('Kritik/risk notes:');
    for (const critique of critiques.slice(0, 4)) {
      lines.push(`- ${critique.criticAgentId || 'critic'} -> ${critique.targetAgentId || '-'}: ${critique.summary}`);
    }
    lines.push('');
  }
  if (Array.isArray(decision.nextSteps) && decision.nextSteps.length) {
    lines.push('Langkah berikutnya:');
    decision.nextSteps.slice(0, 5).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }
  if (riskReview.approvalRequired) {
    lines.push('', 'Catatan: write/external/danger action tetap harus lewat proposal dan approval eksplisit.');
  }
  return lines.filter(line => line !== undefined && line !== null).join('\n');
}

async function runCouncilTelegramCommand(chatId, userId, cmd, args, msg) {
  const modeByCommand = {
    '/council': 'quick_council',
    '/debate': 'debate',
    '/riskreview': 'risk_review',
    '/proscons': 'decision_review'
  };
  const services = getAgentServices(userId);
  const mode = modeByCommand[cmd] || 'quick_council';
  const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, services);
  const route = smartAgentSystem.agentRouter.routeMessage(args, {
    forceMode: mode,
    chatId,
    userId,
    groupSettings: settings
  }, services);
  const result = await smartAgentSystem.councilEngine.runCouncil({
    workspaceId: 'default',
    userId,
    chatId,
    messageId: msg.message_id,
    source: 'telegram_command',
    mode,
    topic: args,
    originalMessage: args,
    routerPolicy: route,
    riskLevel: route.risk?.level || 'low',
    approvalRequired: route.approvalRequired
  }, services);
  return formatCouncilTelegramResult(result, {
    title: cmd === '/debate'
      ? 'Agent Debate'
      : (cmd === '/riskreview' ? 'Agent Risk Review' : (cmd === '/proscons' ? 'Pros/Cons Council' : 'Agent Council'))
  });
}

function formatDelegationTelegramResult(result = {}) {
  const session = result.session || result;
  const tasks = result.tasks || [];
  const finalAnswer = result.finalAnswer || session.finalSummary || '';
  const lines = [
    'Agent Task Delegation',
    `Delegation: ${session.id || '-'}`,
    `Status: ${session.status || '-'}`,
    `Approval required: ${session.approvalRequired ? 'yes' : 'no'}`,
    '',
    finalAnswer || session.goal || session.originalMessageSummary || '',
    ''
  ];
  if (tasks.length) {
    lines.push('Task agent:');
    for (const task of tasks.slice(0, 6)) {
      lines.push(`- ${task.assignedAgentId || '-'} / ${task.type || '-'}: ${task.title || task.description || '-'}`);
    }
  }
  return sanitizeOutgoingText(lines.filter(Boolean).join('\n'), { userText: session.goal || session.originalMessageSummary || '' });
}

async function runDelegationTelegramCommand(chatId, userId, args, msg, shouldRun = false) {
  const services = getAgentServices(userId);
  const session = await smartAgentSystem.delegationEngine.createDelegationSession({
    workspaceId: 'default',
    userId,
    chatId,
    messageId: msg.message_id,
    source: 'telegram_command',
    originalMessage: args,
    goal: args
  }, services);
  const plan = await smartAgentSystem.delegationEngine.planDelegation(session.id, services);
  if (!shouldRun) return formatDelegationTelegramResult(plan);
  const result = await smartAgentSystem.delegationEngine.runDelegation(session.id, services);
  return formatDelegationTelegramResult(result);
}

function formatDecisionTelegramResult(result = {}) {
  const decision = result.decision || result;
  const rec = decision.recommendation || result.recommendation || {};
  const lines = [
    'Decision / Risk Review',
    `Decision: ${decision.id || '-'}`,
    `Risk: ${decision.riskLevel || 'low'}`,
    `Confidence: ${decision.confidence?.level || 'medium'} (${Math.round(Number(decision.confidence?.score || 0.5) * 100)}%)`,
    `Approval required: ${decision.approvalRequired || rec.approvalRequired ? 'yes' : 'no'}`,
    '',
    `Rekomendasi: ${rec.recommendation || '-'}`,
    '',
    'Alasan:',
    ...(rec.reasons || []).slice(0, 3).map(reason => `- ${reason}`),
    '',
    'Langkah berikutnya:',
    ...(rec.nextSteps || decision.nextSteps || []).slice(0, 5).map((step, index) => `${index + 1}. ${step}`),
    (decision.approvalRequired || rec.approvalRequired) ? '\nCatatan: write/external/danger action wajib lewat executor proposal dan approval eksplisit.' : ''
  ];
  return sanitizeOutgoingText(lines.filter(Boolean).join('\n'), { userText: decision.question || '' });
}

function formatAgentActionPlanLine(plan = {}, index = 0) {
  const prefix = index ? `${index}. ` : '';
  return `${prefix}${plan.id} [${plan.status}/${plan.riskLevel}] ${plan.title || '-'} (${(plan.actions || []).length} action)`;
}

function formatAgentProposalResult(result = {}) {
  return smartAgentSystem.agentApprovalFlow.formatProposalCreatedReply(result);
}

function formatIntegrationResult(result = {}) {
  if (!result) return 'Integrasi tidak mengembalikan hasil.';
  if (result.ok === false) return `Integrasi diblokir: ${result.reason || result.error || 'unknown'}`;
  if (result.proposal) {
    return [
      'Proposal integrasi dibuat.',
      `Proposal: ${result.proposal.id}`,
      `Status: ${result.proposal.status}`,
      `Risk: ${result.proposal.riskLevel}`,
      '',
      `Approve: /approve ${result.proposal.id}`,
      `Run setelah approve: /runexec ${result.proposal.id}`
    ].join('\n');
  }
  if (result.pipeline) {
    return [
      'Integration Pipeline',
      `ID: ${result.pipeline.id}`,
      `Connector: ${result.pipeline.connectorId}`,
      `Action: ${result.pipeline.action}`,
      `Status: ${result.pipeline.status}`,
      `Proposal: ${result.pipeline.proposalId || '-'}`
    ].join('\n');
  }
  return outputSanitizer.sanitizeAssistantVisibleText(JSON.stringify(result.result || result.status || result, null, 2), {
    userText: '',
    forceClean: true
  });
}

function parseIntegrationPayload(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return { text: raw };
  }
}

async function runDecisionTelegramCommand(chatId, userId, args, msg, mode = 'decision') {
  const services = getAgentServices(userId);
  const result = await smartAgentSystem.decisionStore.analyzeDecision({
    workspaceId: 'default',
    userId,
    chatId,
    messageId: msg.message_id,
    source: 'telegram_command',
    question: args,
    topics: mode === 'risk' ? ['security'] : (mode === 'confidence' ? ['decision'] : [])
  }, services);
  return mode === 'confidence'
    ? sanitizeOutgoingText([
        'Decision Confidence',
        `Confidence: ${result.decision.confidence.level} (${Math.round(Number(result.decision.confidence.score || 0.5) * 100)}%)`,
        '',
        ...(result.decision.confidence.reasons || []).map(reason => `- ${reason}`)
      ].join('\n'), { userText: args })
    : formatDecisionTelegramResult(result);
}

async function formatAgentProfile(agentId, services) {
  const profile = await smartAgentSystem.agentProfileStore.getAgentProfile(agentId, services);
  return [
    `${profile.displayName || profile.agentId}`,
    `Role: ${profile.role || '-'}`,
    `Memory: ${profile.agentMemoryEnabled ? 'enabled' : 'disabled'} | Shared: ${profile.sharedMemoryEnabled ? 'enabled' : 'disabled'}`,
    `Tone: ${profile.responseStyle?.tone || '-'}`,
    '',
    profile.personality || '',
    '',
    `Knowledge scope: ${(profile.knowledgeScope || []).slice(0, 12).join(', ') || '-'}`
  ].join('\n');
}

async function formatAgentMemoryList(agentId, services, options = {}) {
  const items = await smartAgentSystem.agentMemoryStore.listAgentMemories({
    agentId,
    workspaceId: options.workspaceId || 'default',
    userId: options.userId || services.userId || '',
    limit: options.limit || 10
  }, services);
  if (!items.length) return `Belum ada memory untuk agent ${agentId}.`;
  return [
    `Agent Memory: ${agentId}`,
    '',
    ...items.map(item => [
      `- ${item.id}`,
      `  ${item.title}`,
      `  Type: ${item.type} | Importance: ${Math.round(Number(item.importance || 0) * 100)}%`,
      `  ${item.content}`
    ].join('\n'))
  ].join('\n');
}

async function formatSharedAgentMemory(services) {
  const items = await smartAgentSystem.agentMemoryStore.listSharedAgentMemories({ workspaceId: 'default', limit: 10 }, services);
  if (!items.length) return 'Belum ada shared memory agent.';
  return [
    'Shared Agent Memory',
    '',
    ...items.map(item => `- ${item.id}: ${item.title}\n  ${item.content}`)
  ].join('\n');
}

async function formatAgentPreferences(agentId, services) {
  const prefs = await smartAgentSystem.agentPreferences.getAgentPreferences(agentId, services);
  return [
    `Agent Preferences: ${agentId}`,
    `Response style: ${JSON.stringify(prefs.responseStyle || {})}`,
    `Preferences: ${JSON.stringify(prefs.preferences || {})}`,
    `Memory policy: ${JSON.stringify(prefs.memoryPolicy || {})}`
  ].join('\n');
}

async function handleAgentCommands(chatId, userId, cmd, args, msg) {
  const replyOpt = { reply_to_message_id: msg.message_id };
  const services = getAgentServices(userId);

  if (cmd === '/bots') {
    await sendChunkedMessage(chatId, formatBotStatusList(), replyOpt);
    return true;
  }

  if (cmd === '/botstatus') {
    await sendChunkedMessage(chatId, formatBotStatusList(), replyOpt);
    return true;
  }

  if (cmd === '/botinfo') {
    const botId = String(args || '').trim();
    if (!botId) {
      await safeSendMessage(chatId, 'Format: /botinfo <botId>', replyOpt);
      return true;
    }
    const bot = multibotSystem.botRegistry.getBotConfig(botId, config);
    if (!bot) {
      await safeSendMessage(chatId, 'Bot tidak ditemukan.', replyOpt);
      return true;
    }
    const safe = multibotSystem.botConfig.sanitizeBotConfig(bot);
    await sendChunkedMessage(chatId, [
      `Bot: ${safe.id}`,
      `Agent: ${safe.agentId}`,
      `Role: ${safe.role}`,
      `Username: ${safe.username || '-'}`,
      `Token configured: ${safe.tokenConfigured ? 'yes' : 'no'}`,
      `Webhook secret: ${safe.webhookSecretConfigured ? 'set' : 'missing'}`,
      `Enabled: ${safe.enabled ? 'yes' : 'no'}`,
      `Webhook path: ${safe.webhookPath}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/botmapping') {
    await sendChunkedMessage(chatId, await formatBotMappingList(chatId, services), replyOpt);
    return true;
  }

  if (cmd === '/multibot' || cmd === '/visibleagents') {
    await sendChunkedMessage(chatId, await formatVisibleAgentSettings(chatId, services), replyOpt);
    return true;
  }

  if (cmd === '/multibot_on' || cmd === '/multibot_off') {
    if (msg.chat?.type !== 'private' && !isAdmin(userId)) {
      await safeSendMessage(chatId, 'Mengubah visible multi-bot replies hanya untuk owner/admin.', replyOpt);
      return true;
    }
    const enabled = cmd === '/multibot_on';
    await smartAgentSystem.conversationBus.setGroupSettings(chatId, {
      multiBotVisibleReplies: enabled,
      visibleSpecialistReplies: enabled ? 'selected' : 'off',
      maxVisibleSpecialistBots: enabled ? 2 : 0,
      updatedBy: userId
    }, services);
    try {
      await dashboard.auditLog.recordAuditLog({
        actorType: 'telegram',
        actorId: userId,
        action: 'agents/visible_multibot_replies_changed',
        targetType: 'chat',
        targetId: String(chatId),
        userId,
        decision: 'allowed',
        status: 'ok',
        afterSummary: { chatId: String(chatId), enabled }
      }, services);
    } catch (_) {}
    await safeSendMessage(chatId, enabled
      ? 'Visible multi-bot replies aktif untuk specialist agent yang dipilih router.'
      : 'Visible multi-bot replies nonaktif. Hanya Orchestrator/default bot yang menjawab.', replyOpt);
    return true;
  }

  if (cmd === '/delegate') {
    if (!args) {
      await safeSendMessage(chatId, 'Format: /delegate <topic/request kompleks>', replyOpt);
      return true;
    }
    try {
      await sendChunkedMessage(chatId, await runDelegationTelegramCommand(chatId, userId, args, msg, false), { ...replyOpt, userText: args });
    } catch (err) {
      await safeSendMessage(chatId, `Delegation gagal: ${err.code || err.message}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/delegations') {
    const items = await smartAgentSystem.delegationEngine.listDelegationSessions({ workspaceId: 'default', userId, limit: 10 }, services);
    await sendChunkedMessage(chatId, [
      'Recent Delegations',
      '',
      ...(items.length ? items.map((item, index) => `${index + 1}. ${item.id} [${item.status}] ${item.goal || item.originalMessageSummary}`) : ['Belum ada delegation session.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/delegation') {
    const delegationId = String(args || '').trim();
    if (!delegationId) {
      await safeSendMessage(chatId, 'Format: /delegation <delegationId>', replyOpt);
      return true;
    }
    const session = await smartAgentSystem.delegationEngine.getDelegationSession(delegationId, services);
    if (!session) {
      await safeSendMessage(chatId, 'Delegation tidak ditemukan.', replyOpt);
      return true;
    }
    const tasks = await smartAgentSystem.agentTaskStore.listTasks({ delegationId, limit: 20 }, services);
    await sendChunkedMessage(chatId, formatDelegationTelegramResult({ session, tasks }), replyOpt);
    return true;
  }

  if (cmd === '/rundelegation') {
    const delegationId = String(args || '').trim();
    if (!delegationId) {
      await safeSendMessage(chatId, 'Format: /rundelegation <delegationId>', replyOpt);
      return true;
    }
    const result = await smartAgentSystem.delegationEngine.runDelegation(delegationId, services);
    await sendChunkedMessage(chatId, formatDelegationTelegramResult(result), { ...replyOpt, userText: result.session?.goal || '' });
    return true;
  }

  if (cmd === '/agenttasks') {
    const items = await smartAgentSystem.agentTaskStore.listTasks({ workspaceId: 'default', userId, limit: 12 }, services);
    await sendChunkedMessage(chatId, [
      'Recent Agent Tasks',
      '',
      ...(items.length ? items.map((item, index) => `${index + 1}. ${item.id} [${item.status}] ${item.assignedAgentId}/${item.type}: ${item.title}`) : ['Belum ada agent task.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/agenttask' || cmd === '/taskresult') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, `Format: ${cmd} <taskId>`, replyOpt);
      return true;
    }
    const task = await smartAgentSystem.agentTaskStore.getTask(taskId, services);
    if (!task) {
      await safeSendMessage(chatId, 'Agent task tidak ditemukan.', replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      `Agent Task: ${task.id}`,
      `Agent: ${task.assignedAgentId}`,
      `Type: ${task.type}`,
      `Status: ${task.status}`,
      `Risk: ${task.riskLevel}`,
      '',
      task.title,
      task.resultSummary || task.description || ''
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/runtask') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, 'Format: /runtask <taskId>', replyOpt);
      return true;
    }
    const task = await smartAgentSystem.agentTaskRunner.runAgentTask(taskId, services);
    await sendChunkedMessage(chatId, [
      `Task selesai: ${task.id}`,
      `Agent: ${task.assignedAgentId}`,
      '',
      task.resultSummary || '-'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/handoffs') {
    const items = await smartAgentSystem.handoffManager.listHandoffs({ workspaceId: 'default', limit: 10 }, services);
    await sendChunkedMessage(chatId, [
      'Agent Handoffs',
      '',
      ...(items.length ? items.map((item, index) => `${index + 1}. ${item.taskId}: ${item.fromAgentId} -> ${item.toAgentId} [${item.status}] ${item.reason}`) : ['Belum ada handoff.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/handoff') {
    const [taskId, toAgentId = ''] = splitPipeArgs(args);
    if (!taskId || !toAgentId) {
      await safeSendMessage(chatId, 'Format: /handoff <taskId> | <agentId>', replyOpt);
      return true;
    }
    const handoff = await smartAgentSystem.handoffManager.createHandoff(taskId, 'orchestrator', toAgentId, 'Manual Telegram handoff', services);
    await safeSendMessage(chatId, `Handoff dibuat: ${handoff.id}\n${handoff.fromAgentId} -> ${handoff.toAgentId}`, replyOpt);
    return true;
  }

  if (['/decision', '/compare', '/proscons', '/risk', '/confidence'].includes(cmd)) {
    if (!args) {
      await safeSendMessage(chatId, `Format: ${cmd} <pertanyaan keputusan>`, replyOpt);
      return true;
    }
    try {
      const mode = cmd === '/risk' ? 'risk' : (cmd === '/confidence' ? 'confidence' : 'decision');
      await sendChunkedMessage(chatId, await runDecisionTelegramCommand(chatId, userId, args, msg, mode), { ...replyOpt, userText: args });
    } catch (err) {
      await safeSendMessage(chatId, err.code === 'DECISION_SECRET_REJECTED'
        ? 'Pertanyaan terlihat mengandung secret/token. Saya tidak menyimpannya.'
        : `Decision analysis gagal: ${err.message}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/propose_action') {
    const text = String(args || '').trim();
    if (!text) {
      await safeSendMessage(chatId, 'Format: /propose_action <aksi>\nContoh: /propose_action jalankan backup sekarang', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await smartAgentSystem.agentExecutorBridge.createProposalFromNaturalText(text, {
      workspaceId,
      userId,
      source: 'natural_chat',
      createdByAgentId: 'executor'
    }, getAgentServices(userId));
    await sendChunkedMessage(chatId, formatAgentProposalResult(result), replyOpt);
    return true;
  }

  if (cmd === '/actionplans') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const items = await smartAgentSystem.agentActionPlan.listActionPlans({ workspaceId, userId, limit: 12 }, getAgentServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Agent Action Plans',
      items.map(formatAgentActionPlanLine),
      'Belum ada action plan. Buat dengan /propose_action <aksi>.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/actionplan') {
    const planId = String(args || '').trim();
    if (!planId) {
      await safeSendMessage(chatId, 'Format: /actionplan <actionPlanId>', replyOpt);
      return true;
    }
    const plan = await smartAgentSystem.agentActionPlan.getActionPlan(planId, getAgentServices(userId));
    if (!plan) {
      await safeSendMessage(chatId, `Action plan tidak ditemukan: ${planId}`, replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      formatAgentActionPlanLine(plan),
      '',
      plan.description || '-',
      '',
      'Actions:',
      ...(plan.actions || []).map((action, index) => `${index + 1}. ${action.type} [${action.riskLevel}] ${action.description}`),
      '',
      plan.executorProposalId ? `Proposal: ${plan.executorProposalId}` : `Buat proposal: /propose_action ${plan.title}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/propose_decision') {
    const decisionId = String(args || '').trim();
    if (!decisionId) {
      await safeSendMessage(chatId, 'Format: /propose_decision <decisionId>', replyOpt);
      return true;
    }
    const result = await smartAgentSystem.agentExecutorBridge.createProposalFromDecision(decisionId, { userId, actorId: userId }, getAgentServices(userId));
    await sendChunkedMessage(chatId, formatAgentProposalResult(result), replyOpt);
    return true;
  }

  if (cmd === '/propose_delegation') {
    const delegationId = String(args || '').trim();
    if (!delegationId) {
      await safeSendMessage(chatId, 'Format: /propose_delegation <delegationId>', replyOpt);
      return true;
    }
    const result = await smartAgentSystem.agentExecutorBridge.createProposalFromDelegation(delegationId, { userId, actorId: userId }, getAgentServices(userId));
    await sendChunkedMessage(chatId, formatAgentProposalResult(result), replyOpt);
    return true;
  }

  if (cmd === '/propose_task') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, 'Format: /propose_task <agentTaskId>', replyOpt);
      return true;
    }
    const result = await smartAgentSystem.agentExecutorBridge.createProposalFromAgentTask(taskId, { userId, actorId: userId }, getAgentServices(userId));
    await sendChunkedMessage(chatId, formatAgentProposalResult(result), replyOpt);
    return true;
  }

  if (cmd === '/proposalstatus') {
    const proposalId = String(args || '').trim();
    if (!proposalId) {
      await safeSendMessage(chatId, 'Format: /proposalstatus <proposalId>', replyOpt);
      return true;
    }
    const status = await executorSystem.executionQueue.getApprovalStatus(proposalId, getExecutorServices(userId));
    await safeSendMessage(chatId, status.ok ? smartAgentSystem.agentApprovalFlow.formatApprovalStatus(status.proposal) : `Proposal tidak ditemukan: ${status.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/evalagents') {
    const result = await smartAgentSystem.agentEvaluationV2.suite.runEvaluationSuite({ limit: 50 }, getAgentServices(userId));
    await sendChunkedMessage(chatId, [
      'Agent Evaluation Suite v2',
      `Status: ${result.run.status}`,
      `Score rata-rata: ${result.summary.averageScore}%`,
      `Passed: ${result.summary.passedCases}/${result.summary.totalCases}`,
      `Quality gates: ${result.summary.qualityGateStatus}`,
      '',
      'Evaluasi dry-run saja. Tidak ada action yang dieksekusi.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/evalagent') {
    const caseId = String(args || '').trim();
    if (!caseId) {
      await safeSendMessage(chatId, 'Format: /evalagent <caseId>', replyOpt);
      return true;
    }
    const result = await smartAgentSystem.agentEvaluationV2.suite.runEvaluationCase(caseId, getAgentServices(userId));
    await sendChunkedMessage(chatId, result.ok === false ? `Evaluation gagal: ${result.reason}` : [
      `Evaluation: ${result.case.id}`,
      `Score: ${result.score.averageScore}% (${result.score.passed ? 'passed' : 'failed'})`,
      `Agents: ${(result.selectedAgents || []).join(', ') || '-'}`,
      `Risk: ${result.riskLevel}`,
      `Action: ${result.actionType || '-'}`,
      `Approval: ${result.approvalRequired ? 'required' : 'no'}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/evalsummary') {
    const latest = await smartAgentSystem.agentEvaluationV2.suite.getLatestEvaluationRun(getAgentServices(userId));
    await sendChunkedMessage(chatId, smartAgentSystem.agentEvaluationV2.report.formatRunForTelegram(latest), replyOpt);
    return true;
  }

  if (cmd === '/evalgates') {
    const latest = await smartAgentSystem.agentEvaluationV2.suite.getLatestEvaluationRun(getAgentServices(userId));
    await sendChunkedMessage(chatId, smartAgentSystem.agentEvaluationV2.report.formatQualityGatesForTelegram(latest?.qualityGates), replyOpt);
    return true;
  }

  if (cmd === '/evalcompare') {
    const runs = await smartAgentSystem.agentEvaluationV2.suite.listEvaluationRuns({ limit: 2 }, getAgentServices(userId));
    const compare = smartAgentSystem.agentEvaluationV2.regression.compareRuns(runs[0], runs[1]);
    await sendChunkedMessage(chatId, [
      'Agent Evaluation Compare',
      compare.reason === 'not_enough_runs' ? 'Belum ada dua run untuk dibandingkan.' : (compare.ok ? 'Tidak ada regresi besar.' : 'Regresi terdeteksi:'),
      ...(compare.regressions || []).map(item => `- ${item.key}: ${item.previousValue} -> ${item.currentValue} (${item.delta})`)
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/connector_status' || cmd === '/connector_quality') {
    const connectorId = String(args || '').trim();
    if (!connectorId) {
      await safeSendMessage(chatId, `Format: ${cmd} <connectorId>`, replyOpt);
      return true;
    }
    const svc = getIntegrationServices(userId);
    const context = await getIntegrationContext(userId, args);
    const result = cmd === '/connector_status'
      ? await integrationsSystem.connectorExecutor.executeConnectorAction(connectorId, `${connectorId === 'google_calendar' || connectorId === 'calendar' ? 'calendar' : connectorId}.status`, {}, context, svc)
      : await integrationsSystem.connectorQualityGates.runIntegrationQualityGate(connectorId, svc);
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/github_status' || cmd === '/github_issues') {
    const action = cmd === '/github_status' ? 'github.status' : 'github.issues.list';
    const context = await getIntegrationContext(userId, args);
    const result = await integrationsSystem.connectorExecutor.executeConnectorAction('github', action, parseIntegrationPayload(args), {
      ...context,
      text: args
    }, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/calendar_status' || cmd === '/calendar_events') {
    const action = cmd === '/calendar_status' ? 'calendar.status' : 'calendar.events.list';
    const context = await getIntegrationContext(userId, args);
    const result = await integrationsSystem.connectorExecutor.executeConnectorAction('google_calendar', action, parseIntegrationPayload(args), {
      ...context,
      text: args
    }, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/gmail_status' || cmd === '/nas_status') {
    const connectorId = cmd === '/gmail_status' ? 'gmail' : 'cloudflare_nas';
    const action = cmd === '/gmail_status' ? 'gmail.status' : 'cloudflare_nas.status';
    const result = await integrationsSystem.connectorExecutor.executeConnectorAction(connectorId, action, {}, await getIntegrationContext(userId, args), getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/webhook_preview') {
    const context = await getIntegrationContext(userId, args);
    const result = await integrationsSystem.connectorExecutor.runConnectorDryRun('webhook', 'webhook.payload.preview', parseIntegrationPayload(args), {
      ...context,
      text: args
    }, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/propose_github_issue' || cmd === '/propose_calendar_event' || cmd === '/propose_gmail_draft' || cmd === '/propose_webhook') {
    if (!String(args || '').trim()) {
      await safeSendMessage(chatId, `Format: ${cmd} <text atau JSON payload>`, replyOpt);
      return true;
    }
    const map = {
      '/propose_github_issue': ['github', 'github.issue.create'],
      '/propose_calendar_event': ['google_calendar', 'calendar.event.create'],
      '/propose_gmail_draft': ['gmail', 'gmail.draft.create'],
      '/propose_webhook': ['webhook', 'webhook.send']
    };
    const [connectorId, action] = map[cmd];
    const payload = parseIntegrationPayload(args);
    const context = await getIntegrationContext(userId, payload.text || args);
    const result = await integrationsSystem.connectorExecutor.executeConnectorAction(connectorId, action, payload, {
      ...context,
      text: payload.text || args
    }, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/integration_pipeline') {
    const pipelineId = String(args || '').trim();
    if (!pipelineId) {
      await safeSendMessage(chatId, 'Format: /integration_pipeline <pipelineId>', replyOpt);
      return true;
    }
    const result = await integrationsSystem.proposalPipeline.getPipelineStatus(pipelineId, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/integration_eval') {
    const pipelineId = String(args || '').trim();
    if (!pipelineId) {
      await safeSendMessage(chatId, 'Format: /integration_eval <pipelineId>', replyOpt);
      return true;
    }
    const result = await integrationsSystem.proposalPipeline.runIntegrationEvaluationGate(pipelineId, getIntegrationServices(userId));
    await sendChunkedMessage(chatId, formatIntegrationResult(result), replyOpt);
    return true;
  }

  if (cmd === '/decisions' || cmd === '/decisionhistory') {
    const items = await smartAgentSystem.decisionStore.listDecisionRecords({ workspaceId: 'default', userId, limit: 10 }, services);
    await sendChunkedMessage(chatId, [
      'Decision History',
      '',
      ...(items.length ? items.map((item, index) => `${index + 1}. ${item.id} [${item.status}/${item.riskLevel}] ${item.recommendation?.recommendation || item.question}`) : ['Belum ada decision record.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/decisionstatus') {
    const [decisionId, status = 'deferred'] = splitPipeArgs(args);
    if (!decisionId) {
      await safeSendMessage(chatId, 'Format: /decisionstatus <decisionId> | <accepted|rejected|deferred>', replyOpt);
      return true;
    }
    const decision = await smartAgentSystem.decisionStore.updateDecisionStatus(decisionId, status, { actorId: userId }, services);
    await safeSendMessage(chatId, `Decision ${decision.id} diset ke ${decision.status}.`, replyOpt);
    return true;
  }

  if (cmd === '/agents' || cmd === '/agentstatus') {
    await sendChunkedMessage(chatId, formatAgentList(), replyOpt);
    return true;
  }

  if (cmd === '/agent') {
    const agentId = String(args || '').trim();
    if (!agentId) {
      await safeSendMessage(chatId, 'Format: /agent <agentId>', replyOpt);
      return true;
    }
    const agent = smartAgentSystem.agentRegistry.getAgent(agentId, services);
    if (!agent) {
      await safeSendMessage(chatId, 'Agent tidak ditemukan.', replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      `${agent.displayName}`,
      `Role: ${agent.role}`,
      `Bot: ${agent.botId}`,
      `Silent default: ${agent.defaultSilent ? 'yes' : 'no'}`,
      `Can propose execution: ${agent.canProposeExecution ? 'yes' : 'no'}`,
      '',
      agent.description,
      '',
      `Specialties: ${(agent.specialties || []).join(', ')}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/agentprofile') {
    const agentId = String(args || '').trim();
    if (!agentId) {
      await safeSendMessage(chatId, 'Format: /agentprofile <agentId>', replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, await formatAgentProfile(agentId, services), replyOpt);
    return true;
  }

  if (cmd === '/agentmemory') {
    const agentId = String(args || '').trim();
    if (!agentId) {
      await safeSendMessage(chatId, 'Format: /agentmemory <agentId>', replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, await formatAgentMemoryList(agentId, services, { userId }), replyOpt);
    return true;
  }

  if (cmd === '/agentremember') {
    const [agentId, content = ''] = splitPipeArgs(args);
    if (!agentId || !content) {
      await safeSendMessage(chatId, 'Format: /agentremember <agentId> | <text>', replyOpt);
      return true;
    }
    try {
      const item = await smartAgentSystem.agentMemoryStore.createAgentMemory({
        agentId,
        workspaceId: 'default',
        userId,
        type: 'project_context',
        content,
        tags: ['telegram', 'manual'],
        createdBy: userId
      }, services);
      await safeSendMessage(chatId, `Agent memory tersimpan: ${item.id}\n${item.title}`, replyOpt);
    } catch (err) {
      await safeSendMessage(chatId, err.code === 'AGENT_MEMORY_SECRET_REJECTED'
        ? 'Konten terlihat seperti secret/token, jadi tidak disimpan.'
        : `Gagal menyimpan agent memory: ${err.message}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/agentforget') {
    const [agentId, memoryId = ''] = splitPipeArgs(args);
    if (!agentId || !memoryId) {
      await safeSendMessage(chatId, 'Format: /agentforget <agentId> | <memoryId>', replyOpt);
      return true;
    }
    try {
      const item = await smartAgentSystem.agentMemoryStore.archiveAgentMemory(memoryId, { userId, actorId: userId }, services);
      await safeSendMessage(chatId, `Agent memory diarsipkan: ${item.id}`, replyOpt);
    } catch (err) {
      await safeSendMessage(chatId, `Gagal archive agent memory: ${err.message}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/agentprefs') {
    const agentId = String(args || '').trim();
    if (!agentId) {
      await safeSendMessage(chatId, 'Format: /agentprefs <agentId>', replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, await formatAgentPreferences(agentId, services), replyOpt);
    return true;
  }

  if (cmd === '/sharedmemory') {
    await sendChunkedMessage(chatId, await formatSharedAgentMemory(services), replyOpt);
    return true;
  }

  if (cmd === '/agentlearn') {
    const [agentId, note = ''] = splitPipeArgs(args);
    if (!agentId || !note) {
      await safeSendMessage(chatId, 'Format: /agentlearn <agentId> | <note>', replyOpt);
      return true;
    }
    try {
      const item = await smartAgentSystem.learningNotes.createLearningNote({
        agentId,
        workspaceId: 'default',
        userId,
        content: note,
        tags: ['telegram', 'learning'],
        createdBy: userId
      }, services);
      await safeSendMessage(chatId, `Learning note tersimpan: ${item.id}\n${item.title}`, replyOpt);
    } catch (err) {
      await safeSendMessage(chatId, err.code === 'AGENT_MEMORY_SECRET_REJECTED'
        ? 'Catatan terlihat seperti secret/token, jadi tidak disimpan.'
        : `Gagal menyimpan learning note: ${err.message}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/agentstyle') {
    const agentId = String(args || '').trim();
    if (!agentId) {
      await safeSendMessage(chatId, 'Format: /agentstyle <agentId>', replyOpt);
      return true;
    }
    const profile = await smartAgentSystem.agentProfileStore.getAgentProfile(agentId, services);
    await sendChunkedMessage(chatId, smartAgentSystem.agentStyleBuilder.buildTelegramStyleSummary(profile), replyOpt);
    return true;
  }

  if (cmd === '/router' || cmd === '/routermode') {
    if (args) {
      await sendChunkedMessage(chatId, await renderAgentRoutePreview(args, 'natural_smart', chatId, userId), replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, await formatRouterStatus(chatId), replyOpt);
    return true;
  }

  if (cmd === '/quiet' || cmd === '/smart') {
    if (msg.chat?.type !== 'private' && !isAdmin(userId)) {
      await safeSendMessage(chatId, 'Mengubah mode grup hanya untuk owner/admin.', replyOpt);
      return true;
    }
    const mode = cmd === '/quiet' ? 'quiet' : 'natural_smart';
    await smartAgentSystem.conversationBus.setGroupSettings(chatId, {
      mode,
      updatedBy: userId
    }, services);
    try {
      await dashboard.auditLog.recordAuditLog({
        actorType: 'telegram',
        actorId: userId,
        action: 'agents/group_mode_changed',
        targetType: 'chat',
        targetId: String(chatId),
        userId,
        decision: 'allowed',
        status: 'ok',
        afterSummary: { chatId: String(chatId), mode }
      }, services);
    } catch (_) {}
    await safeSendMessage(chatId, `Router mode diset ke ${mode}.`, replyOpt);
    return true;
  }

  if (cmd === '/councilstatus') {
    const sessions = await smartAgentSystem.councilEngine.listSessions({ limit: 5 }, services);
    const summaries = await smartAgentSystem.councilEngine.listSummaries({ limit: 3 }, services);
    await sendChunkedMessage(chatId, [
      'Agent Council Status',
      `Recent sessions: ${sessions.length}`,
      `Saved summaries: ${summaries.length}`,
      '',
      ...(sessions.length
        ? sessions.map((item, index) => `${index + 1}. ${item.id} [${item.mode}, ${item.status}, risk ${item.riskLevel}] ${item.topic}`)
        : ['Belum ada council session.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/councilrecent') {
    const sessions = await smartAgentSystem.councilEngine.listSessions({ limit: 10 }, services);
    await sendChunkedMessage(chatId, [
      'Recent Council Sessions',
      '',
      ...(sessions.length
        ? sessions.map((item, index) => `${index + 1}. ${item.id} - ${item.mode} - ${item.status}\n   ${item.finalSummary || item.topic || '-'}`)
        : ['Belum ada council session.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/council' || cmd === '/debate' || cmd === '/riskreview' || cmd === '/proscons') {
    if (!args) {
      await safeSendMessage(chatId, `Format: ${cmd} <topic>`, replyOpt);
      return true;
    }
    try {
      await sendChunkedMessage(chatId, await runCouncilTelegramCommand(chatId, userId, cmd, args, msg), replyOpt);
    } catch (err) {
      await safeSendMessage(chatId, `Council gagal diproses: ${err.code || err.message || 'unknown error'}`, replyOpt);
    }
    return true;
  }

  if (cmd === '/allagents' || cmd === '/askagents') {
    if (!args) {
      await safeSendMessage(chatId, `Format: ${cmd} <topic>`, replyOpt);
      return true;
    }
    if (cmd === '/allagents' && !isAdmin(userId)) {
      await safeSendMessage(chatId, '/allagents hanya untuk owner/admin agar grup tidak spam.', replyOpt);
      return true;
    }
    const modeByCommand = {
      '/allagents': 'allagents',
      '/askagents': 'natural_smart'
    };
    const preview = await renderAgentRoutePreview(args, modeByCommand[cmd], chatId, userId);
    await sendChunkedMessage(chatId, `Agent Router Preview\n\n${preview}`, replyOpt);
    return true;
  }

  return false;
}

async function handleNaturalAgentRoute(chatId, userId, userText, msg) {
  const integrationResult = await handleNaturalIntegrationRoute(chatId, userId, userText, msg);
  if (integrationResult.handled) return integrationResult;

  const services = getAgentServices(userId);
  const settings = await smartAgentSystem.conversationBus.getGroupSettings(chatId, services);
  const recentTopic = await smartAgentSystem.conversationBus.getRecentChatTopic(chatId, userId, services);
  const need = smartAgentSystem.agentRouter.detectNaturalAgentNeed(userText, {
    chatId,
    userId,
    groupSettings: settings,
    previousTopics: recentTopic?.topics || [],
    previousText: recentTopic?.textPreview || ''
  }, services);

  if (!need.needed) return { handled: false };
  const route = need.route;
  const event = smartAgentSystem.conversationBus.createConversationEvent({
    message: msg,
    __botId: msg.__botId || 'default',
    __agentId: msg.__agentId || 'orchestrator'
  }, { chatId, userId, text: userText }, services);

  const canReply = await smartAgentSystem.conversationBus.preventDuplicateReplies(event, services);
  if (!canReply) return { handled: true, answer: '', reason: 'duplicate_agent_route' };

  try {
    const actionNeed = smartAgentSystem.agentActionDetector.shouldUseAgentExecutor(userText, {
      workspaceId: 'default',
      userId,
      source: 'natural_chat'
    }, services);
    if (actionNeed.needed) {
      const result = await smartAgentSystem.agentExecutorBridge.createProposalFromNaturalText(userText, {
        workspaceId: 'default',
        userId,
        source: 'natural_chat',
        createdByAgentId: 'executor'
      }, services);
      const answer = smartAgentSystem.agentApprovalFlow.formatProposalCreatedReply(result);
      await smartAgentSystem.conversationBus.recordAgentActivity(event, {
        ...route,
        reason: `agent_executor:${actionNeed.reason}`,
        selectedAgents: ['orchestrator', 'executor', ...(result.preflight?.securityReviewRequired ? ['security'] : [])]
      }, [], services);
      await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id, userText });
      return { handled: true, answer, route, actionPlanId: result.actionPlan?.id, proposalId: result.proposal?.id };
    }
  } catch (err) {
    log.warn('Natural agent executor fallback:', err.message);
  }

  try {
    const decisionNeed = smartAgentSystem.decisionDetector.shouldTriggerDecisionSystem(userText, route, {}, {}, services);
    if (decisionNeed.needed) {
      const decision = await smartAgentSystem.decisionStore.analyzeDecision({
        workspaceId: 'default',
        userId,
        chatId,
        messageId: msg.message_id,
        source: 'natural_chat',
        question: userText,
        topics: route.topics || []
      }, services);
      const answer = decision.finalAnswer || formatDecisionTelegramResult(decision);
      await smartAgentSystem.conversationBus.recordAgentActivity(event, {
        ...route,
        reason: `decision_system:${decisionNeed.reason}`,
        selectedAgents: route.selectedAgents || ['orchestrator', 'planner', 'critic']
      }, [], services);
      await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id, userText });
      return { handled: true, answer, route, decisionId: decision.decision?.id };
    }
  } catch (err) {
    log.warn('Natural decision fallback:', err.message);
  }

  try {
    const delegationNeed = smartAgentSystem.delegationEngine.shouldTriggerDelegation(userText, {
      workspaceId: 'default',
      userId,
      chatId,
      topics: route.topics || []
    }, route, {}, services);
    if (delegationNeed.needed) {
      const session = await smartAgentSystem.delegationEngine.createDelegationSession({
        workspaceId: 'default',
        userId,
        chatId,
        messageId: msg.message_id,
        source: 'natural_chat',
        originalMessage: userText,
        goal: userText,
        selectedAgents: route.selectedAgents || [],
        riskLevel: route.risk?.level || 'low',
        approvalRequired: route.approvalRequired
      }, services);
      await smartAgentSystem.delegationEngine.planDelegation(session.id, services);
      const result = await smartAgentSystem.delegationEngine.runDelegation(session.id, services);
      const answer = result.finalAnswer || result.session?.finalSummary || formatDelegationTelegramResult(result);
      await smartAgentSystem.conversationBus.recordAgentActivity(event, {
        ...route,
        reason: `delegation:${delegationNeed.reason}`,
        selectedAgents: result.session?.selectedAgents || route.selectedAgents || []
      }, [], services);
      await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id, userText });
      return { handled: true, answer, route, delegationId: session.id };
    }
  } catch (err) {
    log.warn('Natural delegation fallback:', err.message);
  }

  try {
    const council = await smartAgentSystem.councilEngine.runNaturalCouncilIfNeeded(userText, {
      workspaceId: 'default',
      chatId,
      userId,
      messageId: msg.message_id,
      source: 'natural_chat',
      skipDuplicateCheck: true
    }, route, services);
    if (council.handled) {
      const answer = council.finalAnswer || council.finalSummary || council.session?.finalSummary;
      if (answer) {
        await smartAgentSystem.conversationBus.recordAgentActivity(event, {
          ...route,
          policy: { ...(route.policy || {}), mode: council.session?.mode || route.policy?.mode || 'natural_smart' },
          selectedAgents: council.session?.selectedAgents || route.selectedAgents || [],
          internalOnlyAgents: council.session?.internalOnlyAgents || route.internalOnlyAgents || [],
          reason: 'council_internal_synthesis'
        }, [], services);
        await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id, userText });
        const councilResponses = (council.opinions || council.session?.opinions || [])
          .filter(opinion => opinion.agentId && opinion.agentId !== 'orchestrator')
          .map(opinion => {
            const agent = smartAgentSystem.agentRegistry.getAgent(opinion.agentId, services) || {};
            return {
              agentId: opinion.agentId,
              botId: agent.botId || opinion.agentId,
              text: opinion.summary || (opinion.recommendations || [])[0] || ''
            };
          });
        await smartAgentSystem.conversationBus.sendVisibleSpecialistReplies(event, {
          ...route,
          selectedAgents: council.session?.selectedAgents || route.selectedAgents || [],
          internalOnlyAgents: council.session?.internalOnlyAgents || route.internalOnlyAgents || [],
          mutedAgents: route.mutedAgents || [],
          policy: { ...(route.policy || {}), mode: council.session?.mode || 'decision_review' }
        }, councilResponses, services, { mode: council.session?.mode || 'decision_review' });
        return { handled: true, answer, route, councilSessionId: council.session?.id || council.sessionId };
      }
    }
  } catch (err) {
    log.warn('Natural council fallback:', err.message);
  }

  const drafts = await smartAgentSystem.conversationBus.collectAgentDrafts(event, route, services);
  await smartAgentSystem.conversationBus.recordAgentActivity(event, route, drafts, services);

  const visibleText = smartAgentSystem.agentResponseRenderer.renderNaturalSmartReply(event, route, drafts, {
    text: userText,
    chatId,
    userId,
    route,
    topics: route.topics || []
  }, services);

  await smartAgentSystem.conversationBus.sendAgentResponses(event, route, drafts, services);
  return { handled: true, answer: visibleText, route };
}

function detectNaturalIntegrationIntent(text = '') {
  const raw = String(text || '').toLowerCase();
  if (/\b(cek|lihat|list|daftar)\b.*\b(issue|issues)\b.*\bgithub\b|\bgithub\b.*\b(issue|issues)\b/i.test(raw)) {
    return { connectorId: 'github', action: 'github.issues.list', mode: 'read_only', payload: { text } };
  }
  if (/\b(buat|create)\b.*\b(issue)\b.*\bgithub\b|\bgithub\b.*\b(buat|create)\b.*\bissue\b/i.test(raw)) {
    return { connectorId: 'github', action: 'github.issue.create', mode: 'proposal', payload: { text, title: text } };
  }
  if (/\b(jadwalkan|buat event|calendar|kalender)\b/i.test(raw)) {
    return { connectorId: 'google_calendar', action: 'calendar.event.create', mode: 'proposal', payload: { text, summary: text } };
  }
  if (/\b(buat|siapkan)\b.*\b(draft email|email)\b/i.test(raw)) {
    return { connectorId: 'gmail', action: 'gmail.draft.create', mode: 'proposal', payload: { text, subject: text } };
  }
  if (/\b(kirim)\b.*\b(email)\b/i.test(raw)) {
    return { connectorId: 'gmail', action: 'gmail.send', mode: 'proposal', payload: { text } };
  }
  if (/\b(cek|diagnose|diagnosa)\b.*\b(tunnel|nas)\b/i.test(raw)) {
    return { connectorId: 'cloudflare_nas', action: raw.includes('tunnel') ? 'cloudflare_nas.tunnel.check' : 'nas.health.check', mode: 'read_only', payload: { text } };
  }
  if (/\b(ubah|change)\b.*\b(cloudflare|config)\b/i.test(raw)) {
    return { connectorId: 'cloudflare_nas', action: 'cloudflare.config.change', mode: 'proposal', payload: { text, change: text } };
  }
  if (/\b(kirim|send)\b.*\b(webhook|payload|data ini)\b/i.test(raw)) {
    return { connectorId: 'webhook', action: 'webhook.send', mode: 'proposal', payload: { text } };
  }
  return null;
}

async function handleNaturalIntegrationRoute(chatId, userId, userText, msg) {
  const intent = detectNaturalIntegrationIntent(userText);
  if (!intent) return { handled: false };
  const services = getIntegrationServices(userId);
  const context = await getIntegrationContext(userId, userText);
  let result;
  if (intent.mode === 'read_only') {
    result = await integrationsSystem.connectorExecutor.executeConnectorAction(intent.connectorId, intent.action, intent.payload, context, services);
  } else {
    result = await integrationsSystem.connectorExecutor.executeConnectorAction(intent.connectorId, intent.action, intent.payload, context, services);
  }
  const answer = [
    intent.mode === 'read_only' ? 'Integrasi read-only:' : 'Integrasi write/external membutuhkan Evaluation v2 + executor approval:',
    '',
    formatIntegrationResult(result)
  ].join('\n');
  await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id, userText });
  return { handled: true, answer, integration: result };
}

function formatPermissionFlags(summary = {}) {
  const flags = [
    summary.canRead ? 'read' : '',
    summary.canWrite ? 'write' : '',
    summary.canDanger ? 'danger' : '',
    summary.canOps ? 'ops' : '',
    summary.canManageMembers ? 'manage_members' : ''
  ].filter(Boolean);
  return flags.length ? flags.join(', ') : 'limited/none';
}

function formatPlanLine(plan, index) {
  const taskCount = Array.isArray(plan.taskIds) ? plan.taskIds.length : 0;
  const milestoneCount = Array.isArray(plan.milestones) ? plan.milestones.length : 0;
  return `${index + 1}. ${plan.id} - ${plan.title} [${plan.status}, ${plan.horizon}, tasks ${taskCount}, milestones ${milestoneCount}]`;
}

function formatTaskLine(task, index) {
  const score = Number(task.priorityScore || 0);
  const blocked = task.status === 'blocked' && task.blockedReason ? ` Blocked: ${task.blockedReason}` : '';
  return `${index + 1}. ${task.id} - ${task.title} [${task.status}, ${task.priority}, score ${score}]${blocked}`;
}

function formatExecutionProposalLine(proposal, index) {
  const actions = Array.isArray(proposal.proposedActions) ? proposal.proposedActions.length : 0;
  return `${index + 1}. ${proposal.id} - ${proposal.title} [${proposal.status}, risk ${proposal.riskLevel}, actions ${actions}]`;
}

function formatExecutionActionLine(action, index) {
  return `${index + 1}. ${action.type} -> ${action.description || action.targetId || '-'} [${action.riskLevel || 'low'}]`;
}

function formatToolLine(tool, index) {
  return `${index + 1}. ${tool.id} - ${tool.name} [${tool.category}, ${tool.riskLevel}, ${tool.enabled ? 'enabled' : 'disabled'}${tool.requiresApproval ? ', approval' : ''}]`;
}

function formatToolResult(result) {
  if (!result) return '-';
  if (typeof result === 'string') return result;
  if (result.text) return result.text;
  if (result.answer) return result.answer;
  return JSON.stringify(result, null, 2).slice(0, 1800);
}

function formatBackupLine(manifest, index) {
  const total = Object.values(manifest.itemCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return `${index + 1}. ${manifest.id} - ${manifest.type} [${manifest.status}, items ${total}, ${manifest.createdAt || '-'}]`;
}

function formatBackupScheduleLine(schedule, index) {
  return `${index + 1}. ${schedule.id} - ${schedule.name} [${schedule.scope}, ${schedule.frequency}, ${schedule.enabled ? 'enabled' : 'disabled'}, next ${schedule.nextRunAt || '-'}]`;
}

function formatBackupScheduleRunLine(run, index) {
  return `${index + 1}. ${run.id} - schedule=${run.scheduleId} [${run.status}, backup=${run.backupId || '-'}]`;
}

function buildPlannerCommandText(title, lines, emptyText) {
  return [
    title,
    '',
    ...(lines.length ? lines : [emptyText])
  ].join('\n');
}

async function buildWhoAmIText(userId) {
  const services = getWorkspaceServices();
  const defaultWorkspace = await workspaceSystem.store.getDefaultWorkspaceForUser(userId, services);
  const summary = await workspaceSystem.permissions.getPermissionSummary(userId, defaultWorkspace?.id, services);
  return [
    'Who Am I',
    '',
    `User ID: ${userId}`,
    `Role bot: ${isAdmin(userId) ? 'admin/owner' : 'user'}`,
    `Default workspace: ${defaultWorkspace?.id || '-'}`,
    `Workspace role: ${summary.role || 'none'}`,
    `Permissions: ${formatPermissionFlags(summary)}`,
    '',
    'Catatan: token, API key, dan connection string tidak pernah ditampilkan.'
  ].join('\n');
}

async function getDefaultWorkspaceIdForUser(userId) {
  const workspace = await workspaceSystem.store.getDefaultWorkspaceForUser(userId, getWorkspaceServices());
  return workspace?.id || workspaceSystem.utils.getPersonalWorkspaceId(userId);
}

async function buildWorkspaceText(userId) {
  const services = getWorkspaceServices();
  const defaultWorkspace = await workspaceSystem.store.getDefaultWorkspaceForUser(userId, services);
  const summary = await workspaceSystem.permissions.getPermissionSummary(userId, defaultWorkspace?.id, services);
  const cognitiveWorkspaces = aiOS.cognitiveWorkspace.listWorkspaces(userId, getAiosServices(), 10);
  const activeCognitive = aiOS.cognitiveWorkspace.getActiveWorkspace(userId, getAiosServices());
  const cognitiveText = cognitiveWorkspaces.length
    ? [
      `Aktif: ${activeCognitive ? `${activeCognitive.id} - ${activeCognitive.title}` : '-'}`,
      ...cognitiveWorkspaces.map((item, index) => `${index + 1}. ${item.id} - ${item.title} (${(item.notes || []).length} catatan)`)
    ].join('\n')
    : 'Belum ada cognitive workspace. Buat dengan /workspaceadd judul | deskripsi';

  return [
    'Workspace Saat Ini',
    '',
    `Workspace ID: ${defaultWorkspace?.id || '-'}`,
    `Nama: ${defaultWorkspace?.name || '-'}`,
    `Tipe: ${defaultWorkspace?.type || '-'}`,
    `Role: ${summary.role || 'none'}`,
    `Permissions: ${formatPermissionFlags(summary)}`,
    `Member aktif: ${(defaultWorkspace?.members || []).filter(member => member.status === 'active').length}`,
    '',
    'Cognitive Workspace Lama',
    cognitiveText
  ].join('\n');
}

async function buildWorkspacesText(userId) {
  const services = getWorkspaceServices();
  const workspaces = await workspaceSystem.store.listWorkspacesForUser(userId, services, { includeArchived: false });
  if (!workspaces.length) return 'Belum ada workspace. Workspace personal akan dibuat otomatis saat dibutuhkan.';
  const lines = [];
  for (const item of workspaces.slice(0, 20)) {
    const summary = await workspaceSystem.permissions.getPermissionSummary(userId, item.id, services);
    lines.push(`- ${item.id} | ${item.name} | role=${summary.role} | type=${item.type}`);
  }
  return [
    'Workspace yang Bisa Diakses',
    '',
    ...lines,
    '',
    'Dashboard workspace tersedia di /dashboard jika DASHBOARD_ENABLED aktif.'
  ].join('\n');
}

function formatSelfHealingRunSummary(result = {}) {
  const rows = (result.results || []).slice(0, 12).map(run => {
    return `- ${run.status} | ${run.severity || '-'} | ${run.guardId || '-'} | ${run.summary || '-'}`;
  });
  return [
    result.summary || 'Self-healing check selesai.',
    '',
    rows.length ? rows.join('\n') : 'Tidak ada guard result.',
    '',
    'Repair bersifat plan/proposal saja. Tidak ada auto-repair.'
  ].join('\n');
}

function formatRepairPlanBrief(plan = {}) {
  return [
    `${plan.id || '-'} | ${plan.status || 'draft'} | risk=${plan.riskLevel || '-'}`,
    plan.title || 'Untitled repair plan',
    `Area: ${(plan.affectedAreas || []).join(', ') || '-'}`,
    `Approval: ${plan.requiresApproval ? 'required' : 'not required'}`
  ].join('\n');
}

async function handleSelfHealingCommands(chatId, userId, cmd, args, msg) {
  const replyOpt = { reply_to_message_id: msg.message_id };
  const commands = new Set([
    '/selfheal',
    '/healthcheck',
    '/regressioncheck',
    '/dashboardcheck',
    '/repairplans',
    '/repairplan',
    '/repairprompt',
    '/propose_repair'
  ]);
  if (!commands.has(cmd)) return false;

  if (!selfHealingSystem) {
    await sendChunkedMessage(chatId, 'Self-Healing system belum tersedia di runtime ini. Bot tetap berjalan normal.', replyOpt);
    return true;
  }

  const ctx = { workspaceId: '', userId };

  if (cmd === '/selfheal') {
    const guards = await selfHealingSystem.store.getGuards();
    const plans = await selfHealingSystem.store.getRepairPlans();
    await sendChunkedMessage(chatId, [
      'Self-Healing / Regression Guard',
      '',
      `Guards: ${guards.length}`,
      `Repair plans: ${plans.length}`,
      `Dashboard: ${WEBHOOK_URL ? `${WEBHOOK_URL.replace(/\/$/, '')}/dashboard#selfhealing` : '/dashboard#selfhealing'}`,
      '',
      'Commands:',
      '/healthcheck - run semua guard read-only',
      '/regressioncheck - run P0/critical guard',
      '/dashboardcheck - run dashboard route guard',
      '/repairplans - daftar repair plan',
      '/repairplan <id> - detail repair plan',
      '/repairprompt <id> - generate prompt repair',
      '/propose_repair <id> - buat executor proposal, tidak auto-run',
      '',
      'Catatan: tidak ada shell executor, auto-approve, atau auto-repair.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/healthcheck') {
    const result = await selfHealingSystem.runAllChecks(ctx);
    await sendChunkedMessage(chatId, `Health Check Suite\n\n${formatSelfHealingRunSummary(result)}`, replyOpt);
    return true;
  }

  if (cmd === '/regressioncheck') {
    const result = await selfHealingSystem.runP0Checks(ctx);
    await sendChunkedMessage(chatId, `P0 Regression Check\n\n${formatSelfHealingRunSummary(result)}`, replyOpt);
    return true;
  }

  if (cmd === '/dashboardcheck') {
    const result = await selfHealingSystem.healthCheckSuite.runHealthCheckSuite({ category: 'dashboard' }, ctx);
    await sendChunkedMessage(chatId, `Dashboard Route Guard\n\n${formatSelfHealingRunSummary(result)}`, replyOpt);
    return true;
  }

  if (cmd === '/repairplans') {
    const plans = (await selfHealingSystem.store.getRepairPlans()).slice(-10).reverse();
    const body = plans.length ? plans.map(formatRepairPlanBrief).join('\n\n') : 'Belum ada repair plan.';
    await sendChunkedMessage(chatId, `Repair Plans\n\n${body}`, replyOpt);
    return true;
  }

  if (cmd === '/repairplan') {
    const planId = String(args || '').trim();
    if (!planId) {
      await sendChunkedMessage(chatId, 'Contoh: /repairplan rp_xxx', replyOpt);
      return true;
    }
    const plan = await selfHealingSystem.store.getRepairPlan(planId);
    if (!plan) {
      await sendChunkedMessage(chatId, `Repair plan tidak ditemukan: ${planId}`, replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      'Repair Plan Detail',
      '',
      formatRepairPlanBrief(plan),
      '',
      `Problem: ${plan.problemSummary || '-'}`,
      `Root cause hypothesis: ${plan.suspectedRootCause || '-'}`,
      '',
      'Files:',
      (plan.filesLikelyAffected || []).map(file => `- ${file}`).join('\n') || '-',
      '',
      'Tests:',
      (plan.testsToRun || []).map(test => `- ${test}`).join('\n') || '-'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/repairprompt') {
    if (!isAdmin(userId)) {
      await sendChunkedMessage(chatId, 'Generate repair prompt hanya untuk admin/owner.', replyOpt);
      return true;
    }
    const planId = String(args || '').trim();
    if (!planId) {
      await sendChunkedMessage(chatId, 'Contoh: /repairprompt rp_xxx', replyOpt);
      return true;
    }
    const plan = await selfHealingSystem.store.getRepairPlan(planId);
    if (!plan) {
      await sendChunkedMessage(chatId, `Repair plan tidak ditemukan: ${planId}`, replyOpt);
      return true;
    }
    const prompt = selfHealingSystem.repairPromptGenerator.generateCodexRepairPrompt(plan);
    plan.codexPrompt = prompt;
    plan.status = 'prompt_ready';
    await selfHealingSystem.store.saveRepairPlan(plan);
    await selfHealingSystem.store.savePrompt({ repairPlanId: plan.id, type: 'codex', prompt });
    await sendChunkedMessage(chatId, `Codex Repair Prompt\n\n${prompt}`, replyOpt);
    return true;
  }

  if (cmd === '/propose_repair') {
    if (!isAdmin(userId)) {
      await sendChunkedMessage(chatId, 'Repair proposal hanya untuk admin/owner.', replyOpt);
      return true;
    }
    const planId = String(args || '').trim();
    if (!planId) {
      await sendChunkedMessage(chatId, 'Contoh: /propose_repair rp_xxx', replyOpt);
      return true;
    }
    const result = await selfHealingSystem.repairProposalBridge.createRepairExecutorProposal(planId, {
      workspaceId: '',
      userId,
      evaluationSystem: evaluationSystem || null
    });
    await sendChunkedMessage(chatId, result.ok ? [
      'Repair proposal dibuat.',
      `Proposal ID: ${result.proposalId || '-'}`,
      `Approval required: ${result.requiresApproval ? 'yes' : 'no'}`,
      '',
      'Belum dijalankan. Gunakan /approve lalu /runexec sesuai flow executor.'
    ].join('\n') : `Gagal membuat repair proposal: ${result.error || result.reason || 'unknown'}`, replyOpt);
    return true;
  }

  return false;
}

function formatAutoHealActionLine(action = {}) {
  return [
    `${action.id || '-'} | ${action.level || '-'} | risk=${action.riskLevel || '-'}`,
    action.name || 'Unnamed autoheal action',
    `Approval: ${action.requiresApproval ? 'required' : 'not required'} | Evaluation: ${action.requiresEvaluation ? 'required' : 'not required'}`
  ].join('\n');
}

async function handlePhase33OpsCommands(chatId, userId, cmd, args, msg) {
  const replyOpt = { reply_to_message_id: msg.message_id };
  const commands = new Set([
    '/monitor',
    '/livehealth',
    '/autoheal',
    '/autoheal_runs',
    '/autoheal_run',
    '/cicd',
    '/cicd_status',
    '/github_actions',
    '/propose_workflow',
    '/propose_deploy'
  ]);
  if (!commands.has(cmd)) return false;

  if (cmd === '/monitor' || cmd === '/livehealth') {
    if (!monitoringSystem) {
      await sendChunkedMessage(chatId, 'Monitoring system belum tersedia. Bot tetap berjalan normal.', replyOpt);
      return true;
    }
    const snapshot = monitoringSystem.realtimeHealth.getSnapshot();
    const status = monitoringSystem.realtimeHealth.buildHealthPayload({ storageManager, selfHealingSystem, cicdSystem, evaluationSystem });
    await sendChunkedMessage(chatId, [
      'Live Monitoring',
      '',
      `Status: ${status.status || 'ok'}`,
      `Health events: ${(snapshot.events || []).length}`,
      `WS clients: ${monitoringSystem.wsServer.getClientCount()}`,
      `WS fallback: ${monitoringSystem.wsServer.fallbackActive ? 'yes' : 'no'}`,
      `Dashboard: ${WEBHOOK_URL ? `${WEBHOOK_URL.replace(/\/$/, '')}/dashboard#monitoring` : '/dashboard#monitoring'}`,
      '',
      'Payload monitoring disanitasi dan dashboard tetap butuh token.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/autoheal') {
    if (!autoHealingSystem) {
      await sendChunkedMessage(chatId, 'Auto-healing system belum tersedia.', replyOpt);
      return true;
    }
    const actions = await autoHealingSystem.store.getActions();
    const body = actions.slice(0, 12).map(formatAutoHealActionLine).join('\n\n') || 'Belum ada action terdaftar.';
    await sendChunkedMessage(chatId, [
      'Safe Auto-Healing Runtime',
      '',
      body,
      '',
      'L0 observe only, L1 safe auto-heal, L2 proposal required, L3 blocked.',
      'Gunakan: /autoheal_run <actionId>'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/autoheal_runs') {
    if (!autoHealingSystem) {
      await sendChunkedMessage(chatId, 'Auto-healing system belum tersedia.', replyOpt);
      return true;
    }
    const runs = (await autoHealingSystem.store.getRuns()).slice(-10).reverse();
    const body = runs.length ? runs.map(run => `- ${run.id || '-'} | ${run.actionId || '-'} | ${run.status || '-'} | ${run.summary || '-'}`).join('\n') : 'Belum ada auto-heal run.';
    await sendChunkedMessage(chatId, `Auto-Heal Runs\n\n${body}`, replyOpt);
    return true;
  }

  if (cmd === '/autoheal_run') {
    if (!autoHealingSystem) {
      await sendChunkedMessage(chatId, 'Auto-healing system belum tersedia.', replyOpt);
      return true;
    }
    const actionId = String(args || '').trim();
    if (!actionId) {
      await sendChunkedMessage(chatId, 'Contoh: /autoheal_run ah_healthcheck_rerun', replyOpt);
      return true;
    }
    const result = await autoHealingSystem.runner.runAutoHeal(actionId, { workspaceId: '', userId, trigger: 'telegram' });
    await sendChunkedMessage(chatId, [
      'Auto-Heal Run Result',
      '',
      `OK: ${result.ok ? 'yes' : 'no'}`,
      `Status: ${result.status || '-'}`,
      `Run: ${result.runId || '-'}`,
      `Proposal/Plan: ${result.proposalId || result.planId || '-'}`,
      `Summary: ${result.summary || result.error || result.reason || '-'}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/cicd' || cmd === '/cicd_status' || cmd === '/github_actions') {
    if (!cicdSystem) {
      await sendChunkedMessage(chatId, 'CI/CD system belum tersedia.', replyOpt);
      return true;
    }
    const status = await cicdSystem.githubStatus.getGithubActionsStatus();
    await sendChunkedMessage(chatId, [
      'CI/CD / GitHub Actions',
      '',
      `Configured: ${status.configured ? 'yes' : 'no'}`,
      `Status: ${status.status || (status.ok ? 'available' : 'setup_required')}`,
      `Summary: ${status.summary || '-'}`,
      `Workflows: ${(status.workflows || []).join(', ') || 'ci.yml, release-check.yml, dashboard-regression.yml'}`,
      `Dashboard: ${WEBHOOK_URL ? `${WEBHOOK_URL.replace(/\/$/, '')}/dashboard#cicd` : '/dashboard#cicd'}`,
      '',
      'Dispatch/deploy tetap proposal-only: /propose_workflow <workflowId> atau /propose_deploy'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/propose_workflow') {
    if (!isAdmin(userId)) {
      await sendChunkedMessage(chatId, 'Workflow dispatch proposal hanya untuk admin/owner.', replyOpt);
      return true;
    }
    if (!cicdSystem) {
      await sendChunkedMessage(chatId, 'CI/CD system belum tersedia.', replyOpt);
      return true;
    }
    const workflowId = String(args || '').trim() || 'release-check.yml';
    const result = await cicdSystem.githubActionsProposal.createWorkflowDispatchProposal(workflowId, 'main', {}, { workspaceId: '', userId });
    await sendChunkedMessage(chatId, result.ok
      ? `Workflow dispatch proposal dibuat.\nProposal: ${result.proposalId}\nBelum dijalankan. Approve lalu /runexec.`
      : `Workflow dispatch proposal belum dibuat: ${result.error || 'Evaluation/executor unavailable'}`, replyOpt);
    return true;
  }

  if (cmd === '/propose_deploy') {
    if (!isAdmin(userId)) {
      await sendChunkedMessage(chatId, 'Deploy proposal hanya untuk admin/owner.', replyOpt);
      return true;
    }
    if (!cicdSystem) {
      await sendChunkedMessage(chatId, 'CI/CD system belum tersedia.', replyOpt);
      return true;
    }
    const result = await cicdSystem.githubActionsProposal.createDeployProposal('render', { workspaceId: '', userId });
    await sendChunkedMessage(chatId, result.ok
      ? `Deploy proposal dibuat.\nProposal: ${result.proposalId}\nBelum deploy. Approve lalu /runexec.`
      : `Deploy proposal belum dibuat: ${result.error || 'Evaluation/executor unavailable'}`, replyOpt);
    return true;
  }

  return false;
}

async function handleAiosCommands(chatId, userId, cmd, args, msg) {
  const services = getAiosServices();
  const replyOpt = { reply_to_message_id: msg.message_id };

  if (cmd === '/backup') {
    const status = await backupSystem.disasterRecovery.getDisasterRecoveryStatus(getBackupServices(userId));
    await sendChunkedMessage(chatId, [
      'Backup & Recovery',
      '',
      'Commands:',
      '/backupcreate - buat backup workspace personal',
      '/backups - daftar backup terbaru',
      '/backupstatus - status backup dan recovery',
      '/recovery - disaster recovery check',
      '/integrity - integrity check ringan',
      '/exportsummary - ringkasan export aman',
      '',
      `Recovery status: ${status.status}`,
      `Latest backup: ${status.backup?.latestBackupAt || '-'}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/backupcreate') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await backupSystem.backupEngine.createWorkspaceBackup(workspaceId, {
      actorId: userId,
      userId,
      workspaceId,
      includeAudit: false
    }, getBackupServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Backup berhasil dibuat.',
      '',
      formatBackupLine(result.manifest, 0),
      `Checksum: ${result.manifest.checksum}`,
      '',
      'Export JSON penuh tersedia dari dashboard Backup & Recovery.'
    ].join('\n') : `Backup gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/backups') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const backups = await backupSystem.backupEngine.listBackups({ workspaceId, limit: 10, includeArchived: true }, getBackupServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Backup terbaru',
      backups.map(formatBackupLine),
      'Belum ada backup. Jalankan /backupcreate.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/backupstatus') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const backupServices = getBackupServices(userId);
    await backupSystem.backupScheduler.requestDueScheduleApprovals({ workspaceId, userId, limit: 20 }, backupServices);
    const status = await backupSystem.disasterRecovery.getDisasterRecoveryStatus(backupServices);
    await sendChunkedMessage(chatId, [
      'Backup Status',
      '',
      `Recovery: ${status.status}`,
      `Backup count: ${status.backup?.backupCount || 0}`,
      `Latest backup: ${status.backup?.latestBackupAt || '-'}`,
      `Stale: ${status.backup?.stale ? 'yes' : 'no'}`,
      `Storage driver: ${status.storage?.activeDriver || '-'}`,
      `Fallback active: ${status.storage?.fallbackActive ? 'yes' : 'no'}`,
      `Critical missing: ${(status.critical?.missing || []).join(', ') || '-'}`
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/recovery') {
    const result = await backupSystem.disasterRecovery.runDisasterRecoveryCheck(getBackupServices(userId));
    await sendChunkedMessage(chatId, [
      'Disaster Recovery Check',
      '',
      `Status: ${result.status.status}`,
      '',
      'Recommendations:',
      ...(result.recommendations || []).map(item => `- ${item}`)
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/integrity') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const report = await backupSystem.integrityChecker.runIntegrityCheck({ userId, workspaceId }, getBackupServices(userId));
    await sendChunkedMessage(chatId, [
      'Integrity Check',
      '',
      `OK: ${report.ok ? 'yes' : 'no'}`,
      `Issues: ${report.issueCount}`,
      '',
      ...Object.entries(report.checks || {}).map(([key, value]) => `- ${key}: ${value.ok ? 'ok' : `${value.issueCount} issue`}`),
      '',
      ...(report.issues || []).slice(0, 8).map(issue => `Issue: ${issue.type} ${issue.item || ''}`)
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/exportsummary') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await backupSystem.exportEngine.exportUserSummaryJson(userId, { actorId: userId, workspaceId }, getBackupServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Export Summary',
      '',
      `File name: ${result.fileName}`,
      `Backup ID: ${result.payload.manifest?.id || '-'}`,
      '',
      'Item counts:',
      ...Object.entries(result.payload.itemCounts || {}).map(([key, value]) => `- ${key}: ${value}`),
      '',
      'Raw JSON besar hanya tersedia dari dashboard agar Telegram tidak kepanjangan.'
    ].join('\n') : `Export summary gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/pwa') {
    const base = getDashboardBaseUrl();
    await sendChunkedMessage(chatId, [
      'PWA Dashboard',
      '',
      `Dashboard URL: ${base ? `${base}/dashboard` : '/dashboard'}`,
      'Cara install di HP:',
      '1. Buka URL dashboard di Chrome Android.',
      '2. Login pakai DASHBOARD_ADMIN_TOKEN.',
      '3. Pilih menu browser > Add to Home screen jika tombol install belum muncul.',
      '',
      'Service worker hanya cache static dashboard shell. Data API, backup JSON, dan Authorization header tidak di-cache.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/backupdownload') {
    const base = getDashboardBaseUrl();
    await sendChunkedMessage(chatId, [
      'Backup Download',
      '',
      `Buka: ${base ? `${base}/dashboard#backup` : '/dashboard#backup'}`,
      'Gunakan tombol Export JSON pada backup.',
      'File dibuat dari browser dengan nama aman dan checksum.',
      '',
      'Telegram tidak mengirim raw backup besar agar tidak bocor/terpotong. Secrets/env/API key tetap dikecualikan.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/importhelp') {
    await sendChunkedMessage(chatId, [
      'Import / Restore Help',
      '',
      'Import dilakukan dari dashboard Backup & Recovery:',
      '1. Paste/drop JSON backup.',
      '2. Validate import.',
      '3. Preview diff.',
      '4. Create restore plan.',
      '5. Restore hanya jalan dengan konfirmasi RESTORE dan role owner/admin.',
      '',
      'Import yang mengandung token, API key, DATABASE_URL, REDIS_URL, atau credential akan ditolak.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/backupschedule') {
    if (String(args || '').trim()) {
      const parts = String(args || '').split('|').map(part => part.trim());
      const [name, scope = 'workspace', frequency = 'weekly'] = parts;
      const workspaceId = await getDefaultWorkspaceIdForUser(userId);
      const result = await backupSystem.backupScheduler.createBackupSchedule({
        actorId: userId,
        userId,
        workspaceId,
        name,
        scope,
        frequency,
        enabled: true
      }, getBackupServices(userId));
      await sendChunkedMessage(chatId, result.ok ? [
        'Backup schedule dibuat.',
        '',
        formatBackupScheduleLine(result.schedule, 0)
      ].join('\n') : `Schedule gagal: ${result.reason}`, replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      'Backup Scheduler',
      '',
      'Format:',
      '/backupschedule nama | scope | frequency',
      '',
      'Scope: workspace, user, system_safe',
      'Frequency: manual, daily, weekly, monthly',
      '',
      'Contoh:',
      '/backupschedule Weekly Backup | workspace | weekly',
      '',
      'Catatan: schedule tidak menjalankan backup otomatis. Buat pending run dengan /backupdue atau dashboard, approve dengan /backupapprove, lalu run dengan /backuprun.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/backupschedules') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const schedules = await backupSystem.backupScheduler.listBackupSchedules({ workspaceId, userId, limit: 20 }, getBackupServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Backup Schedules',
      schedules.map(formatBackupScheduleLine),
      'Belum ada schedule. Buat dengan /backupschedule nama | workspace | weekly'
    ), replyOpt);
    return true;
  }

  if (cmd === '/backupdue') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const services = getBackupServices(userId);
    await backupSystem.backupScheduler.requestDueScheduleApprovals({ workspaceId, userId, limit: 20 }, services);
    const schedules = await backupSystem.backupScheduler.listBackupSchedules({ workspaceId, userId, limit: 20 }, services);
    const due = schedules.filter(item => item.due);
    const pending = await backupSystem.backupScheduler.listScheduleRuns({ workspaceId, userId, status: 'pending_approval', limit: 20 }, services);
    await sendChunkedMessage(chatId, [
      'Backup Due / Pending',
      '',
      'Due schedules:',
      ...(due.length ? due.map(formatBackupScheduleLine) : ['- Tidak ada due schedule.']),
      '',
      'Pending approvals:',
      ...(pending.length ? pending.map(formatBackupScheduleRunLine) : ['- Tidak ada pending run.']),
      '',
      'Dashboard bisa request run dari schedule. Setelah ada runId: /backupapprove <runId>, lalu /backuprun <runId>.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/backupapprove') {
    const runId = String(args || '').trim();
    if (!runId) {
      await safeSendMessage(chatId, 'Contoh: /backupapprove backup_schedule_run_xxx', replyOpt);
      return true;
    }
    const result = await backupSystem.backupScheduler.approveScheduleRun(runId, { actorId: userId }, getBackupServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Backup schedule run approved.',
      '',
      formatBackupScheduleRunLine(result.run, 0),
      '',
      `Jalankan dengan: /backuprun ${result.run.id}`
    ].join('\n') : `Approve gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/backuprun') {
    const runId = String(args || '').trim();
    if (!runId) {
      await safeSendMessage(chatId, 'Contoh: /backuprun backup_schedule_run_xxx', replyOpt);
      return true;
    }
    const result = await backupSystem.backupScheduler.runApprovedSchedule(runId, getBackupServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Scheduled backup selesai.',
      '',
      formatBackupScheduleRunLine(result.run, 0),
      `Backup: ${result.backup?.id || '-'}`,
      `Checksum: ${result.backup?.checksum || '-'}`
    ].join('\n') : `Run gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/backupscheduleadd') {
    const parts = String(args || '').split('|').map(part => part.trim());
    const [name, scope = 'workspace', frequency = 'weekly'] = parts;
    if (!name) {
      await safeSendMessage(chatId, 'Contoh: /backupscheduleadd Weekly Backup | workspace | weekly', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await backupSystem.backupScheduler.createBackupSchedule({
      actorId: userId,
      userId,
      workspaceId,
      name,
      scope,
      frequency,
      enabled: true
    }, getBackupServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Backup schedule dibuat.',
      '',
      formatBackupScheduleLine(result.schedule, 0)
    ].join('\n') : `Schedule gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/tools') {
    const toolServices = getToolServices(userId);
    await toolsSystem.builtinTools.registerBuiltInTools(toolServices);
    const tools = await toolsSystem.toolRegistry.listTools({ enabled: true, limit: 100 }, toolServices);
    const byCategory = tools.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {});
    const lines = Object.entries(byCategory).flatMap(([category, items]) => [
      '',
      category.toUpperCase(),
      ...items.slice(0, 15).map(formatToolLine)
    ]);
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Tool Registry',
      lines,
      'Belum ada tool enabled. Cek dashboard Tool Registry.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/tool') {
    const toolId = String(args || '').trim();
    if (!toolId) {
      await safeSendMessage(chatId, 'Format: /tool <toolId>', replyOpt);
      return true;
    }
    const toolServices = getToolServices(userId);
    await toolsSystem.builtinTools.registerBuiltInTools(toolServices);
    const tool = await toolsSystem.toolRegistry.getTool(toolId, toolServices);
    await sendChunkedMessage(chatId, tool ? [
      `Tool: ${tool.id}`,
      `Name: ${tool.name}`,
      `Category: ${tool.category}`,
      `Risk: ${tool.riskLevel}`,
      `Enabled: ${tool.enabled ? 'yes' : 'no'}`,
      `Approval: ${tool.requiresApproval ? 'required' : 'direct if permitted'}`,
      `Permissions: ${(tool.permissionsRequired || []).join(', ') || 'read'}`,
      '',
      tool.description || '-'
    ].join('\n') : `Tool tidak ditemukan: ${toolId}`, replyOpt);
    return true;
  }

  if (cmd === '/toolpreview') {
    const [toolId, rawInput = ''] = splitPipeArgs(args);
    if (!toolId) {
      await safeSendMessage(chatId, 'Format: /toolpreview <toolId> | <input JSON atau teks>', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await toolsSystem.toolRunner.previewToolRun(toolId, toolsSystem.toolUtils.parseToolInput(rawInput), {
      actorId: userId,
      userId,
      workspaceId
    }, getToolServices(userId));
    await sendChunkedMessage(chatId, result.ok ? `Preview tool:\n${formatToolResult(result.preview)}` : `Preview gagal: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/toolrun') {
    const [toolId, rawInput = ''] = splitPipeArgs(args);
    if (!toolId) {
      await safeSendMessage(chatId, 'Format: /toolrun <toolId> | <input JSON atau teks>', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await toolsSystem.toolRunner.runTool(toolId, toolsSystem.toolUtils.parseToolInput(rawInput), {
      actorId: userId,
      userId,
      workspaceId
    }, getToolServices(userId));
    if (result.requiresApproval) {
      await safeSendMessage(chatId, `Tool ini butuh approval. Buat proposal dengan:\n/toolpropose ${toolId} | ${rawInput || '{}'}`, replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, result.ok ? `Tool result:\n${formatToolResult(result.result)}` : `Tool gagal: ${result.reason || result.error}`, replyOpt);
    return true;
  }

  if (cmd === '/toolpropose') {
    const [toolId, rawInput = ''] = splitPipeArgs(args);
    if (!toolId) {
      await safeSendMessage(chatId, 'Format: /toolpropose <toolId> | <input JSON atau teks>', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await toolsSystem.toolRunner.buildToolExecutionProposal(toolId, toolsSystem.toolUtils.parseToolInput(rawInput), {
      actorId: userId,
      userId,
      workspaceId,
      sourceType: 'manual',
      sourceId: toolId
    }, getToolServices(userId));
    await sendChunkedMessage(chatId, result.ok ? [
      'Proposal tool dibuat.',
      '',
      formatExecutionProposalLine(result.proposal, 0),
      '',
      `Approve: /approve ${result.proposal.id}`,
      `Run: /runexec ${result.proposal.id}`
    ].join('\n') : `Gagal membuat proposal tool: ${result.reason}`, replyOpt);
    return true;
  }

  if (cmd === '/toolenable' || cmd === '/tooldisable') {
    const toolId = String(args || '').trim();
    if (!toolId) {
      await safeSendMessage(chatId, `Format: ${cmd} <toolId>`, replyOpt);
      return true;
    }
    if (!isAdmin(userId)) {
      await safeSendMessage(chatId, 'Hanya admin bot yang boleh enable/disable tool global.', replyOpt);
      return true;
    }
    const result = cmd === '/toolenable'
      ? await toolsSystem.toolRegistry.enableTool(toolId, getToolServices(userId))
      : await toolsSystem.toolRegistry.disableTool(toolId, getToolServices(userId));
    await safeSendMessage(chatId, result.ok ? `Tool ${cmd === '/toolenable' ? 'enabled' : 'disabled'}: ${result.tool.id}` : `Gagal update tool: ${result.error}`, replyOpt);
    return true;
  }

  if (cmd === '/executions') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const proposals = await executorSystem.executionStore.listExecutionItems(executorSystem.executionStore.EXECUTOR_PROPOSALS_KEY, {
      userId,
      workspaceId,
      limit: 20,
      includeExpired: true
    }, getExecutorServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Execution proposals',
      proposals.map(formatExecutionProposalLine),
      'Belum ada proposal eksekusi. Buat dari task dengan /propose <taskId>.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/pending') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const proposals = await executorSystem.executionQueue.listPendingApprovals({
      userId,
      actorId: userId,
      workspaceId,
      limit: 20
    }, getExecutorServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Pending approvals',
      proposals.map(formatExecutionProposalLine),
      'Tidak ada approval yang menunggu.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/propose') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, 'Format: /propose <taskId>\nProposal dibuat saja, tidak akan dijalankan sebelum /approve lalu /runexec.', replyOpt);
      return true;
    }
    const result = await executorSystem.executionPlanner.proposeFromPlannerTask(taskId, {
      actorId: userId
    }, getExecutorServices(userId));
    if (!result.ok) {
      await safeSendMessage(chatId, `Gagal membuat proposal: ${result.reason}`, replyOpt);
      return true;
    }
    await sendChunkedMessage(chatId, [
      'Proposal eksekusi dibuat.',
      '',
      formatExecutionProposalLine(result.proposal, 0),
      '',
      'Actions:',
      ...(result.proposal.proposedActions || []).map(formatExecutionActionLine),
      '',
      `Approve: /approve ${result.proposal.id}`,
      `Run setelah approved: /runexec ${result.proposal.id}`,
      'Catatan: approval tidak menjalankan aksi otomatis.'
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/approve') {
    const proposalId = String(args || '').trim();
    if (!proposalId) {
      await safeSendMessage(chatId, 'Format: /approve <proposalId>\nApprove hanya menyetujui; jalankan dengan /runexec <proposalId>.', replyOpt);
      return true;
    }
    const result = await executorSystem.executionQueue.approveExecution(proposalId, userId, getExecutorServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Proposal approved:\n${formatExecutionProposalLine(result.proposal, 0)}\n\nJalankan dengan /runexec ${proposalId}` : `Gagal approve: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/reject') {
    const [proposalId, reason = 'Rejected by Telegram user.'] = splitPipeArgs(args);
    if (!proposalId) {
      await safeSendMessage(chatId, 'Format: /reject <proposalId> | <reason>', replyOpt);
      return true;
    }
    const result = await executorSystem.executionQueue.rejectExecution(proposalId, userId, reason, getExecutorServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Proposal rejected:\n${formatExecutionProposalLine(result.proposal, 0)}` : `Gagal reject: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/cancel_exec') {
    const proposalId = String(args || '').trim();
    if (!proposalId) {
      await safeSendMessage(chatId, 'Format: /cancel_exec <proposalId>', replyOpt);
      return true;
    }
    const result = await executorSystem.executionQueue.cancelExecution(proposalId, userId, getExecutorServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Proposal cancelled:\n${formatExecutionProposalLine(result.proposal, 0)}` : `Gagal cancel: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/runexec') {
    const proposalId = String(args || '').trim();
    if (!proposalId) {
      await safeSendMessage(chatId, 'Format: /runexec <proposalId>\nProposal harus approved dulu dengan /approve <proposalId>.', replyOpt);
      return true;
    }
    const result = await executorSystem.approvedRunner.runApprovedExecution(proposalId, getExecutorServices(userId));
    const actionLines = (result.actionResults || []).map((item, index) => `${index + 1}. ${item.actionType} - ${item.ok ? 'ok' : `failed: ${item.error}`}`);
    await sendChunkedMessage(chatId, [
      result.ok ? 'Execution selesai.' : `Execution gagal: ${result.reason || result.proposal?.errorSummary || 'ACTION_FAILED'}`,
      '',
      result.proposal ? formatExecutionProposalLine(result.proposal, 0) : `Proposal: ${proposalId}`,
      '',
      ...(actionLines.length ? actionLines : ['Tidak ada action result.'])
    ].join('\n'), replyOpt);
    return true;
  }

  if (cmd === '/plans') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const plans = await plannerSystem.plannerEngine.listPlans({
      userId,
      actorId: userId,
      workspaceId,
      limit: 20
    }, getPlannerServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      'Plans aktif',
      plans.map(formatPlanLine),
      'Belum ada plan. Buat dengan /planadd <judul>.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/plan') {
    const planId = String(args || '').trim();
    if (!planId) {
      await safeSendMessage(chatId, 'Format: /plan <planId>', replyOpt);
      return true;
    }
    const summary = await plannerSystem.plannerEngine.summarizePlan(planId, getPlannerServices(userId));
    await sendChunkedMessage(chatId, summary.ok ? summary.summaryText : `Plan tidak ditemukan: ${summary.reason || planId}`, replyOpt);
    return true;
  }

  if (cmd === '/planadd') {
    const [title, description = '', horizon = 'weekly'] = splitPipeArgs(args);
    if (!title) {
      await safeSendMessage(chatId, 'Format: /planadd <judul> | <deskripsi optional> | <daily/weekly/monthly/quarterly/yearly>', replyOpt);
      return true;
    }
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await plannerSystem.plannerEngine.createPlan({
      userId,
      actorId: userId,
      workspaceId,
      title,
      description,
      horizon,
      status: 'active'
    }, getPlannerServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Plan dibuat:\n${formatPlanLine(result.plan, 0)}` : `Gagal membuat plan: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/plantasks') {
    const planId = String(args || '').trim();
    if (!planId) {
      await safeSendMessage(chatId, 'Format: /plantasks <planId>', replyOpt);
      return true;
    }
    const plan = await plannerSystem.plannerEngine.getPlan(planId, getPlannerServices(userId));
    if (!plan) {
      await safeSendMessage(chatId, `Plan tidak ditemukan: ${planId}`, replyOpt);
      return true;
    }
    const tasks = await plannerSystem.taskOrchestrator.listTasks({
      userId,
      actorId: userId,
      workspaceId: plan.workspaceId,
      planId,
      limit: 50
    }, getPlannerServices(userId));
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      `Tasks untuk ${plan.title}`,
      tasks.map(formatTaskLine),
      'Belum ada task. Tambah dengan /taskadd <planId> | <task title>.'
    ), replyOpt);
    return true;
  }

  if (cmd === '/taskadd') {
    const [planId, title, description = ''] = splitPipeArgs(args);
    if (!planId || !title) {
      await safeSendMessage(chatId, 'Format: /taskadd <planId> | <task title> | <description optional>', replyOpt);
      return true;
    }
    const plan = await plannerSystem.plannerEngine.getPlan(planId, getPlannerServices(userId));
    if (!plan) {
      await safeSendMessage(chatId, `Plan tidak ditemukan: ${planId}`, replyOpt);
      return true;
    }
    const result = await plannerSystem.taskOrchestrator.createTask({
      userId,
      actorId: userId,
      workspaceId: plan.workspaceId,
      planId,
      title,
      description
    }, getPlannerServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Task dibuat:\n${formatTaskLine(result.task, 0)}` : `Gagal membuat task: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/taskdone') {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await safeSendMessage(chatId, 'Format: /taskdone <taskId>', replyOpt);
      return true;
    }
    const result = await plannerSystem.taskOrchestrator.markTaskDone(taskId, getPlannerServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Task selesai:\n${formatTaskLine(result.task, 0)}` : `Gagal menandai task: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/taskblock') {
    const [taskId, reason = 'Blocked oleh user.'] = splitPipeArgs(args);
    if (!taskId) {
      await safeSendMessage(chatId, 'Format: /taskblock <taskId> | <reason>', replyOpt);
      return true;
    }
    const result = await plannerSystem.taskOrchestrator.markTaskBlocked(taskId, reason, getPlannerServices(userId));
    await safeSendMessage(
      chatId,
      result.ok ? `Task blocked:\n${formatTaskLine(result.task, 0)}` : `Gagal block task: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/next' || cmd === '/priorities') {
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const result = await plannerSystem.plannerEngine.suggestNextActions(workspaceId, userId, getPlannerServices(userId));
    const lines = (result.actions || []).map(formatTaskLine);
    if (result.blocked?.length) {
      lines.push('', 'Blocked:', ...result.blocked.map((task, index) => formatTaskLine(task, index)));
    }
    await sendChunkedMessage(chatId, buildPlannerCommandText(
      cmd === '/next' ? 'Next actions' : 'Prioritas task',
      lines,
      'Belum ada task planner aktif. Buat plan dengan /planadd lalu /taskadd.'
    ), replyOpt);
    return true;
  }

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
    const repositories = getStorageRepositoriesSafe();
    const memories = isRelationalStorageActive() && repositories?.memories
      ? await repositories.memories.listMemories(userId, { limit: 10 })
      : await aiOS.unifiedMemory.listMemories(userId, { limit: 10 }, services);
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
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const repositories = getStorageRepositoriesSafe();
    const relationalMemory = isRelationalStorageActive() && repositories?.memories
      ? await repositories.memories.createMemory({
        userId,
        type: 'semantic',
        content,
        source: 'user',
        tags: ['manual'],
        confidence: 0.85,
        importance: 0.72,
        metadata: { workspaceId }
      })
      : null;
    const result = relationalMemory
      ? { ok: true, memory: relationalMemory }
      : await aiOS.unifiedMemory.createMemory(userId, {
        type: 'semantic',
        content,
        source: 'user',
        tags: ['manual'],
        confidence: 0.85,
        importance: 0.72,
        workspaceId,
        metadata: { workspaceId }
      }, services);
    if (result.ok) {
      if (isRelationalStorageActive() && repositories?.insights) {
        await repositories.insights.createInsight({
          userId,
          type: 'memory',
          content,
          source: 'remember-command',
          relatedConcepts: ['manual-memory'],
          confidence: 0.75,
          importance: 0.62,
          metadata: { workspaceId }
        });
      } else {
        await aiOS.insightStore.createInsight(userId, {
        type: 'memory',
        content,
        source: 'remember-command',
        relatedConcepts: ['manual-memory'],
        confidence: 0.75,
        importance: 0.62,
        workspaceId,
        metadata: { workspaceId }
        }, services);
      }
      if (isRelationalStorageActive() && repositories?.graph) {
        await repositories.graph.upsertNode({
          userId,
          label: aiOS.utils?.compactText ? aiOS.utils.compactText(content, 120) : content.slice(0, 120),
          type: 'concept',
          summary: content,
          source: 'remember-command',
          importance: 0.62,
          confidence: 0.72,
          metadata: { workspaceId }
        });
      }
      updateGraphFromEntitySafe(userId, {
        id: result.memory.id,
        label: content,
        type: 'memory',
        confidence: 0.72,
        importance: 0.72,
        relationship: 'derived_from'
      }, content, 'remember-command', services);
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
    const repositories = getStorageRepositoriesSafe();
    const result = isRelationalStorageActive() && repositories?.memories
      ? await repositories.memories.softDeleteMemory(userId, memoryId)
      : await aiOS.unifiedMemory.deleteMemory(userId, memoryId, services);
    await safeSendMessage(
      chatId,
      result.ok ? `Memory dihapus: ${memoryId}` : `Gagal menghapus memory: ${result.reason}`,
      replyOpt
    );
    return true;
  }

  if (cmd === '/goals') {
    const repositories = getStorageRepositoriesSafe();
    let goals = [];
    if (isRelationalStorageActive() && repositories?.goals) {
      goals = await repositories.goals.listGoals(userId, { limit: 20 });
    } else {
      await aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services);
      goals = aiOS.goalManager.listGoals(userId, {}, services);
    }
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
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const repositories = getStorageRepositoriesSafe();
    const goal = isRelationalStorageActive() && repositories?.goals
      ? await repositories.goals.createGoal({ userId, title, description, priority, targetDate, metadata: { workspaceId } })
      : null;
    const result = goal
      ? { ok: true, goal }
      : aiOS.goalManager.createGoal(userId, { title, description, priority, targetDate, workspaceId, metadata: { workspaceId } }, services);
    if (result.ok) {
      if (isRelationalStorageActive() && repositories?.graph) {
        await repositories.graph.upsertNode({
          userId,
          label: result.goal.title,
          type: 'goal',
          summary: result.goal.description,
          source: 'goal-command',
          importance: result.goal.priority === 'high' ? 0.82 : 0.68,
          confidence: 0.78,
          metadata: { workspaceId }
        });
      }
      updateGraphFromEntitySafe(userId, {
        id: result.goal.id,
        label: result.goal.title,
        type: 'goal',
        confidence: 0.78,
        importance: result.goal.priority === 'high' ? 0.82 : 0.68,
        relationship: 'linked_to_goal'
      }, `Goal ${result.goal.title}. ${result.goal.description}`, 'goal-command', services);
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
    const repositories = getStorageRepositoriesSafe();
    let result;
    if (isRelationalStorageActive() && repositories?.goals) {
      const normalizedField = field === 'target' ? 'targetDate' : field;
      const goal = await repositories.goals.updateGoal(userId, goalId, { [normalizedField]: value });
      result = goal ? { ok: true, goal } : { ok: false, reason: 'GOAL_NOT_FOUND' };
    } else {
      await aiOS.goalManager.hydrateGoalsFromStorage?.(userId, services);
      result = aiOS.goalManager.updateGoal(userId, goalId, field, value, services);
    }
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
    const repositories = getStorageRepositoriesSafe();
    let workflows = [];
    if (isRelationalStorageActive() && repositories?.workflows) {
      workflows = await repositories.workflows.listWorkflows(userId, { status: 'active', limit: 20 });
      workflows = await enrichWorkflowsWithSteps(userId, workflows, repositories);
    } else {
      await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
      workflows = aiOS.workflowEngine.listActiveWorkflows(userId, services, 20);
    }
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
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    const repositories = getStorageRepositoriesSafe();
    const workflow = isRelationalStorageActive() && repositories?.workflows
      ? await repositories.workflows.createWorkflow({ userId, title, description, goalId, metadata: { workspaceId } })
      : null;
    const result = workflow
      ? { ok: true, workflow: { ...workflow, steps: [] } }
      : aiOS.workflowEngine.createWorkflow(userId, { title, description, goalId, workspaceId, metadata: { workspaceId } }, services);
    if (result.ok) {
      if (isRelationalStorageActive() && repositories?.graph) {
        await repositories.graph.upsertNode({
          userId,
          label: result.workflow.title,
          type: 'workflow',
          summary: result.workflow.description,
          source: 'workflow-command',
          importance: 0.7,
          confidence: 0.76,
          metadata: { workspaceId }
        });
      }
      updateGraphFromEntitySafe(userId, {
        id: result.workflow.id,
        label: result.workflow.title,
        type: 'workflow',
        confidence: 0.76,
        importance: 0.7,
        relationship: 'linked_to_workflow'
      }, `Workflow ${result.workflow.title}. ${result.workflow.description}`, 'workflow-command', services);
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
    const repositories = getStorageRepositoriesSafe();
    const workspaceId = await getDefaultWorkspaceIdForUser(userId);
    let result;
    if (isRelationalStorageActive() && repositories?.workflows) {
      const createdStep = await repositories.workflows.addWorkflowStep({ userId, workflowId, title: step, metadata: { workspaceId } });
      result = createdStep ? { ok: true, stepNumber: createdStep.stepNumber || createdStep.step_number } : { ok: false, reason: 'WORKFLOW_NOT_FOUND' };
    } else {
      await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
      result = aiOS.workflowEngine.addStep(userId, workflowId, { title: step, workspaceId, metadata: { workspaceId } }, services);
    }
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
    const repositories = getStorageRepositoriesSafe();
    let result;
    if (isRelationalStorageActive() && repositories?.workflows) {
      const completed = await repositories.workflows.completeWorkflowStep(userId, workflowId, stepNumber);
      result = completed ? { ok: true, step: { ...completed, text: completed.title } } : { ok: false, reason: 'STEP_NOT_FOUND' };
    } else {
      await aiOS.workflowEngine.hydrateWorkflowsFromStorage?.(userId, services);
      result = aiOS.workflowEngine.markStepDone(userId, workflowId, stepNumber, services);
    }
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
    const query = String(args || '').trim();
    const text = query
      ? aiOS.graphSummarizer.summarizeConcept(userId, query, {}, services).summaryText
      : aiOS.graphSummarizer.summarizeGraph(userId, {}, services).summaryText;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/concepts') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const nodes = aiOS.knowledgeGraph.listNodes(userId, { limit: 12 }, services);
    const text = [
      'Konsep terpenting:',
      '',
      ...(nodes.length
        ? nodes.map((node, index) => `${index + 1}. ${node.label} (${node.type}, muncul ${node.occurrenceCount || 1}x, confidence ${Number(node.confidence || 0).toFixed(2)})`)
        : ['Belum ada konsep. Isi dengan /remember, /goaladd, /workflowadd, atau /relate.'])
    ].join('\n');
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/relate') {
    const [from, to, relationship = 'related_to', evidence = 'Relasi ditambahkan manual oleh user.'] = splitPipeArgs(args);
    if (!from || !to) {
      await safeSendMessage(chatId, 'Format: /relate <konsep A> | <konsep B> | <relationship> | <evidence optional>', replyOpt);
      return true;
    }
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const result = aiOS.knowledgeGraph.linkConcepts(userId, from, to, relationship || 'related_to', evidence, services);
    const text = result.ok
      ? [
        'Relasi graph disimpan:',
        '',
        `${result.from.label} ${result.edge.relationship} ${result.to.label}`,
        `Confidence: ${Number(result.edge.confidence || 0).toFixed(2)}`,
        `Occurrence: ${result.edge.occurrenceCount || 1}`
      ].join('\n')
      : `Gagal menyimpan relasi graph: ${result.reason}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/graphsearch') {
    const query = String(args || '').trim();
    if (!query) {
      await safeSendMessage(chatId, 'Format: /graphsearch <query>', replyOpt);
      return true;
    }
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const snapshot = aiOS.graphRetriever.getRelevantGraph(userId, query, { nodeLimit: 8, edgeLimit: 12 }, services);
    const text = [
      `Hasil graph search: ${query}`,
      '',
      formatGraphCommandSnapshot(snapshot)
    ].join('\n');
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/graphrisks') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    await sendChunkedMessage(chatId, aiOS.graphSummarizer.summarizeRisks(userId, {}, services).summaryText, replyOpt);
    return true;
  }

  if (cmd === '/graphdeps') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    await sendChunkedMessage(chatId, aiOS.graphSummarizer.summarizeDependencies(userId, {}, services).summaryText, replyOpt);
    return true;
  }

  if (cmd === '/graphprune') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const result = aiOS.knowledgeGraph.cleanupStaleGraph(userId, services, 150);
    const limited = aiOS.knowledgeGraph.pruneGraph(userId, services);
    const text =
`Graph prune selesai
Removed stale nodes: ${result.removedNodes}
Removed stale edges: ${result.removedEdges}
Current nodes: ${limited.nodes}
Current edges: ${limited.edges}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/graphstats') {
    await aiOS.knowledgeGraph.hydrateGraphFromStorage?.(userId, services);
    const stats = aiOS.knowledgeGraph.getGraphStats(userId, services);
    const topTypes = Object.entries(stats.nodeTypes || {}).map(([type, count]) => `${type}:${count}`).join(', ') || '-';
    const topRels = Object.entries(stats.relationships || {}).map(([rel, count]) => `${rel}:${count}`).join(', ') || '-';
    const text =
`Graph Stats
Nodes: ${stats.nodes}
Edges: ${stats.edges}
Top node types: ${topTypes}
Top relationships: ${topRels}
Low confidence edges: ${stats.lowConfidenceEdges}
Stale nodes: ${stats.staleNodes}

Top nodes:
${stats.topNodes?.length ? stats.topNodes.map((node, index) => `${index + 1}. ${node.label} (${node.type})`).join('\n') : '-'}`;
    await sendChunkedMessage(chatId, text, replyOpt);
    return true;
  }

  if (cmd === '/insights') {
    const repositories = getStorageRepositoriesSafe();
    const insights = isRelationalStorageActive() && repositories?.insights
      ? await repositories.insights.listInsights(userId, { limit: 10 })
      : await aiOS.insightStore.listInsights(userId, { limit: 10 }, services);
    const text = insights.length
      ? insights.map(formatInsightLine).join('\n')
      : 'Belum ada insight AI OS.';
    await sendChunkedMessage(chatId, `Insight penting:\n${text}`, replyOpt);
    return true;
  }

  if (cmd === '/whoami') {
    await sendChunkedMessage(chatId, await buildWhoAmIText(userId), replyOpt);
    return true;
  }

  if (cmd === '/workspaces') {
    await sendChunkedMessage(chatId, await buildWorkspacesText(userId), replyOpt);
    return true;
  }

  if (cmd === '/workspace') {
    await sendChunkedMessage(chatId, await buildWorkspaceText(userId), replyOpt);
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

function detectAdaptiveModeForMessage(userId, userText, command, msg, conversationState = null) {
  const u = ensureUser(userId);
  return adaptiveSystem.route({
    text: userText,
    command,
    user: u,
    aiOSStatus: getAiosStatusSafe(userId),
    hasAttachment: Boolean(msg?.photo || msg?.document || msg?.voice),
    conversationState
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
  return /(goal|tujuan|workflow|alur kerja|memory|memori|ingat|project|proyek|roadmap|strategi|lanjut|langkah berikut|next action|keputusan|insight|graph|workspace|hubungan|relasi|konsep|dependency|ketergantungan|bertentangan)/i.test(text);
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
    'Jika user jelas mengganti topik, ikuti topik baru dan jangan paksa konteks lama.',
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
    if (cmd === '/insight' && String(args || '').trim()) {
      updateGraphFromEntitySafe(userId, {
        label: args,
        type: 'insight',
        confidence: 0.72,
        importance: 0.68,
        relationship: 'derived_from'
      }, `${args}\n${response}`, 'insight-command', getAiosServices());
    }
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
/dashboard - info dashboard/API
/dashboardstatus - status dashboard tanpa token
/dbstatus - status PostgreSQL/storage
/redisstatus - status Redis/cache
/audit [recent] - ringkasan audit dashboard [admin]
/selfheal - status Self-Healing / Regression Guard
/healthcheck - run semua guard read-only
/regressioncheck - run P0/critical regression guard
/dashboardcheck - run dashboard route guard
/repairplans - daftar repair plan
/repairplan id - detail repair plan
/repairprompt id - generate Codex repair prompt [admin]
/propose_repair id - buat executor proposal, tidak auto-run [admin]
/monitor - live monitoring snapshot
/livehealth - alias monitoring health
/autoheal - daftar safe auto-heal action
/autoheal_runs - riwayat auto-heal
/autoheal_run actionId - jalankan L1 aman/proposal untuk L2
/cicd - status CI/CD dan GitHub Actions
/cicd_status - alias status CI/CD
/github_actions - status GitHub Actions read-only
/propose_workflow workflowId - proposal workflow dispatch [admin]
/propose_deploy - proposal deploy Render [admin]
/prodhealth - production health check read-only [admin]
/incidents - daftar production incidents [admin]
/incident incidentId - detail incident production/ops [admin]
/analyze_incident incidentId - root cause hypothesis [admin]
/incident_timeline incidentId - timeline incident [admin]
/responseplan incidentId - buat response plan tanpa aksi langsung [admin]
/propose_incident_repair incidentId - proposal repair, tidak auto-run [admin]
/propose_incident_rollback incidentId - proposal rollback, tidak auto-run [admin]
/close_incident incidentId - tutup incident [admin]
/portfolio - ringkasan multi-project portfolio [admin]
/projects - daftar project/goal aktif [admin]
/projecthealth [goalId] - health score project [admin]
/nextproject - project yang paling perlu dilanjutkan [admin]
/portfolio_next - next action portfolio aman [admin]
/weeklyplan - rencana portfolio minggu ini [admin]
/monthlyplan - rencana portfolio bulanan [admin]
/staleprojects - project stale/blocked [admin]
/projectrisks - review risiko portfolio [admin]
/portfolioreport - report portfolio mingguan [admin]
/portfolio_proposal - proposal executor dari next action, tidak auto-run [admin]
/research - ringkasan Research / Docs Agent [admin]
/research_task topik - buat task riset evidence-grounded [admin]
/research_sources taskId - cek source dan credibility [admin]
/research_report taskId - research brief berbasis evidence [admin]
/evidence taskId - ringkasan evidence pack [admin]
/docs_agent - docs gap report [admin]
/docs_gaps - alias docs gap report [admin]
/docs_draft topik - buat draft dokumentasi tanpa file write [admin]
/docs_plan topik - buat docs update plan tanpa file write [admin]
/propose_docs_update topik - buat proposal/prompt update docs, tidak auto-run [admin]
/source_check taskId - audit source credibility [admin]
/lifeos - ringkasan Life OS [admin]
/daily atau /today - buat rencana hari ini [admin]
/weekly - buat rencana minggu ini [admin]
/tasks [judul] - list/tambah personal task [admin]
/taskdone taskId - tandai task selesai [admin]
/habits [judul] - list/tambah habit [admin]
/habitcheck habitId - check-in habit [admin]
/reminders [judul] - list/tambah reminder plan [admin]
/focus [judul] - buat focus session [admin]
/mood teks - catat mood privat [admin]
/energy teks - catat energi privat [admin]
/lifegoals [judul] - list/tambah personal goal [admin]
/lifereport - laporan Life OS [admin]
/eveningreview - review malam [admin]
/whoami - identitas user dan role workspace
/workspace - workspace aktif dan permission
/workspaces - daftar workspace yang bisa diakses
/belajar - catatan belajar arsitektur bot
/stats - statistik
/system - status agent production [admin]
/improve - laporan self-improvement [admin]
/adaptive status|on|off|reset - adaptive mode otomatis
/think masalah - thinking partner
/learnplan topik - roadmap belajar
/mentalmodel konsep - mental model
/decision pilihan/masalah - decision support
/compare A vs B - bandingkan opsi
/risk pertanyaan - review risiko keputusan
/confidence pertanyaan - jelaskan confidence keputusan
/decisions - riwayat keputusan
/decisionstatus id | accepted/rejected/deferred - update status keputusan
/decisionhistory - riwayat keputusan
/delegate topic - buat agent task delegation
/delegations - daftar delegation session
/delegation id - detail delegation
/rundelegation id - jalankan delegation
/agenttasks - daftar agent task
/agenttask id - detail agent task
/runtask id - jalankan reasoning task agent
/handoffs - daftar handoff agent
/handoff taskId | agentId - buat handoff manual
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
/incidents - daftar production incident [admin]
/incident incidentId - detail production/ops incident [admin]
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
/plans - daftar long-term plan
/plan planId - detail plan dan progress
/planadd judul | deskripsi | horizon
/plantasks planId - daftar task plan
/taskadd planId | task title | deskripsi
/taskdone taskId
/taskblock taskId | reason
/next - next action planner
/priorities - prioritas task planner
/executions - daftar proposal eksekusi
/pending - approval eksekusi yang menunggu
/propose taskId - buat proposal dari task planner
/propose_action aksi - buat action plan + proposal dari natural action
/actionplans - daftar action plan agent
/actionplan actionPlanId - detail action plan
/propose_decision decisionId - proposal dari decision
/propose_delegation delegationId - proposal dari delegation
/propose_task taskId - proposal dari agent task
/proposalstatus proposalId - status proposal
/evalagents - run evaluation suite dry-run
/evalagent caseId - run satu evaluation case
/evalsummary - summary evaluation terbaru
/evalgates - status quality gates evaluation
/evalcompare - bandingkan dua evaluation run terakhir
/connector_status connectorId
/connector_quality connectorId
/github_status
/github_issues
/calendar_status
/calendar_events
/gmail_status
/nas_status
/webhook_preview payload
/propose_github_issue text
/propose_calendar_event text
/propose_gmail_draft text
/propose_webhook text
/integration_pipeline pipelineId
/integration_eval pipelineId
/approve proposalId - approve tanpa menjalankan
/runexec proposalId - jalankan proposal yang sudah approved
/reject proposalId | reason
/cancel_exec proposalId
/bots - daftar bot Telegram aman
/botstatus - status multi-bot
/botinfo botId - detail bot tanpa token
/botmapping - mapping agent ke bot tanpa token
/multibot - status visible multi-bot replies
/multibot_on - aktifkan specialist bot terpilih [admin grup]
/multibot_off - nonaktifkan specialist replies [admin grup]
/visibleagents - policy visible replies
/agents - daftar agent/persona
/agent agentId - detail agent
/agentstatus - status agent registry
/agentprofile agentId - personality profile agent
/agentmemory agentId - memory khusus agent
/agentremember agentId | text - simpan memory agent
/agentforget agentId | memoryId - archive memory agent
/agentprefs agentId - preferences agent
/sharedmemory - shared memory antar agent
/agentlearn agentId | note - learning note agent
/agentstyle agentId - style guide agent
/router - status natural smart router
/quiet - mode grup orchestrator-only
/smart - mode grup natural smart
/council topic - override council agent
/debate topic - override planner vs critic
/proscons topic - review pro/kontra ringkas
/councilstatus - status session council
/councilrecent - session council terbaru
/allagents topic - semua agent singkat [admin]
/askagents topic - test smart router
/riskreview topic - critic + security review
/tools - daftar tool registry
/tool toolId - metadata tool
/toolpreview toolId | input
/toolrun toolId | input
/toolpropose toolId | input
/toolenable toolId [admin]
/tooldisable toolId [admin]
/backup - bantuan/status backup
/backupcreate - buat backup workspace aman
/backups - daftar backup terbaru
/backupstatus - status backup/recovery
/recovery - disaster recovery check
/integrity - integrity check ringan
/exportsummary - export summary aman
/pwa - info install dashboard PWA
/backupdownload - instruksi download backup
/importhelp - panduan import/restore aman
/backupschedule - bantuan scheduler backup
/backupscheduleadd nama | scope | frequency
/backupschedules - daftar schedule backup
/backupdue - due/pending scheduled backup
/backupapprove runId
/backuprun runId
/graph [konsep] - knowledge graph / relasi konsep
/concepts - konsep terpenting
/relate konsep A | konsep B | relationship | evidence
/graphsearch query - cari graph
/graphrisks - relasi risiko
/graphdeps - dependency utama
/graphprune - bersihkan graph stale
/graphstats - statistik graph
/insights - insight penting
/workspace - workspace aktif + cognitive workspace
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

async function handleTelegramControlCommands(chatId, userId, resolvedCmd, args, msg) {
  try {
    if (!resolvedCmd) return false;
    const cmdName = resolvedCmd.replace(/^\//, '');
    const cmd = telegramControl.commandRegistry.getTelegramCommand(cmdName);
    if (!cmd) return false;

    const user = { id: userId };
    const chat = { id: chatId };
    const perm = telegramControl.permissionGuard.checkTelegramCommandPermission(cmd, user, chat);
    if (!perm.allowed) {
      await safeSendMessage(chatId, telegramControl.permissionGuard.buildPermissionDeniedResponse(perm.reason), { reply_to_message_id: msg?.message_id });
      return true;
    }

    const risk = telegramControl.riskClassifier.classifyTelegramCommandRisk(cmd);
    
    telegramControl.commandAudit.recordTelegramCommandAudit({
      command: cmd.name, userId, chatId, module: cmd.module,
      riskLevel: cmd.riskLevel, allowed: true, resultStatus: 'routed'
    });

    if (risk.requiresApproval || risk.requiresEvaluation) {
      const actionPlan = telegramControl.naturalRouter.buildNaturalActionPlan({
        intent: 'slash_command',
        commandName: cmd.name,
        risk,
        command: cmd,
        chatId,
        userId
      });
      if (actionPlan) {
        const propResult = telegramControl.proposalRouter.routeTelegramActionToProposal(actionPlan);
        if (propResult.created) {
          await safeSendMessage(chatId, telegramControl.proposalRouter.formatProposalForTelegram(propResult.proposal), { reply_to_message_id: msg?.message_id });
          return true;
        }
        if (propResult.duplicate) {
          await safeSendMessage(chatId, propResult.message + '\n\n' + telegramControl.proposalRouter.formatProposalForTelegram(propResult.proposal), { reply_to_message_id: msg?.message_id });
          return true;
        }
      }
      await safeSendMessage(chatId, '\u26a0\ufe0f Tidak dapat membuat proposal untuk perintah ini.', { reply_to_message_id: msg?.message_id });
      return true;
    }

    const moduleMap = {
      core: () => safeSendMessage(chatId, `Perintah /${cmdName} diterima. Gunakan /menu untuk menu utama.`, { reply_to_message_id: msg?.message_id }),
      help: () => safeSendMessage(chatId, telegramControl.helpMenu.buildTelegramCommandHelp(cmdName), { reply_to_message_id: msg?.message_id }),
      menu: () => safeSendMessage(chatId, telegramControl.helpMenu.buildTelegramMainMenu(), { reply_to_message_id: msg?.message_id })
    };

    const handler = moduleMap[cmdName] || moduleMap[cmd.module];
    if (handler) {
      await handler();
    } else {
      const msg_text = `Perintah /${cmdName} diterima. Modul: ${cmd.module}, Risiko: ${cmd.riskLevel}`;
      await safeSendMessage(chatId, msg_text, { reply_to_message_id: msg?.message_id });
    }
    return true;
  } catch (err) {
    console.error('[telegram-control] Command handler error:', err.message);
    await safeSendMessage(chatId, '\u26a0\ufe0f Terjadi kesalahan saat memproses perintah.', { reply_to_message_id: msg?.message_id });
    return true;
  }
}

async function handleNaturalTelegramControlRoute(chatId, userId, text, msg) {
  try {
    if (!text || text.startsWith('/')) return { handled: false };
    const fakeUpdate = { message: { text, from: { id: userId }, chat: { id: chatId }, message_id: msg?.message_id } };
    const route = telegramControl.naturalRouter.routeTelegramNaturalMessage(fakeUpdate, {});
    if (!route.handled) return { handled: false };
    if (route.blocked) {
      await safeSendMessage(chatId, route.response || '\u26a0\ufe0f Pesan mengandung pola rahasia.', { reply_to_message_id: msg?.message_id });
      return { handled: true };
    }
    if (route.response) {
      await safeSendMessage(chatId, route.response, { reply_to_message_id: msg?.message_id });
      return { handled: true };
    }
    if (route.command) {
      const cmd = route.command;
      const user = { id: userId };
      const chat = { id: chatId };
      const perm = telegramControl.permissionGuard.checkTelegramCommandPermission(cmd, user, chat);
      if (!perm.allowed) {
        await safeSendMessage(chatId, telegramControl.permissionGuard.buildPermissionDeniedResponse(perm.reason), { reply_to_message_id: msg?.message_id });
        return { handled: true };
      }
      const risk = route.risk || telegramControl.riskClassifier.classifyTelegramCommandRisk(cmd);
      if (risk.requiresApproval || risk.requiresEvaluation) {
        const actionPlan = telegramControl.naturalRouter.buildNaturalActionPlan(route);
        if (actionPlan) {
          const propResult = telegramControl.proposalRouter.routeTelegramActionToProposal(actionPlan);
          if (propResult.created) {
            await safeSendMessage(chatId, telegramControl.proposalRouter.formatProposalForTelegram(propResult.proposal), { reply_to_message_id: msg?.message_id });
            return { handled: true };
          }
        }
      }
      const msg_text = `Perintah /${cmd.name} diterima. Risiko: ${cmd.riskLevel}`;
      await safeSendMessage(chatId, msg_text, { reply_to_message_id: msg?.message_id });
      return { handled: true };
    }
    return { handled: false };
  } catch (err) {
    console.error('[telegram-control] Natural route error:', err.message);
    return { handled: false };
  }
}

function isUnknownCommand(cmd) {
  const known = new Set([
    '/start',
    '/ping',
    '/reset',
    '/help',
    '/menu',
    '/actions',
    '/dashboard',
    '/dashboardstatus',
    '/dbstatus',
    '/redisstatus',
    '/audit',
    '/devgov',
    '/handoff',
    '/handoff_update',
    '/archmap',
    '/contractcheck',
    '/collisioncheck',
    '/dashboardroutes',
    '/nextcodex',
    '/nextopencode',
    '/p0prompt',
    '/selfheal',
    '/healthcheck',
    '/regressioncheck',
    '/dashboardcheck',
    '/repairplans',
    '/repairplan',
    '/repairprompt',
    '/propose_repair',
    '/monitor',
    '/livehealth',
    '/autoheal',
    '/autoheal_runs',
    '/autoheal_run',
    '/cicd',
    '/cicd_status',
    '/github_actions',
    '/propose_workflow',
    '/propose_deploy',
    '/prodhealth',
    '/analyze_incident',
    '/incident_timeline',
    '/responseplan',
    '/propose_incident_repair',
    '/propose_incident_rollback',
    '/close_incident',
    '/portfolio',
    '/projects',
    '/projecthealth',
    '/nextproject',
    '/portfolio_next',
    '/weeklyplan',
    '/monthlyplan',
    '/staleprojects',
    '/projectrisks',
    '/portfolioreport',
    '/portfolio_proposal',
    '/research',
    '/research_task',
    '/research_sources',
    '/research_report',
    '/evidence',
    '/docs_agent',
    '/docs_gaps',
    '/docs_draft',
    '/docs_plan',
    '/propose_docs_update',
    '/source_check',
    '/lifeos',
    '/daily',
    '/weekly',
    '/today',
    '/tasks',
    '/taskdone',
    '/habits',
    '/habitcheck',
    '/reminders',
    '/focus',
    '/mood',
    '/energy',
    '/lifegoals',
    '/lifereport',
    '/eveningreview',
    '/whoami',
    '/workspaces',
    '/belajar',
    '/stats',
    '/system',
    '/improve',
    '/adaptive',
    '/think',
    '/learnplan',
    '/mentalmodel',
    '/decision',
    '/compare',
    '/risk',
    '/confidence',
    '/decisions',
    '/decisionstatus',
    '/decisionhistory',
    '/delegate',
    '/delegations',
    '/delegation',
    '/rundelegation',
    '/agenttasks',
    '/agenttask',
    '/runtask',
    '/handoffs',
    '/handoff',
    '/taskresult',
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
    '/plans',
    '/plan',
    '/planadd',
    '/plantasks',
    '/taskadd',
    '/taskdone',
    '/taskblock',
    '/next',
    '/priorities',
    '/executions',
    '/pending',
    '/propose',
    '/propose_action',
    '/actionplans',
    '/actionplan',
    '/propose_decision',
    '/propose_delegation',
    '/propose_task',
    '/proposalstatus',
    '/evalagents',
    '/evalagent',
    '/evalsummary',
    '/evalgates',
    '/evalcompare',
    '/connector_status',
    '/connector_quality',
    '/github_status',
    '/github_issues',
    '/calendar_status',
    '/calendar_events',
    '/gmail_status',
    '/nas_status',
    '/webhook_preview',
    '/propose_github_issue',
    '/propose_calendar_event',
    '/propose_gmail_draft',
    '/propose_webhook',
    '/integration_pipeline',
    '/integration_eval',
    '/approve',
    '/reject',
    '/runexec',
    '/cancel_exec',
    '/bots',
    '/botstatus',
    '/botinfo',
    '/botmapping',
    '/multibot',
    '/multibot_on',
    '/multibot_off',
    '/visibleagents',
    '/agents',
    '/agent',
    '/agentstatus',
    '/agentprofile',
    '/agentmemory',
    '/agentremember',
    '/agentforget',
    '/agentprefs',
    '/sharedmemory',
    '/agentlearn',
    '/agentstyle',
    '/router',
    '/routermode',
    '/quiet',
    '/smart',
    '/council',
    '/debate',
    '/proscons',
    '/councilstatus',
    '/councilrecent',
    '/allagents',
    '/askagents',
    '/riskreview',
    '/tools',
    '/tool',
    '/toolpreview',
    '/toolrun',
    '/toolpropose',
    '/toolenable',
    '/tooldisable',
    '/backup',
    '/backupcreate',
    '/backups',
    '/backupstatus',
    '/recovery',
    '/integrity',
    '/exportsummary',
    '/pwa',
    '/backupdownload',
    '/importhelp',
    '/backupschedule',
    '/backupscheduleadd',
    '/backupschedules',
    '/backupdue',
    '/backupapprove',
    '/backuprun',
    '/graph',
    '/concepts',
    '/relate',
    '/graphsearch',
    '/graphrisks',
    '/graphdeps',
    '/graphprune',
    '/graphstats',
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
        { reply_to_message_id: msg.message_id, fileRelated: true, userText: query }
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

function buildInternetCapabilityAnswer() {
  return [
    'Bot bisa online lewat tool/API yang dipanggil oleh server bot.',
    '',
    'Cara kerjanya:',
    '- Model AI tidak browsing langsung.',
    '- Untuk cuaca, bot memanggil OpenWeather lewat OPENWEATHER_API_KEY.',
    '- Untuk search/berita terbaru, bot memanggil Tavily lewat TAVILY_API_KEY.',
    '- Hasil tool itu lalu dirapikan dan dikirim ke Telegram.',
    '',
    'Agar aktif di Render:',
    '1. Set OPENWEATHER_API_KEY untuk cuaca real-time.',
    '2. Set TAVILY_API_KEY untuk pencarian internet.',
    '3. Redeploy service.',
    '4. Test dengan "Cuaca di Tokyo" dan "Cari berita AI terbaru".',
    '',
    `Status sekarang: OpenWeather ${OPENWEATHER_API_KEY ? 'set' : 'missing'}, Tavily ${TAVILY_API_KEY ? 'set' : 'missing'}.`
  ].join('\n');
}

function buildDashboardNaturalAnswer() {
  return [
    'Dashboard bisa dicek dari command dan endpoint berikut:',
    '',
    buildDashboardInfoText(),
    '',
    'Untuk cek cepat:',
    '- Telegram: /dashboard',
    '- Telegram: /dbstatus',
    '- Telegram: /redisstatus',
    '- Browser: /api/dashboard/health',
    '- Data protected: pakai Authorization Bearer token.'
  ].join('\n');
}

async function handleNaturalToolRoute(chatId, userId, userText, msg) {
  const detection = naturalToolRouter.detectNaturalToolIntent(userText);
  logMessageFlow('natural_tool_detected', {
    userId,
    chatId,
    intent: detection.intent,
    confidence: detection.confidence,
    reason: detection.reason,
    text: userText
  });

  if (detection.intent !== 'NONE') {
    try {
      opsSystem.telemetry.recordToolUsage('natural_tool_router', {
        tool: 'natural_tool_router',
        success: true,
        meta: { intent: detection.intent }
      }, getOpsServices());
    } catch (_) {}
  }

  try {
    switch (detection.intent) {
      case 'WEATHER': {
        if (!detection.city) {
          await safeSendMessage(chatId, 'Contoh: Cuaca di Tokyo', { reply_to_message_id: msg.message_id });
          return { handled: true, answer: 'Contoh: Cuaca di Tokyo', intent: detection.intent };
        }
        if (!OPENWEATHER_API_KEY) {
          const answer = 'Fitur cuaca real-time belum aktif karena OPENWEATHER_API_KEY belum diset di environment.';
          await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
          return { handled: true, answer, intent: detection.intent };
        }
        try {
          const answer = await getWeather(detection.city);
          await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
          try {
            opsSystem.telemetry.recordToolUsage('weather_tool', {
              tool: 'weather_tool',
              success: true,
              meta: { city: detection.city }
            }, getOpsServices());
          } catch (_) {}
          return { handled: true, answer, intent: detection.intent };
        } catch (err) {
          try {
            opsSystem.telemetry.recordToolUsage('weather_tool', {
              tool: 'weather_tool',
              success: false,
              error: err.message,
              meta: { city: detection.city }
            }, getOpsServices());
          } catch (_) {}
          throw err;
        }
      }

      case 'WEB_SEARCH': {
        if (!detection.query) {
          await safeSendMessage(chatId, 'Apa yang ingin dicari?', { reply_to_message_id: msg.message_id });
          return { handled: true, answer: 'Apa yang ingin dicari?', intent: detection.intent };
        }
        if (!TAVILY_API_KEY) {
          const answer = 'Fitur pencarian internet belum aktif karena TAVILY_API_KEY belum diset.';
          await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
          return { handled: true, answer, intent: detection.intent };
        }
        try {
          const answer = await summarizeSearchWithRefs(detection.query, userId, getSystemPrompt(userId));
          await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
          try {
            opsSystem.telemetry.recordToolUsage('search_tool', {
              tool: 'search_tool',
              success: true,
              meta: { queryLen: detection.query.length }
            }, getOpsServices());
          } catch (_) {}
          return { handled: true, answer, intent: detection.intent };
        } catch (err) {
          try {
            opsSystem.telemetry.recordToolUsage('search_tool', {
              tool: 'search_tool',
              success: false,
              error: err.message
            }, getOpsServices());
          } catch (_) {}
          throw err;
        }
      }

      case 'INTERNET_CAPABILITY_EXPLANATION': {
        const answer = buildInternetCapabilityAnswer();
        await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'DASHBOARD_HELP': {
        const answer = buildDashboardNaturalAnswer();
        await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'CALCULATE': {
        const answer = calculate(detection.expression || userText);
        await safeSendMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'UNIT_CONVERSION': {
        const answer = detection.conversion?.answer || 'Saya belum bisa mengonversi satuan itu.';
        await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'TIME': {
        const answer = getCurrentTime(detection.location || 'jakarta');
        await safeSendMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'DATE': {
        const answer = getCurrentDate();
        await safeSendMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      case 'LOCATION': {
        if (!detection.query) {
          await safeSendMessage(chatId, 'Sebutkan tempatnya.', { reply_to_message_id: msg.message_id });
          return { handled: true, answer: 'Sebutkan tempatnya.', intent: detection.intent };
        }
        const answer = await searchLocation(detection.query);
        await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        return { handled: true, answer, intent: detection.intent };
      }

      default:
        return { handled: false, intent: detection.intent, reason: detection.reason };
    }
  } catch (err) {
    log.warn('Natural tool route fallback:', {
      intent: detection.intent,
      error: err.message
    });
    const answer = 'Maaf, tool yang dibutuhkan sedang gagal dipakai. Coba ulangi sebentar lagi.';
    await sendChunkedMessage(chatId, answer, { reply_to_message_id: msg.message_id });
    return { handled: true, answer, intent: `${detection.intent}_ERROR` };
  }
}
// =====================================================
// WEBHOOK
// =====================================================

app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.status(200).json({
  ok: true,
  service: 'telegram-ai-bot',
  runtime: 'legacy-adapter'
}));
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
      aiOS: ['/aios', '/goals', '/goaladd', '/workflows', '/workflowadd', '/graph', '/concepts', '/relate', '/graphsearch', '/graphstats', '/insights', '/workspace'],
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

let selfHealingSystem = null;
let evaluationSystem = null;
try {
  const { createSelfHealingSystem } = require('../selfhealing');
  selfHealingSystem = createSelfHealingSystem(storageManager, {
    evaluationSystem: evaluationSystem || null,
    executorSystem: executorSystem || null,
    codingClassifier: ''
  });
  selfHealingSystem.initialize().catch(e => log.error('Self-healing init:', e.message));
} catch (e) {
  log.warn('Self-healing system skipped:', e.message);
}

let autoHealingSystem = null;
let monitoringSystem = null;
let cicdSystem = null;
try {
  const { createAutoHealingSystem } = require('../autohealing');
  const { createMonitoringSystem } = require('../monitoring');
  const { createCicdSystem } = require('../cicd');
  cicdSystem = createCicdSystem(storageManager, {
    evaluationSystem: evaluationSystem || null,
    executorSystem: executorSystem || null
  });
  monitoringSystem = createMonitoringSystem(null, {
    env: config,
    selfHealingSystem: selfHealingSystem || null,
    cicdSystem: cicdSystem || null,
    evaluationSystem: evaluationSystem || null
  });
  autoHealingSystem = createAutoHealingSystem(storageManager, {
    evaluationSystem: evaluationSystem || null,
    executorSystem: executorSystem || null,
    selfHealingSystem: selfHealingSystem || null
  });
  autoHealingSystem.initialize().catch(e => log.error('Auto-healing init:', e.message));
} catch (e) {
  log.warn('Phase 33 systems skipped:', e.message);
}

let routineRegistry = null;
let routineRunner = null;
let routineScheduler = null;
try {
  const routines = require('../routines');
  routineRegistry = routines.createRoutineRegistry({ storageManager, auditLog: dashboard.auditLog, env: config, logger: log });
  routineRunner = routines.createRoutineRunner({ storageManager, registry: routineRegistry, aiOS, env: config, logger: log });
  routineScheduler = routines.createRoutineScheduler({ storageManager, runner: routineRunner, env: config, logger: log });
} catch (e) {
  log.warn('Routine system skipped:', e.message);
}

try {
  dashboard.registerDashboardRoutes(app, {
    env: config,
    storageManager,
    aiOS,
    opsSystem,
    integrationsSystem,
    getOpsServices,
    getCalendarClient,
    ensureUser,
    getUsersSnapshot,
    selfHealingSystem,
    evaluationSystem: evaluationSystem || null,
    executorSystem: executorSystem || null,
    monitoringSystem: monitoringSystem || null,
    observabilitySystem,
    portfolioSystem,
    researchSystem,
    lifeosSystem,
    operatorSystem: null,
    costSystem: opsSystem.costOptimizer || null,
    cicdSystem: cicdSystem || null,
    autoHealingSystem: autoHealingSystem || null,
    logger: log
  });
} catch (e) {
  log.warn('[dashboard] Dashboard route registration skipped:', e.message);
}

try {
  const { registerRoutineDashboardRoutes } = require('../dashboard/routine-routes');
  registerRoutineDashboardRoutes(app, {
    storageManager,
    aiOS,
    env: config,
    routineRegistry,
    routineRunner,
    routineScheduler,
    logger: log
  });
} catch (e) {
  log.warn('Routine dashboard routes skipped:', e.message);
}

async function handleMultiBotUpdate(update = {}) {
  if (isDuplicateIncomingUpdate(update)) return { ok: true, duplicate: true };
  const runtimeResult = await telegramControl.runtimeDispatcher.dispatchTelegramUpdate(
    update,
    update.__botId || update.message?.__botId || update.callback_query?.__botId || 'default',
    getTelegramRuntimeServices(update.callback_query?.from?.id || update.message?.from?.id || '', {
      webhookRoute: 'multibot'
    })
  );
  if (runtimeResult?.handled && !runtimeResult?.passThrough) {
    return { ok: true, type: runtimeResult.type || 'telegram_runtime', runtimeResult };
  }
  if (update.callback_query) {
    const cb = update.callback_query;
    try {
      await interactions.callbackRouter.handleCallbackQuery(getInteractionServices(), cb);
      await multibotSystem.telegramClient.answerCallbackQueryAsBot(cb.__botId || update.__botId || 'default', cb.id, {}, getAgentServices(cb.from?.id));
    } catch (_) {}
    return { ok: true, type: 'callback_query' };
  }

  const msg = update.message;
  if (!msg || msg.from?.is_bot) return { ok: true, ignored: true };
  const chatId = msg.chat.id;
  const userId = normalizeId(msg.from.id);
  const text = String(msg.text || msg.caption || runtimeResult?.normalized?.text || '').trim();
  if (!text) return { ok: true, ignored: true };

  const cmd = getCommandBase(text);
  const args = getCommandArgs(text);
  if (cmd) {
    if (cmd === '/ping') {
      await handlePing(chatId, msg);
      return { ok: true, type: 'command' };
    }
    if (cmd === '/help') {
      await handleHelp(chatId, msg);
      return { ok: true, type: 'command' };
    }
    if (await handleAgentCommands(chatId, userId, resolveAlias(userId, cmd), args, msg)) {
      return { ok: true, type: 'agent_command' };
    }
    await safeSendMessage(chatId, 'Command multi-bot diterima. Untuk command legacy lengkap, pakai bot utama/default.', { reply_to_message_id: msg.message_id });
    return { ok: true, type: 'command_fallback' };
  }

  const routed = await handleNaturalAgentRoute(chatId, userId, text, msg);
  if (!routed?.handled) {
    await safeSendMessage(chatId, 'Pesan diterima. Bisa jelaskan sedikit lagi konteks atau tujuan yang ingin kamu capai?', { reply_to_message_id: msg.message_id });
  }
  return { ok: true, type: 'message' };
}

multibotSystem.webhookManager.registerMultiBotWebhookRoutes(app, {
  env: config,
  logger: log,
  auditLog: dashboard.auditLog,
  handleTelegramUpdate: handleMultiBotUpdate
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

    const runtimeResult = await telegramControl.runtimeDispatcher.dispatchTelegramUpdate(
      update,
      update.__botId || 'default',
      getTelegramRuntimeServices(update.callback_query?.from?.id || update.message?.from?.id || update.edited_message?.from?.id || '', {
        webhookRoute: WEBHOOK_PATH || '/webhook'
      })
    );
    if (runtimeResult?.handled && !runtimeResult?.passThrough) {
      return res.sendStatus(200);
    }
    const runtimeNormalized = runtimeResult?.normalized || null;

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

    const incomingMessage = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!incomingMessage) return res.sendStatus(200);
    if (incomingMessage.from?.is_bot) return res.sendStatus(200);

const msg = incomingMessage;
const chatId = msg.chat.id;
const userId = normalizeId(msg.from?.id || msg.sender_chat?.id || chatId);

await withUserActionLock(userId, async () => {
  const text = String(msg.text || runtimeNormalized?.text || '').trim();
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

  if (msg.voice && !text) {
    const transcribed = await transcribeVoice(msg.voice.file_id);
    if (transcribed) {
      text = transcribed;
      msg.text = transcribed;
    } else {
      await safeSendMessage(chatId, 'Maaf, saya belum bisa transkrip voice ini.');
      return;
    }
  }

  if (!text && !msg.photo && !msg.document) {
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

  if (resolvedCmd === '/voice') {
    const newVal = args === 'on' ? true : args === 'off' ? false : !u.voiceReplyEnabled;
    u.voiceReplyEnabled = newVal;
    await persist();
    await safeSendMessage(chatId, `🔊 Balasan suara: ${newVal ? 'ON ✅' : 'OFF ❌'}\n${newVal ? 'Jawaban pendek akan dikirim sebagai voice note.' : 'Balasan teks biasa.'}`, { reply_to_message_id: msg.message_id });
    return;
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
  if (await handleSelfHealingCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleObservabilityCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleResearchCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleLifeOsCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handlePortfolioCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handlePhase33OpsCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleOpsCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleAiosCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (await handleAgentCommands(chatId, userId, resolvedCmd, args, msg)) return;
  if (resolvedCmd === '/feedback') { await handleFeedback(chatId, msg); return; }
  if (resolvedCmd === '/image') { await handleImage(chatId, args, msg); return; }
  if (resolvedCmd === '/tanggal') { await safeSendMessage(chatId, getCurrentDate(), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/jam') { await safeSendMessage(chatId, getCurrentTime(args || 'jakarta'), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/hitung') { await safeSendMessage(chatId, args ? calculate(args) : 'Contoh: /hitung 25*4', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/cuaca') { await safeSendMessage(chatId, args ? await getWeather(args) : 'Contoh: /cuaca Bandung', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/lokasi') { await safeSendMessage(chatId, args ? await searchLocation(args) : 'Contoh: /lokasi Monas', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/cari') { await sendChunkedMessage(chatId, args ? await summarizeSearchWithRefs(args, userId, getSystemPrompt(userId)) : 'Contoh: /cari sejarah Jakarta', { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/dashboard') { await sendChunkedMessage(chatId, buildDashboardInfoText(), { reply_to_message_id: msg.message_id }); return; }
  if (resolvedCmd === '/dashboardstatus') {
    const status = getDashboardStatusText();
    const storageStatus = storageManager.getStorageStatus?.() || {};
    const text =
`Dashboard Status
DASHBOARD_ENABLED: ${status.enabled ? 'true' : 'false'}
Dashboard auth token: ${status.tokenSet ? 'set' : 'missing'}
Dashboard split tokens: write=${DASHBOARD_WRITE_TOKEN ? 'set' : 'missing'}, danger=${DASHBOARD_DANGER_TOKEN ? 'set' : 'missing'}
Protected endpoints: ${status.protectedStatus}
Static UI: ${status.staticAssets}

${formatDashboardStorageStatus(storageStatus)}

Health public: /api/dashboard/health
Storage public summary: /api/dashboard/health
Storage protected detail: /api/dashboard/storage
Data endpoint membutuhkan Authorization Bearer token.`;
    await sendChunkedMessage(chatId, text, { reply_to_message_id: msg.message_id });
    return;
  }
  if (resolvedCmd === '/dbstatus') {
    if (storageManager.refreshStorageHealth) {
      await storageManager.refreshStorageHealth({ force: true }).catch(() => null);
    }
    await sendChunkedMessage(chatId, formatDbStatus(storageManager.getStorageStatus?.() || {}), { reply_to_message_id: msg.message_id });
    return;
  }
  if (resolvedCmd === '/redisstatus') {
    if (storageManager.refreshStorageHealth) {
      await storageManager.refreshStorageHealth({ force: true }).catch(() => null);
    }
    await sendChunkedMessage(chatId, formatRedisStatus(storageManager.getStorageStatus?.() || {}), { reply_to_message_id: msg.message_id });
    return;
  }
  if (resolvedCmd === '/devgov' || resolvedCmd === '/handoff' || resolvedCmd === '/handoff_update' ||
      resolvedCmd === '/archmap' || resolvedCmd === '/contractcheck' || resolvedCmd === '/collisioncheck' ||
      resolvedCmd === '/dashboardroutes' || resolvedCmd === '/nextcodex' || resolvedCmd === '/nextopencode' ||
      resolvedCmd === '/p0prompt') {
    const devGovTelegram = require('../../src/devgovernance/devgovernance-telegram');
    const dgResult = await devGovTelegram.handleDevGovCommand(resolvedCmd, args, chatId, { storageManager });
    if (dgResult) {
      await sendChunkedMessage(chatId, dgResult.text, { reply_to_message_id: msg.message_id });
      return;
    }
  }

  if (resolvedCmd === '/audit') {
    if (!isAdmin(userId)) {
      await safeSendMessage(chatId, 'Command audit hanya untuk admin.', { reply_to_message_id: msg.message_id });
      return;
    }
    const services = { storageManager };
    if (safeLower(args).trim() === 'recent') {
      const entries = await dashboard.auditLog.listAuditLogs({ limit: 5 }, services);
      const text = entries.length
        ? entries.map(entry => `${entry.createdAt} | ${entry.action} | ${entry.targetType}:${entry.targetId || '-'} | ${entry.status}`).join('\n')
        : 'Belum ada audit log.';
      await sendChunkedMessage(chatId, `Audit recent:\n${text}`, { reply_to_message_id: msg.message_id });
      return;
    }
    const summary = await dashboard.auditLog.getAuditSummary({ limit: 5 }, services);
    const text = [
      'Audit Summary',
      '',
      `Total: ${summary.total || 0}`,
      `Status: ${Object.entries(summary.byStatus || {}).map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`,
      `Top actions: ${Object.entries(summary.byAction || {}).slice(0, 5).map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`,
      '',
      'Gunakan /audit recent untuk 5 entry terakhir.'
    ].join('\n');
    await sendChunkedMessage(chatId, text, { reply_to_message_id: msg.message_id });
    return;
  }

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

  if (await handleTelegramControlCommands(chatId, userId, resolvedCmd, args, msg)) return;

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

  const observabilityNaturalResult = await handleNaturalObservabilityRoute(chatId, userId, userText, msg);
  if (observabilityNaturalResult?.handled) {
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: observabilityNaturalResult.answer,
      intent: `natural_observability:${observabilityNaturalResult.type}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: observabilityNaturalResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, observabilityNaturalResult.answer);
    return;
  }

  const lifeOsNaturalResult = await handleNaturalLifeOsRoute(chatId, userId, userText, msg);
  if (lifeOsNaturalResult?.handled) {
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: lifeOsNaturalResult.answer,
      intent: `natural_lifeos:${lifeOsNaturalResult.type}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: lifeOsNaturalResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, lifeOsNaturalResult.answer);
    return;
  }

  const researchNaturalResult = await handleNaturalResearchRoute(chatId, userId, userText, msg);
  if (researchNaturalResult?.handled) {
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: researchNaturalResult.answer,
      intent: `natural_research:${researchNaturalResult.type}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: researchNaturalResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, researchNaturalResult.answer);
    return;
  }

  const portfolioNaturalResult = await handleNaturalPortfolioRoute(chatId, userId, userText, msg);
  if (portfolioNaturalResult?.handled) {
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: portfolioNaturalResult.answer,
      intent: `natural_portfolio:${portfolioNaturalResult.type}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: portfolioNaturalResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, portfolioNaturalResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }

  const preToolAgentResult = await handleNaturalAgentRoute(chatId, userId, userText, msg);
  if (preToolAgentResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_smart_agents',
      processed: true,
      answerPreview: preToolAgentResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: preToolAgentResult.answer,
      intent: `natural_agents:${preToolAgentResult.route?.policy?.mode || 'natural_smart'}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: preToolAgentResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, preToolAgentResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }

  const naturalToolResult = await handleNaturalToolRoute(chatId, userId, userText, msg);
  if (naturalToolResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_tool_route',
      processed: true,
      answerPreview: naturalToolResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: naturalToolResult.answer,
      intent: `natural_tool:${naturalToolResult.intent}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: naturalToolResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, naturalToolResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }

  const telegramControlNaturalResult = await handleNaturalTelegramControlRoute(chatId, userId, userText, msg);
  if (telegramControlNaturalResult?.handled) {
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

  const adaptiveDecision = detectAdaptiveModeForMessage(userId, userText, resolvedCmd, msg, conversationState);
  await hydrateAIOSForMessageSafe(userId, userText, adaptiveDecision);
  const naturalExecutorResult = await executorSystem.executionPlanner.answerWithExecutorContext(userId, chatId, userText, msg, {
    ...getExecutorServices(userId),
    adaptiveDecision,
    safeSendMessage,
    sendChunkedMessage
  });
  if (naturalExecutorResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_executor',
      processed: true,
      answerPreview: naturalExecutorResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: naturalExecutorResult.answer,
      intent: `natural_executor:${naturalExecutorResult.type || adaptiveDecision?.mode || 'executor'}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: naturalExecutorResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, naturalExecutorResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }
  const naturalPlannerResult = await plannerSystem.plannerEngine.answerWithPlannerContext(userId, chatId, userText, msg, {
    ...getPlannerServices(userId),
    adaptiveDecision,
    safeSendMessage,
    sendChunkedMessage
  });
  if (naturalPlannerResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_planner',
      processed: true,
      answerPreview: naturalPlannerResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: naturalPlannerResult.answer,
      intent: `natural_planner:${naturalPlannerResult.type || adaptiveDecision?.mode || 'planner'}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: naturalPlannerResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, naturalPlannerResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }
  const graphNaturalResult = await aiOS.graphNaturalIntegration.answerWithGraphContext(userId, chatId, userText, msg, {
    ...getAiosServices(),
    adaptiveDecision,
    log,
    safeSendMessage,
    sendChunkedMessage
  });
  if (graphNaturalResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_graph',
      processed: true,
      answerPreview: graphNaturalResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: graphNaturalResult.answer,
      intent: `natural_graph:${graphNaturalResult.type || adaptiveDecision?.mode || 'context'}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: graphNaturalResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, graphNaturalResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }
  const naturalAIOSResult = await aiOS.naturalIntegration.answerWithAIOSContext(userId, chatId, userText, msg, {
    ...getAiosServices(),
    adaptiveDecision,
    getOpsServices,
    log,
    opsSystem,
    safeSendMessage,
    sendChunkedMessage
  });
  if (naturalAIOSResult?.handled) {
    logMessageFlow('ai_pipeline_result', {
      userId,
      chatId,
      pipeline: 'natural_aios',
      processed: true,
      answerPreview: naturalAIOSResult.answer
    });
    recordConversationReplySafe({
      userId,
      chatId,
      userText,
      botText: naturalAIOSResult.answer,
      intent: `natural_aios:${naturalAIOSResult.type || adaptiveDecision?.mode || 'context'}`
    });
    pushChatHistory({
      userId,
      chatId,
      role: 'assistant',
      text: naturalAIOSResult.answer,
      timestamp: nowMs()
    });
    await saveConversationPair(userId, userText, naturalAIOSResult.answer);
    if (u.digest?.enabled) scheduleDigestJob(userId);
    return;
  }
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
    const simpleAnswer = await processAIMessage(chatId, userId, userText, msg, conversationState);
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
    shortMemory,
    transcribeAudio: (buffer, attachment) => voiceService.transcribeAudio(buffer, attachment, GACOR_API_KEY || process.env.GACOR_API_KEY, GACOR_BASE_URL || process.env.GACOR_BASE_URL)
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
  const fallbackAnswer = await processAIMessage(chatId, userId, userText, msg, conversationState);
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

function buildConversationExtraContext(conversationState = null) {
  if (!conversationState) return '';
  return [
    'Konteks percakapan aktif:',
    conversationState.promptContext || '-',
    '',
    conversationState.instruction ? `Instruksi conversation layer:\n${conversationState.instruction}` : '',
    'Aturan: jawab natural seperti ChatGPT, jangan mengulang jawaban sebelumnya, dan ikuti topik baru jika user sudah berpindah konteks.'
  ].filter(Boolean).join('\n');
}

async function smartReply(userId, text, systemPrompt, extraContext = '') {
  const contextPrompt = await generateContextualPrompt(userId, text, extraContext);

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

async function processAIMessage(chatId, userId, text, msg, conversationState = null) {
  const systemPrompt = getSystemPrompt(userId);
  const conversationExtraContext = buildConversationExtraContext(conversationState);

  let answer;

  try {
    logMessageFlow('legacy_ai_start', {
      userId,
      chatId,
      text
    });
    answer = await smartReply(userId, text, systemPrompt, conversationExtraContext);

    if (shouldRejectGenericGreeting(answer, text)) {
      logMessageFlow('legacy_ai_generic_greeting_retry', {
        userId,
        chatId,
        answerPreview: answer,
        text
      });
      answer = await askAI(
        `${systemPrompt}\n\nJawab langsung isi pesan user. Jangan gunakan greeting pembuka generik kecuali user hanya menyapa.`,
        [conversationExtraContext, `Pesan user asli:\n${text}`].filter(Boolean).join('\n\n'),
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

  // ── Voice reply ──
  const u = ensureUser(userId);
  if (u.voiceReplyEnabled && answer.length <= 300) {
    try {
      const audioBuf = await voiceService.textToSpeechBuffer(answer, { voice: 'id-ID-ArdiNeural' });
      await voiceService.sendVoiceBuffer(chatId, audioBuf, { reply_to_message_id: msg.message_id }, TELEGRAM_API);
      pushChatHistory({ userId, chatId, role: 'assistant', text: `[voice] ${answer}`, timestamp: nowMs() });
      return answer;
    } catch (ttsErr) {
      log.warn('Voice reply failed, fallback to text:', ttsErr.message);
    }
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
      reply_to_message_id: msg.message_id,
      fileRelated: true,
      userText: text
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

async function startLegacyBotServer() {
  await initRedis();
  interactions.configure({ redisClient });
  await initStorage();
  await loadAllMemories();
  await loadPlugins();
  await restoreAllReminders();
  await restoreAllDigests();

  const webhookUrl = WEBHOOK_BASE_URL && TELEGRAM_TOKEN
    ? `${WEBHOOK_BASE_URL}/webhook/${TELEGRAM_TOKEN}`
    : null;
  const safeWebhookUrl = WEBHOOK_BASE_URL && TELEGRAM_TOKEN
    ? `${WEBHOOK_BASE_URL}/webhook/[redacted]`
    : null;

  server = app.listen(PORT, '0.0.0.0', async () => {
    if (monitoringSystem && typeof monitoringSystem.attachWebSocket === 'function') {
      monitoringSystem.attachWebSocket(server);
    }
    console.log(`🚀 Server berjalan di port ${PORT}`);

    if (safeWebhookUrl) {
      console.log(`🔗 Webhook URL: ${safeWebhookUrl}`);
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
  return {
    app,
    server,
    config,
    shutdown,
    telegramPost,
    safeSendMessage,
    sendChunkedMessage,
    sendStreamingAnswer
  };
}

function createLegacyBotApp() {
  return {
    app,
    config,
    shutdown,
    telegramPost,
    safeSendMessage,
    sendChunkedMessage,
    sendStreamingAnswer
  };
}

module.exports = {
  createLegacyBotApp,
  startLegacyBotServer,
  shutdown
};

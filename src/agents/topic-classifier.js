'use strict';

const { normalizeId, unique } = require('./agent-utils');

const TOPIC_KEYWORDS = {
  coding: ['kode', 'coding', 'bug', 'error', 'stack trace', 'function', 'node.js', 'javascript', 'api', 'backend', 'frontend', 'refactor'],
  debugging: ['error', 'gagal', 'crash', 'bug', 'fix', 'debug', 'kenapa tidak jalan', 'deploy error'],
  planning: ['rencana', 'prioritas', 'langkah', 'roadmap', 'task', 'milestone', 'phase', 'tahap', 'lanjut'],
  roadmap: ['roadmap', 'phase', 'tahap', 'jangka panjang', 'strategi'],
  research: ['riset', 'cari', 'search', 'latest', 'terbaru', 'sumber', 'api gratis'],
  documentation: ['dokumentasi', 'docs', 'documentation', 'readme', 'env docs', 'troubleshooting guide', 'phase summary', 'update readme'],
  search: ['cari', 'search', 'google', 'berita', 'latest', 'terbaru'],
  security: ['aman', 'security', 'permission', 'admin', 'approval', 'izin', 'hak akses'],
  secret: ['token', 'secret', 'api key', 'password', 'database_url', 'redis_url', 'authorization', 'bearer'],
  ops: ['ops', 'health', 'sehat', 'status', 'latency', 'reliability', 'monitor'],
  deploy: ['deploy', 'render', 'server', 'webhook', 'environment', 'env', 'production'],
  database: ['postgres', 'postgresql', 'database', 'sql', 'schema', 'migration'],
  redis: ['redis', 'cache'],
  backup: ['backup', 'cadangan', 'export', 'download backup'],
  restore: ['restore', 'pulihkan', 'rollback backup', 'backup lama'],
  import: ['import', 'overwrite', 'restore json'],
  export: ['export', 'download', 'keluarkan data'],
  github: ['github', 'issue github', 'pull request', 'pr github', 'repo', 'repository'],
  calendar: ['calendar', 'kalender', 'jadwal', 'jadwalkan', 'event calendar', 'google calendar'],
  gmail: ['gmail', 'email', 'draft email', 'buat draft', 'kirim email'],
  webhook_external: ['webhook external', 'kirim webhook', 'payload webhook', 'external webhook'],
  cloudflare: ['cloudflare', 'tunnel', 'cloudflare tunnel', 'dns cloudflare'],
  integration: ['integrasi eksternal', 'external integration', 'connector', 'konektor'],
  executor: ['jalankan', 'eksekusi', 'approve', 'run', 'action', 'proposal', 'kerjakan keputusan', 'terapkan keputusan', 'kerjakan delegasi'],
  tool: ['tool', 'plugin', 'registry'],
  memory: ['memory', 'memori', 'ingat', 'konteks'],
  graph: ['graph', 'relasi', 'hubungan', 'konsep', 'dependency'],
  dashboard: ['dashboard', 'pwa', 'mobile', 'browser'],
  nas: ['nas', 'storage rumah', 'server rumah'],
  telegram: ['telegram', 'botfather', 'grup', 'bot'],
  personal_reflection: ['bingung', 'refleksi', 'konsisten', 'belajar dari nol', 'mulai dari mana'],
  emotional: ['sedih', 'capek', 'lelah', 'pusing', 'cemas', 'takut', 'stres', 'stress', 'kecewa'],
  emotional_support: ['panik', 'khawatir', 'takut dimarahin', 'butuh saran', 'menenangkan', 'tenangin'],
  social_advice: ['menghadapi', 'minta maaf', 'dimarahin', 'dimarahi', 'marah besar', 'konflik', 'berantem', 'bertengkar', 'orang tua marah', 'teman marah'],
  school_life: ['guru', 'sekolah', 'kelas', 'telat sekolah', 'terlambat sekolah', 'dimarahin guru', 'dimarahi guru', 'pak guru', 'bu guru', 'wali kelas', 'pelajaran', 'tugas sekolah'],
  daily_life: ['pagi ini', 'telat', 'terlambat', 'bangun kesiangan', 'hari ini aku', 'aku tadi'],
  finance: ['uang', 'biaya', 'bayar', 'profit', 'harga', 'investasi'],
  learning: ['belajar', 'materi', 'roadmap belajar', 'dari nol', 'tutorial']
};

const TECHNICAL_KEYWORDS = [
  'code', 'kode', 'coding', 'error', 'bug', 'deploy', 'python', 'javascript', 'node',
  'node.js', 'server', 'database', 'render', 'github', 'terminal', 'stack trace',
  'api', 'postgres', 'postgresql', 'redis', 'webhook', 'npm', 'log', 'backend',
  'frontend', 'function', 'crash', 'debug'
];

const PERSONAL_DOMAIN_TOPICS = [
  'emotional',
  'emotional_support',
  'personal_reflection',
  'social_advice',
  'school_life',
  'daily_life'
];

const TECHNICAL_TOPICS = [
  'coding',
  'debugging',
  'ops',
  'deploy',
  'database',
  'redis',
  'dashboard',
  'telegram',
  'tool',
  'executor',
  'github',
  'calendar',
  'gmail',
  'webhook_external',
  'cloudflare',
  'integration'
];

const SHORT_FOLLOWUP_PATTERNS = [
  /^\s*solusinya apa\??\s*$/i,
  /^\s*terus gimana\??\s*$/i,
  /^\s*terus bagaimana\??\s*$/i,
  /^\s*apa yang harus (saya|aku) lakukan\??\s*$/i,
  /^\s*lanjutannya\??\s*$/i,
  /^\s*maksudnya\??\s*$/i,
  /^\s*jadi gimana\??\s*$/i
];

function includesTopicKeyword(text = '', keywords = []) {
  const raw = String(text || '').toLowerCase();
  return (keywords || []).some(keyword => {
    const needle = String(keyword || '').toLowerCase().trim();
    if (!needle) return false;
    if (/^[a-z0-9+#.-]{1,4}$/i.test(needle)) {
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9+#.-])${escaped}($|[^a-z0-9+#.-])`, 'i').test(raw);
    }
    return raw.includes(needle);
  });
}

function isExplicitTechnicalMessage(text = '') {
  return includesTopicKeyword(String(text || ''), TECHNICAL_KEYWORDS);
}

function hasPersonalDomainTopic(topics = []) {
  return (topics || []).some(topic => PERSONAL_DOMAIN_TOPICS.includes(topic));
}

function hasTechnicalTopic(topics = []) {
  return (topics || []).some(topic => TECHNICAL_TOPICS.includes(topic));
}

function hasProjectPlanningSignal(text = '', topics = []) {
  return (topics.includes('planning') || topics.includes('roadmap')) &&
    /\b(phase|tahap|roadmap|project|proyek|bot|fitur|dashboard|agent|workflow|planner|prioritas|minggu ini)\b/i.test(String(text || ''));
}

function isPersonalDomainMessage(text = '', topics = []) {
  return hasPersonalDomainTopic(topics) && !isExplicitTechnicalMessage(text) && !hasProjectPlanningSignal(text, topics);
}

function isShortFollowup(text = '') {
  return SHORT_FOLLOWUP_PATTERNS.some(pattern => pattern.test(String(text || '').trim()));
}

function resolveFollowupTopics(text = '', context = {}) {
  if (!isShortFollowup(text)) return [];
  const candidates = [
    context.repliedTopics,
    context.previousTopics,
    context.latestTopics,
    context.lastUserTopics
  ].find(items => Array.isArray(items) && items.length);
  if (!candidates) return [];
  return unique(candidates.filter(Boolean));
}

function classifyMessageTopic(message, context = {}, services = {}) {
  const text = String(message?.text || message || '');
  const followupTopics = resolveFollowupTopics(text, context);
  const topics = [...followupTopics];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (includesTopicKeyword(text, keywords)) topics.push(topic);
  }
  if (/^\s*(halo|hai|hi|hello|pagi|siang|malam)\s*$/i.test(text)) topics.push('casual');
  let normalized = unique(topics);
  const personalDomain = isPersonalDomainMessage(text, normalized);
  if (personalDomain) {
    normalized = normalized.filter(topic => !TECHNICAL_TOPICS.includes(topic));
    if (!normalized.includes('personal_reflection') && !normalized.includes('emotional_support')) {
      normalized.push('personal_reflection');
    }
  }
  if (!normalized.length) normalized.push('unknown');
  return unique(normalized);
}

function detectMentionedAgents(message, services = {}) {
  const text = String(message?.text || message || '').toLowerCase();
  const aliases = {
    orchestrator: ['orchestrator', 'moderator'],
    planner: ['planner', 'perencana'],
    coder: ['coder', 'developer', 'engineer'],
    critic: ['critic', 'kritik', 'reviewer'],
    research: ['research', 'riset'],
    ops: ['ops', 'devops'],
    security: ['security', 'keamanan'],
    memory: ['memory', 'memori'],
    executor: ['executor', 'eksekutor'],
    reflection: ['reflection', 'refleksi']
  };
  const mentioned = [];
  for (const [agentId, names] of Object.entries(aliases)) {
    if (names.some(name => text.includes(`@${name}`) || text.includes(`${name} agent`) || text.includes(`agent ${name}`))) {
      mentioned.push(agentId);
    }
  }
  return unique(mentioned.map(normalizeId));
}

function detectCommandMode(message) {
  const text = String(message?.text || message || '').trim();
  if (/^\/council\b/i.test(text)) return 'council';
  if (/^\/debate\b/i.test(text)) return 'debate';
  if (/^\/allagents\b/i.test(text)) return 'allagents';
  if (/^\/riskreview\b/i.test(text)) return 'risk_review';
  if (/^\/askagents\b/i.test(text)) return 'natural_smart';
  if (/^\/quiet\b/i.test(text)) return 'quiet';
  if (/^\/smart\b/i.test(text)) return 'natural_smart';
  if (/^\//.test(text)) return 'command';
  return 'natural_smart';
}

function detectLanguage(message) {
  const text = String(message?.text || message || '');
  if (/\b(the|and|what|how|why)\b/i.test(text)) return 'en';
  return 'id';
}

function extractIntentSignals(message) {
  const text = String(message?.text || message || '').toLowerCase();
  const topics = classifyMessageTopic(text);
  const personalDomain = isPersonalDomainMessage(text, topics);
  return {
    asksForAction: !personalDomain && /\b(jalankan|eksekusi|run|approve|backup sekarang|restore|import)\b/i.test(text),
    asksForPlan: !personalDomain && /\b(rencana|roadmap|prioritas|langkah|phase|tahap)\b/i.test(text),
    asksForSearch: /\b(cari|search|terbaru|latest|api gratis)\b/i.test(text),
    emotional: /\b(sedih|capek|lelah|cemas|stres|pusing|takut|panik)\b/i.test(text) || personalDomain,
    greetingOnly: /^\s*(halo|hai|hi|hello|pagi|siang|malam)\s*$/i.test(text)
  };
}

module.exports = {
  TOPIC_KEYWORDS,
  classifyMessageTopic,
  detectCommandMode,
  detectLanguage,
  detectMentionedAgents,
  extractIntentSignals,
  hasPersonalDomainTopic,
  hasProjectPlanningSignal,
  hasTechnicalTopic,
  isExplicitTechnicalMessage,
  isPersonalDomainMessage,
  isShortFollowup,
  resolveFollowupTopics
};

'use strict';

const { normalizeId, textIncludesAny, unique } = require('./agent-utils');

const TOPIC_KEYWORDS = {
  coding: ['kode', 'coding', 'bug', 'error', 'stack trace', 'function', 'node.js', 'javascript', 'api', 'backend', 'frontend', 'refactor'],
  debugging: ['error', 'gagal', 'crash', 'bug', 'fix', 'debug', 'kenapa tidak jalan', 'deploy error'],
  planning: ['rencana', 'prioritas', 'langkah', 'roadmap', 'task', 'milestone', 'phase', 'tahap', 'lanjut'],
  roadmap: ['roadmap', 'phase', 'tahap', 'jangka panjang', 'strategi'],
  research: ['riset', 'cari', 'search', 'latest', 'terbaru', 'sumber', 'api gratis'],
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
  executor: ['jalankan', 'eksekusi', 'approve', 'run', 'action', 'proposal'],
  tool: ['tool', 'plugin', 'registry'],
  memory: ['memory', 'memori', 'ingat', 'konteks'],
  graph: ['graph', 'relasi', 'hubungan', 'konsep', 'dependency'],
  dashboard: ['dashboard', 'pwa', 'mobile', 'browser'],
  nas: ['nas', 'storage rumah', 'server rumah'],
  telegram: ['telegram', 'botfather', 'grup', 'bot'],
  personal_reflection: ['bingung', 'refleksi', 'konsisten', 'belajar dari nol', 'mulai dari mana'],
  emotional: ['sedih', 'capek', 'lelah', 'pusing', 'cemas', 'takut', 'stres', 'stress', 'kecewa'],
  finance: ['uang', 'biaya', 'bayar', 'profit', 'harga', 'investasi'],
  learning: ['belajar', 'materi', 'roadmap belajar', 'dari nol', 'tutorial']
};

function classifyMessageTopic(message, context = {}, services = {}) {
  const text = String(message?.text || message || '');
  const topics = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (textIncludesAny(text, keywords)) topics.push(topic);
  }
  if (/^\s*(halo|hai|hi|hello|pagi|siang|malam)\s*$/i.test(text)) topics.push('casual');
  if (!topics.length) topics.push('unknown');
  return unique(topics);
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
  return {
    asksForAction: /\b(jalankan|eksekusi|run|approve|backup sekarang|restore|import)\b/i.test(text),
    asksForPlan: /\b(rencana|roadmap|prioritas|langkah|phase|tahap)\b/i.test(text),
    asksForSearch: /\b(cari|search|terbaru|latest|api gratis)\b/i.test(text),
    emotional: /\b(sedih|capek|lelah|cemas|stres|pusing)\b/i.test(text),
    greetingOnly: /^\s*(halo|hai|hi|hello|pagi|siang|malam)\s*$/i.test(text)
  };
}

module.exports = {
  TOPIC_KEYWORDS,
  classifyMessageTopic,
  detectCommandMode,
  detectLanguage,
  detectMentionedAgents,
  extractIntentSignals
};

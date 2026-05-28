'use strict';

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(text = '', max = 1800) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function compactText(text = '', max = 220) {
  const clean = sanitizeText(text, Math.max(max, 40));
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function confidenceLabel(score = 0.5) {
  const n = clamp(score, 0, 1, 0.5);
  if (n >= 0.76) return 'tinggi';
  if (n >= 0.56) return 'sedang';
  return 'rendah';
}

function bullet(items = [], fallback = '- belum cukup data') {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  return list.length ? list.map(item => `- ${item}`).join('\n') : fallback;
}

function section(title, body) {
  const cleanBody = Array.isArray(body) ? bullet(body) : String(body || '-');
  return `${title}\n${cleanBody}`;
}

function splitSentences(text = '', limit = 8) {
  return sanitizeText(text, 2200)
    .split(/[.!?\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function hasAny(text = '', patterns = []) {
  const lower = sanitizeText(text, 2400).toLowerCase();
  return patterns.some(pattern => {
    if (pattern instanceof RegExp) return pattern.test(lower);
    return lower.includes(String(pattern).toLowerCase());
  });
}

function getContextFacts(context = {}) {
  const facts = [];
  if (context.activeGoals?.length) facts.push(`Ada ${context.activeGoals.length} goal aktif yang bisa jadi arah.`);
  if (context.activeWorkflows?.length) facts.push(`Ada ${context.activeWorkflows.length} workflow aktif untuk kontinuitas.`);
  if (context.relevantMemory?.length) facts.push(`Ada ${context.relevantMemory.length} memory relevan.`);
  if (context.recentInsights?.length) facts.push(`Ada ${context.recentInsights.length} insight terbaru.`);
  return facts;
}

function commandToType(command = '') {
  const map = {
    '/think': 'thinking',
    '/strategy': 'strategy',
    '/reflect': 'reflection',
    '/learnplan': 'learning',
    '/mentalmodel': 'mental_model',
    '/decision': 'decision',
    '/blindspot': 'blindspot',
    '/assumptions': 'assumptions',
    '/perspectives': 'perspectives',
    '/insight': 'insight',
    '/journal': 'reflection',
    '/collab': 'status'
  };
  return map[command] || 'thinking';
}

function formatConfidence(score = 0.5) {
  return `${confidenceLabel(score)} (${clamp(score, 0, 1, 0.5).toFixed(2)})`;
}

function limitLines(text = '', maxLines = 80) {
  return String(text || '').split('\n').slice(0, maxLines).join('\n').trim();
}

module.exports = {
  bullet,
  clamp,
  commandToType,
  compactText,
  confidenceLabel,
  formatConfidence,
  getContextFacts,
  hasAny,
  limitLines,
  nowIso,
  sanitizeText,
  section,
  splitSentences
};

'use strict';

const STOPWORDS = new Set([
  'aku', 'saya', 'gue', 'gw', 'kamu', 'anda', 'dia', 'itu', 'ini', 'yang',
  'dan', 'atau', 'untuk', 'dengan', 'dari', 'ke', 'di', 'pada', 'tentang',
  'tolong', 'bantu', 'buatkan', 'jelaskan', 'lanjut', 'lanjutkan', 'boleh',
  'apa', 'apakah', 'bagaimana', 'kenapa', 'mengapa', 'kapan', 'dimana',
  'the', 'a', 'an', 'and', 'or', 'to', 'for', 'with', 'from', 'about',
  'please', 'help', 'explain', 'continue', 'yes', 'no'
]);

const ACTION_WORDS = [
  'buat', 'buatkan', 'bikin', 'kode', 'coding', 'debug', 'error', 'analisis',
  'jelaskan', 'ringkas', 'bandingkan', 'rancang', 'desain', 'tulis',
  'create', 'build', 'code', 'debug', 'analyze', 'compare', 'explain',
  'summarize', 'fix', 'review'
];

const QUESTION_WORDS = [
  'apa', 'apakah', 'bagaimana', 'gimana', 'kenapa', 'mengapa', 'siapa',
  'kapan', 'dimana', 'berapa', 'can', 'could', 'what', 'why', 'how',
  'when', 'where', 'which'
];

function safeText(text) {
  return String(text || '').trim();
}

function safeLower(text) {
  return safeText(text).toLowerCase();
}

function compactText(text, max = 500) {
  const clean = safeText(text).replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function safeJsonArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function tokenize(text) {
  return safeLower(text)
    .replace(/[^\p{L}\p{N}\s.#/+_-]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function uniqueTokens(text) {
  return Array.from(new Set(tokenize(text)));
}

function tokenOverlap(a, b) {
  const left = uniqueTokens(a);
  const right = new Set(uniqueTokens(b));
  if (!left.length || !right.size) return 0;
  const matches = left.filter(token => right.has(token)).length;
  return matches / Math.min(left.length, right.size);
}

function includesAny(text, words) {
  const lower = safeLower(text);
  return words.some(word => lower.includes(word));
}

function isQuestion(text) {
  const lower = safeLower(text);
  return lower.includes('?') || QUESTION_WORDS.some(word => new RegExp(`\\b${word}\\b`, 'i').test(lower));
}

function hasActionSignal(text) {
  const lower = safeLower(text);
  return ACTION_WORDS.some(word => new RegExp(`\\b${word}\\b`, 'i').test(lower));
}

function hasCodeSignal(text) {
  const lower = safeLower(text);
  return /```|function\s+\w+|const\s+\w+|let\s+\w+|class\s+\w+|npm\s+|node\s+|next\.?js|react|express|api|database|postgres|redis|login|auth/.test(lower);
}

function extractTopic(text, fallback = 'topik sebelumnya') {
  const clean = compactText(text, 180);
  const quoted = clean.match(/["“']([^"“”']{3,80})["”']/);
  if (quoted) return quoted[1].trim();

  const topicMatch = clean.match(/(?:tentang|soal|info|mengenai|untuk|about)\s+(.{3,90})/i);
  if (topicMatch) {
    return compactText(topicMatch[1].replace(/[?.!]+$/g, ''), 90);
  }

  const tokens = uniqueTokens(clean).slice(0, 6);
  return tokens.length ? tokens.join(' ') : fallback;
}

function isFreshTopicCandidate(text) {
  const clean = safeText(text);
  if (clean.length < 12) return false;
  return isQuestion(clean) || hasActionSignal(clean) || hasCodeSignal(clean);
}

function nowMs() {
  return Date.now();
}

function similarity(a, b) {
  const overlap = tokenOverlap(a, b);
  const left = safeLower(a).slice(0, 300);
  const right = safeLower(b).slice(0, 300);
  if (!left || !right) return 0;
  if (left === right) return 1;
  return overlap;
}

function preventLoopingResponse(nextResponse, state = {}) {
  const last = state.lastBotResponseSummary || state.lastResponse || '';
  return similarity(nextResponse, last) < 0.86;
}

function preventStalePendingAction(action) {
  if (!action) return true;
  return nowMs() <= Number(action.expiresAt || 0) && action.status === 'active';
}

function preventCrossUserContextLeak(state = {}, userId, chatId) {
  return safeText(state.userId) === safeText(userId) && safeText(state.chatId) === safeText(chatId);
}

function preventOverlongContext(text, max = 2200) {
  return compactText(text, max);
}

function preventSensitiveDataPersistence(text) {
  return safeText(text)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[number]');
}

function preventRepeatedFallback(state = {}) {
  const recent = safeJsonArray(state.recentMessages).slice(-4);
  return recent.filter(item => /belum yakin|gagal memahami|klarifikasi/i.test(item.content || item.text || '')).length < 2;
}

function preventUnsafeActionWithoutConfirmation(action) {
  if (!action) return true;
  const sensitive = ['delete_memory', 'confirm_reset', 'clear_memory', 'run_recovery', 'delete_goal'];
  return !sensitive.includes(action.type) || action.requiresConfirmation === true;
}

module.exports = {
  compactText,
  extractTopic,
  hasActionSignal,
  hasCodeSignal,
  includesAny,
  isFreshTopicCandidate,
  isQuestion,
  nowMs,
  preventCrossUserContextLeak,
  preventLoopingResponse,
  preventOverlongContext,
  preventRepeatedFallback,
  preventSensitiveDataPersistence,
  preventStalePendingAction,
  preventUnsafeActionWithoutConfirmation,
  safeLower,
  safeJsonArray,
  safeText,
  similarity,
  tokenOverlap,
  tokenize,
  uniqueTokens
};

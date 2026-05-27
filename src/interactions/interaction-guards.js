'use strict';

const CODE_WORDS = [
  'kode', 'coding', 'debug', 'error', 'bug', 'login', 'auth', 'next.js',
  'nextjs', 'react', 'node', 'express', 'api', 'database', 'jwt', 'session'
];

const LEARNING_WORDS = [
  'belajar', 'pelajari', 'materi', 'roadmap', 'latihan', 'quiz',
  'postgresql', 'backend', 'frontend', 'database'
];

const DECISION_WORDS = [
  'pilih', 'bingung', 'opsi', 'keputusan', 'bandingkan', 'vs',
  'trade-off', 'risiko', 'rekomendasi'
];

const OPS_WORDS = [
  'health', 'diagnostic', 'diagnostics', 'ops', 'error server', 'latency',
  'lambat', 'recovery', 'benchmark', 'regression'
];

const PRODUCT_WORDS = [
  'xiaomi', 'iphone', 'samsung', 'spesifikasi', 'harga', 'flagship',
  'rekomendasi beli'
];

function safeText(text) {
  return String(text || '').trim();
}

function safeLower(text) {
  return safeText(text).toLowerCase();
}

function includesAny(text, words) {
  const lower = safeLower(text);
  return words.some(word => lower.includes(word));
}

function estimateComplexity(text) {
  const clean = safeText(text);
  if (clean.length > 220) return 'high';
  if (clean.length > 70 || clean.includes('?')) return 'medium';
  return 'low';
}

function classifyContext(input = {}) {
  const text = `${input.userText || ''}\n${input.answerText || ''}\n${input.mode || ''}\n${input.intent || ''}`;
  const lower = safeLower(text);

  if (includesAny(lower, OPS_WORDS) || /health-watch|incident|diagnostic|ops/i.test(input.mode || '')) {
    return 'ops';
  }
  if (includesAny(lower, CODE_WORDS) || /coding/i.test(input.mode || '')) {
    return 'coding';
  }
  if (includesAny(lower, DECISION_WORDS) || /decision|strategic/i.test(input.mode || '')) {
    return 'decision';
  }
  if (includesAny(lower, LEARNING_WORDS) || /learning|mentor/i.test(input.mode || '')) {
    return 'learning';
  }
  if (includesAny(lower, PRODUCT_WORDS)) {
    return 'product';
  }
  if (estimateComplexity(text) !== 'low') {
    return 'general';
  }
  return 'none';
}

function isSimpleMessage(input = {}) {
  const userText = safeText(input.userText);
  const answerText = safeText(input.answerText);
  if (userText.length < 24 && answerText.length < 220) return true;
  return false;
}

function shouldOfferOptions(input = {}) {
  if (input.hasAttachment || input.isToolRequest) return false;
  if (isSimpleMessage(input)) return false;
  return classifyContext(input) !== 'none';
}

function compact(text, max = 700) {
  const clean = safeText(text).replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}…`;
}

module.exports = {
  classifyContext,
  compact,
  estimateComplexity,
  includesAny,
  isSimpleMessage,
  safeLower,
  safeText,
  shouldOfferOptions
};

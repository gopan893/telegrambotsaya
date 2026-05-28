'use strict';

const SIMPLE_ACK_WORDS = [
  'terima kasih', 'makasih', 'thanks', 'thank you', 'ok', 'oke',
  'sip', 'mantap', 'baik', 'siap', 'nice', 'keren'
];

const CODE_WORDS = [
  'kode', 'coding', 'debug', 'bug', 'stack trace', 'syntaxerror',
  'typeerror', 'referenceerror', 'next.js', 'nextjs', 'react', 'vue',
  'node.js', 'nodejs', 'express', 'prisma', 'jwt', 'nextauth',
  'supabase auth', 'api route', 'controller', 'middleware', 'function',
  'component', 'repository', 'schema', 'npm', 'package.json'
];

const CODE_REQUEST_PATTERNS = [
  /\bbuat(kan)?\s+(kode|fitur|script|endpoint|api|login|auth)\b/i,
  /\b(error|debug|bug|stack trace)\b/i,
  /\b(refactor|deploy|compile|install package)\b/i
];

const LEARNING_WORDS = [
  'belajar', 'pelajari', 'materi', 'roadmap belajar', 'latihan',
  'quiz', 'konsep', 'dari nol', 'pemula', 'mentor', 'kurikulum',
  'cara memahami'
];

const DECISION_WORDS = [
  'pilih', 'bingung pilih', 'opsi', 'keputusan', 'bandingkan',
  'vs', 'versus', 'trade-off', 'risiko', 'rekomendasi',
  'sebaiknya', 'lebih baik', 'atau'
];

const OPS_WORDS = [
  'health', 'diagnostic', 'diagnostics', 'ops', 'server down',
  'latency', 'lambat', 'recovery', 'benchmark', 'regression',
  'incident', 'render', 'webhook', 'redis error', 'postgres error'
];

const PRODUCT_WORDS = [
  'xiaomi', 'iphone', 'samsung', 'oppo', 'vivo', 'spesifikasi',
  'harga', 'flagship', 'rekomendasi beli', 'kamera hp'
];

const WELLNESS_WORDS = [
  'tidur', 'sleep', 'begadang', 'pusing', 'sakit kepala', 'mual',
  'demam', 'batuk', 'flu', 'lemas', 'capek', 'sakit perut',
  'tidak enak badan', 'kesehatan', 'sehat', 'stres', 'stress',
  'cemas', 'kebiasaan', 'habit', 'produktif', 'produktifitas',
  'produktivitas', 'konsisten', 'olahraga', 'makan', 'istirahat'
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

function matchesAny(text, patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function estimateComplexity(text) {
  const clean = safeText(text);
  if (clean.length > 220) return 'high';
  if (clean.length > 70 || clean.includes('?')) return 'medium';
  return 'low';
}

function isSimpleAck(text) {
  const lower = safeLower(text).replace(/[.!?]+$/g, '');
  return SIMPLE_ACK_WORDS.some(word => lower === word || lower === `${word} ya`);
}

function confidenceFrom(input, type, currentText) {
  const explicitMode = safeLower(input.mode).includes(type);
  const explicitIntent = safeLower(input.intent).includes(type);
  const currentLength = safeText(currentText).length;

  if (explicitMode || explicitIntent) return 0.86;
  if (currentLength > 30) return 0.72;
  return 0.55;
}

function classifyContext(input = {}) {
  const userText = safeText(input.userText);
  const answerText = safeText(input.answerText);
  const mode = safeLower(input.mode);
  const intent = safeLower(input.intent);
  const currentText = `${userText}\n${intent}`;
  const fullText = `${userText}\n${answerText}\n${mode}\n${intent}`;
  const mediumOrHigher = estimateComplexity(userText) !== 'low';

  if (isSimpleAck(userText)) return 'none';

  if (includesAny(currentText, OPS_WORDS) || (/health-watch|incident|diagnostic|ops/.test(mode) && mediumOrHigher)) {
    return 'ops';
  }

  if (
    includesAny(currentText, WELLNESS_WORDS) ||
    /health_advice|emotional_support/.test(intent)
  ) {
    return 'wellness';
  }

  if (
    includesAny(currentText, DECISION_WORDS) ||
    (/decision|strategic/.test(mode) && mediumOrHigher)
  ) {
    return 'decision';
  }

  if (
    includesAny(currentText, LEARNING_WORDS) ||
    (/learning|mentor/.test(mode) && mediumOrHigher)
  ) {
    return 'learning';
  }

  if (
    includesAny(currentText, CODE_WORDS) ||
    matchesAny(currentText, CODE_REQUEST_PATTERNS) ||
    (/coding|debug/.test(mode) && mediumOrHigher && /kode|fitur|error|debug|implement|buat|script|api/i.test(userText))
  ) {
    return 'coding';
  }

  if (includesAny(currentText, PRODUCT_WORDS)) {
    return 'product';
  }

  if (estimateComplexity(fullText) !== 'low') {
    return 'general';
  }

  return 'none';
}

function isSimpleMessage(input = {}) {
  const userText = safeText(input.userText);
  const answerText = safeText(input.answerText);
  if (isSimpleAck(userText)) return true;
  if (userText.length < 24 && answerText.length < 220) return true;
  return false;
}

function shouldOfferOptions(input = {}) {
  if (input.hasAttachment || input.isToolRequest) return false;
  if (isSimpleAck(input.userText)) return false;

  const type = classifyContext(input);
  if (type === 'none') return false;

  const confidence = Number(input.confidence || confidenceFrom(input, type, input.userText));
  if (confidence < 0.52) return false;

  if (type === 'general' && isSimpleMessage(input)) return false;
  return true;
}

function compact(text, max = 700) {
  const clean = safeText(text).replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trim()}...`;
}

module.exports = {
  classifyContext,
  compact,
  estimateComplexity,
  includesAny,
  isSimpleAck,
  isSimpleMessage,
  safeLower,
  safeText,
  shouldOfferOptions
};

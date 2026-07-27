'use strict';

const SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /password\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /bearer\s+[A-Za-z0-9._~+\/-]+/i,
  /ghp_[A-Za-z0-9]{36}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[A-Z0-9]{16}/,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /DATABASE_URL\s*[:=]\s*\S+/i,
  /REDIS_URL\s*[:=]\s*\S+/i,
  /TELEGRAM_TOKEN\s*[:=]\s*\S+/i,
  /GITHUB_TOKEN\s*[:=]\s*\S+/i
];

function containsSecret(text) {
  if (!text || typeof text !== 'string') return false;
  return SECRET_PATTERNS.some(pattern => pattern.test(text));
}

function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.length <= 8) return '[REDACTED]';
      return match.slice(0, 4) + '[REDACTED]' + match.slice(-4);
    });
  }
  return result;
}

function sanitizeMemoryContent(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .trim();
  if (containsSecret(cleaned)) {
    cleaned = redactSecrets(cleaned);
  }
  return cleaned.slice(0, 2000);
}

function calculateAgeDays(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function freshnessLabel(ageDays) {
  if (ageDays === Infinity) return 'unknown';
  if (ageDays <= 7) return 'fresh';
  if (ageDays <= 30) return 'recent';
  if (ageDays <= 90) return 'aging';
  return 'stale';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(nums) {
  const valid = nums.filter(n => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function normalizeContent(text) {
  if (!text || typeof text !== 'string') return '';
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractTerms(text) {
  if (!text || typeof text !== 'string') return [];
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'it', 'this', 'that', 'i', 'you', 'he', 'she', 'we', 'they', 'my', 'your', 'his', 'her', 'our', 'their']);
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
}

module.exports = {
  SECRET_PATTERNS,
  containsSecret,
  redactSecrets,
  sanitizeMemoryContent,
  calculateAgeDays,
  freshnessLabel,
  clamp,
  average,
  truncateText,
  generateId,
  safeJsonParse,
  normalizeContent,
  extractTerms
};

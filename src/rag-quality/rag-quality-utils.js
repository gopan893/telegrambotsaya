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

const SENSITIVITY_LABELS = [
  'public_project',
  'internal_project',
  'security_sensitive',
  'privacy_sensitive',
  'lifeos_private',
  'secret_blocked',
  'unknown'
];

const CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown', 'deprecated'];

const FRESHNESS_LEVELS = ['fresh', 'recent', 'aging', 'stale', 'unknown'];

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

function sanitizeForRag(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .trim();
  if (containsSecret(cleaned)) {
    cleaned = redactSecrets(cleaned);
  }
  return cleaned.slice(0, 5000);
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

function confidenceLabel(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'unknown';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.2) return 'low';
  return 'unknown';
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

module.exports = {
  SECRET_PATTERNS,
  SENSITIVITY_LABELS,
  CONFIDENCE_LEVELS,
  FRESHNESS_LEVELS,
  containsSecret,
  redactSecrets,
  sanitizeForRag,
  calculateAgeDays,
  freshnessLabel,
  confidenceLabel,
  clamp,
  average,
  truncateText,
  generateId,
  safeJsonParse
};

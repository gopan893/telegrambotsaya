'use strict';

const SECRET_PATTERNS = [
  /(?:gh[ps]_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{36,}/g,
  /(?:token|secret|password|api[_-]?key|auth[_-]?key|access[_-]?key|private[_-]?key)[\s]*[:=][\s]*['"]?[A-Za-z0-9_\-]{16,}/gi,
  /(?:bearer|basic)\s+[A-Za-z0-9_\-=]{20,}/gi,
];

function safeCall(fn, fallback) {
  try {
    const result = fn();
    return result !== undefined ? result : fallback;
  } catch {
    return fallback;
  }
}

function buildScore(label, pass, total) {
  const percentage = total > 0 ? Math.round((pass / total) * 100) : 0;
  return {
    label,
    pass,
    total,
    percentage,
    status: percentage >= 80 ? 'good' : percentage >= 50 ? 'acceptable' : 'poor',
  };
}

function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

function redactSecrets(text) {
  if (typeof text !== 'string') return text;
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

function formatVersion(major, minor, patch, suffix) {
  const base = `v${major}.${minor}.${patch}`;
  return suffix ? `${base}-${suffix}` : base;
}

module.exports = {
  safeCall,
  buildScore,
  generateId,
  redactSecrets,
  formatVersion,
};

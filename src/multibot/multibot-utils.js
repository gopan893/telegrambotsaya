'use strict';

const SECRET_PATTERNS = [
  /telegram_token/ig,
  /authorization/ig,
  /bearer\s+[a-z0-9._:-]+/ig,
  /postgresql:\/\/[^\s]+/ig,
  /rediss?:\/\/[^\s]+/ig,
  /\b(?:token|secret|password|api[_-]?key)\b\s*[:=]\s*[^\s]+/ig,
  /\b(?:sk-|ghp_|gsk_|tvly_)[a-z0-9_-]{8,}/ig
];

function normalizeId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
}

function toEnvSuffix(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function maskSecret(text) {
  let output = String(text || '');
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, '[REDACTED]');
  }
  return output;
}

function containsSecretLike(text) {
  const value = typeof text === 'string' ? text : JSON.stringify(text || {});
  return SECRET_PATTERNS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeSummary(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return maskSecret(data).slice(0, 1000);
  if (Array.isArray(data)) return data.map(sanitizeSummary).slice(0, 50);
  if (typeof data !== 'object') return data;

  const output = {};
  for (const [key, value] of Object.entries(data)) {
    const lowered = key.toLowerCase();
    if (['token', 'secret', 'password', 'authorization', 'api_key', 'apikey'].some(part => lowered.includes(part))) {
      output[key] = typeof value === 'boolean' ? value : (value ? '[REDACTED]' : value);
      continue;
    }
    output[key] = sanitizeSummary(value);
  }
  return output;
}

function compactText(text, max = 180) {
  const clean = maskSecret(String(text || '').replace(/\s+/g, ' ').trim());
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

module.exports = {
  compactText,
  containsSecretLike,
  hasValue,
  isTruthy,
  maskSecret,
  normalizeId,
  nowIso,
  safeJson,
  sanitizeSummary,
  toEnvSuffix
};

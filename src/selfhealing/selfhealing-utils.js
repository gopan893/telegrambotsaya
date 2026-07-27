'use strict';

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api_key/i, /authorization/i,
  /bearer/i, /database_url/i, /redis_url/i, /postgresql:\/\//i, /rediss:\/\//i,
  /sk-/i, /ghp_/i, /gsk_/i, /tvly_/i, /telegram_token/i, /github_token/i,
  /google_client_secret/i, /cloudflare_api_token/i
];

function sanitizeOutput(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(clone)) {
    if (SECRET_PATTERNS.some(p => p.test(key))) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = sanitizeOutput(clone[key]);
    }
  }
  return clone;
}

function generateId(prefix) {
  return (prefix || 'sh') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function isSecretKey(key) {
  return SECRET_PATTERNS.some(p => p.test(key));
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return fallback !== undefined ? fallback : null;
  }
}

module.exports = {
  sanitizeOutput,
  generateId,
  nowISO,
  isSecretKey,
  truncate,
  safeJsonParse,
  SECRET_PATTERNS
};

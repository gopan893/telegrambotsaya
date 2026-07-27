'use strict';

const SECRET_PATTERNS = [
  /token/i, /secret/i, /password/i, /api_key/i, /authorization/i,
  /bearer/i, /database_url/i, /redis_url/i, /postgresql:\/\//i, /rediss:\/\//i,
  /sk-/i, /ghp_/i, /gsk_/i, /tvly_/i, /telegram_token/i, /github_token/i,
  /google_client_secret/i, /cloudflare_api_token/i, /render_deploy_hook/i
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const c = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(c)) {
    if (SECRET_PATTERNS.some(p => p.test(k))) { c[k] = '[REDACTED]'; }
    else if (typeof c[k] === 'object' && c[k] !== null) c[k] = sanitize(c[k]);
  }
  return c;
}

function generateId(prefix) {
  return (prefix || 'ah') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function nowISO() { return new Date().toISOString(); }

function truncate(s, max) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

module.exports = { sanitize, generateId, nowISO, truncate, SECRET_PATTERNS };

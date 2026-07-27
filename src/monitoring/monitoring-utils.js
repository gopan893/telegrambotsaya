'use strict';

function generateId(prefix) { return (prefix || 'evt') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
function nowISO() { return new Date().toISOString(); }
function sanitizeValue(value) {
  if (typeof value !== 'string') return value;
  const SECRET = [/bearer\s+[a-z0-9._:-]+/ig, /postgresql:\/\/[^\s"']+/ig, /rediss?:\/\/[^\s"']+/ig, /sk-[a-z0-9_-]+/ig, /ghp_[a-z0-9_]+/ig, /gsk_[a-z0-9_]+/ig, /tvly_[a-z0-9_]+/ig, /\b\d{8,12}:[a-z0-9_-]{20,}\b/ig];
  let redacted = value;
  for (const pattern of SECRET) redacted = redacted.replace(pattern, '[REDACTED]');
  return redacted;
}

function sanitize(obj) {
  if (typeof obj === 'string') return sanitizeValue(obj);
  if (!obj || typeof obj !== 'object') return obj;
  const c = Array.isArray(obj) ? [...obj] : { ...obj };
  const SECRET = [/token/i, /secret/i, /password/i, /api_key/i, /authorization/i, /bearer/i, /database_url/i, /redis_url/i, /postgresql:\/\//i, /rediss:\/\//i, /sk-/i, /ghp_/i, /gsk_/i, /tvly_/i, /telegram_token/i, /github_token/i, /google_client_secret/i, /cloudflare_api_token/i, /render_deploy_hook/i];
  for (const k of Object.keys(c)) {
    if (SECRET.some(p => p.test(k))) c[k] = '[REDACTED]';
    else if (typeof c[k] === 'object' && c[k] !== null) c[k] = sanitize(c[k]);
    else if (typeof c[k] === 'string') c[k] = sanitizeValue(c[k]);
  }
  return c;
}

const TOPICS = ['health', 'dashboard', 'agents', 'executor', 'integrations', 'routines', 'selfhealing', 'cicd', 'audit', 'release_gate'];
const SEVERITIES = ['info', 'warning', 'error', 'critical'];

module.exports = { generateId, nowISO, sanitize, sanitizeValue, TOPICS, SEVERITIES };

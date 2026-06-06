'use strict';

const SECRET_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /api[_\s-]?key/i,
  /authorization/i,
  /credential/i,
  /database_url/i,
  /redis_url/i,
  /telegram_token/i,
  /github_token/i,
  /google_client_secret/i,
  /cloudflare_api_token/i,
  /render_deploy_hook/i
];

const SECRET_VALUE_PATTERNS = [
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{10,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{10,}\b/i,
  /TELEGRAM_TOKEN\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /DATABASE_URL\s*=/i,
  /REDIS_URL\s*=/i,
  /RENDER_DEPLOY_HOOK\s*=/i
];

function redactText(value = '') {
  if (typeof value !== 'string') return value;
  let out = value;
  out = out.replace(/(postgres(?:ql)?:\/\/)[^:\s]+:[^@\s]+@/ig, '$1***:***@');
  out = out.replace(/(rediss?:\/\/)[^:\s]+:[^@\s]+@/ig, '$1***:***@');
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{10,}\b/ig, 'Bearer [REDACTED_SECRET]');
  out = out.replace(/\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{10,}\b/ig, '[REDACTED_SECRET]');
  out = out.replace(/\b(TELEGRAM_TOKEN|GITHUB_TOKEN|DATABASE_URL|REDIS_URL|RENDER_DEPLOY_HOOK)\s*=\s*[^\s]+/ig, '$1=[REDACTED_SECRET]');
  return out;
}

function hasSecret(value) {
  if (value === null || typeof value === 'undefined') return false;
  if (typeof value === 'string') return SECRET_VALUE_PATTERNS.some(pattern => pattern.test(value));
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasSecret);
  return Object.entries(value).some(([key, item]) => {
    if (SECRET_KEY_PATTERNS.some(pattern => pattern.test(key))) return Boolean(item);
    return hasSecret(item);
  });
}

function sanitize(value, depth = 0) {
  if (depth > 8) return '[TRUNCATED]';
  if (value === null || typeof value === 'undefined') return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => sanitize(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 80)) {
    if (SECRET_KEY_PATTERNS.some(pattern => pattern.test(key))) {
      out[key] = item ? 'set' : 'missing';
    } else {
      out[key] = sanitize(item, depth + 1);
    }
  }
  return out;
}

function sanitizeTimelineDetails(details) {
  return sanitize(details);
}

function sanitizeIncident(incident = {}) {
  return sanitize(incident);
}

function sanitizeNotification(notification = {}) {
  return sanitize(notification);
}

module.exports = {
  SECRET_KEY_PATTERNS,
  SECRET_VALUE_PATTERNS,
  hasSecret,
  redactText,
  sanitize,
  sanitizeIncident,
  sanitizeNotification,
  sanitizeTimelineDetails
};

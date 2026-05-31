'use strict';

const crypto = require('crypto');
const auth = require('./dashboard-auth');

const SECRET_PATTERNS = [
  /\b(token|api[_\s-]?key|secret|password|credential|authorization|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key|openai_api_key|github_token|google_client_secret)\b/i,
  /\b(databaseurl|redisurl|telegramtoken|groqapikey|mistralapikey|openweatherapikey|tavilyapikey|dashboardadmintoken|openaiapikey|githubtoken|googleclientsecret)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i
];

const SECRET_VALUE_PATTERNS = [
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\brediss?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i
];

function maskSecretLikeValues(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  out = out.replace(/(postgres(?:ql)?:\/\/)[^:]+:[^@]+@/ig, '$1***:***@');
  out = out.replace(/(rediss?:\/\/)[^:]+:[^@]+@/ig, '$1***:***@');
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/ig, 'Bearer [redacted]');
  out = out.replace(/\b(?:sk|gsk|tvly|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{12,}\b/ig, '[redacted]');
  return out;
}

function preventSecretLeak(data) {
  if (data === null || typeof data === 'undefined') return data;
  if (typeof data === 'string') {
    const masked = maskSecretLikeValues(data);
    if (masked !== data) return masked;
    if (SECRET_VALUE_PATTERNS.some(pattern => pattern.test(data))) {
      return '[redacted]';
    }
    return data;
  }
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(preventSecretLeak);

  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (SECRET_PATTERNS.some(pattern => pattern.test(key))) {
      out[key] = value ? 'set' : 'missing';
    } else {
      out[key] = preventSecretLeak(value);
    }
  }
  return out;
}

function validateLimit(limit, defaultLimit = 20, maxLimit = 100) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(Math.floor(n), maxLimit);
}

function validateUserId(userId) {
  const id = String(userId || '').trim();
  if (!id || id.length > 80) return null;
  if (!/^[a-zA-Z0-9_.:@-]+$/.test(id)) return null;
  return id;
}

function validateId(value, maxLength = 120) {
  const id = String(value || '').trim();
  if (!id || id.length > maxLength) return null;
  if (!/^[a-zA-Z0-9_.:@-]+$/.test(id)) return null;
  return id;
}

function validateTextLength(value, maxLength = 1000, field = 'text') {
  const text = String(value || '').trim();
  if (!text) return { ok: false, error: `${field}_required` };
  if (text.length > maxLength) return { ok: false, error: `${field}_too_long`, maxLength };
  return { ok: true, value: text };
}

function validateTags(tags, maxCount = 12, maxLength = 40) {
  if (typeof tags === 'undefined' || tags === null) return { ok: true, value: [] };
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  const clean = list
    .map(tag => String(tag || '').trim())
    .filter(Boolean)
    .slice(0, maxCount);
  if (clean.some(tag => tag.length > maxLength)) {
    return { ok: false, error: 'tag_too_long' };
  }
  return { ok: true, value: clean };
}

function validateNumberRange(value, min = 0, max = 1, field = 'number') {
  if (typeof value === 'undefined' || value === null || value === '') return { ok: true, value: undefined };
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    return { ok: false, error: `${field}_out_of_range`, min, max };
  }
  return { ok: true, value: number };
}

function sanitizeBeforeAfterSummary(value, maxLength = 360) {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'string') return preventSecretLeak(value.slice(0, maxLength));
  const summary = {};
  for (const [key, item] of Object.entries(value || {}).slice(0, 12)) {
    if (SECRET_PATTERNS.some(pattern => pattern.test(key))) {
      summary[key] = item ? 'set' : 'missing';
    } else if (typeof item === 'string') {
      summary[key] = preventSecretLeak(item.slice(0, 160));
    } else if (typeof item === 'number' || typeof item === 'boolean' || item === null) {
      summary[key] = item;
    } else if (Array.isArray(item)) {
      summary[key] = item.slice(0, 8).map(v => preventSecretLeak(String(v).slice(0, 80)));
    }
  }
  return preventSecretLeak(summary);
}

function validateActionName(actionName) {
  const VALID_ACTIONS = [
    'diagnostics/run',
    'benchmark/run-light',
    'telemetry/prune',
    'ops/refresh',
    'report/export-health',
    'report/export-user-summary'
  ];
  return VALID_ACTIONS.includes(actionName);
}

function safeDashboardResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json(preventSecretLeak(data));
}

function safeDashboardJson(res, data, statusCode = 200) {
  return safeDashboardResponse(res, data, statusCode);
}

function requireDashboardEnabled(req, res, next) {
  const env = req.app?.locals?.dashboardEnv || process.env;
  if (!auth.isDashboardEnabled(env)) {
    return res.status(403).json({ ok: false, error: 'DASHBOARD_DISABLED' });
  }
  next();
}

function requireDashboardAuth(req, res, next) {
  return auth.requireDashboardAuth(req, res, next);
}

const actionRateLimitDb = new Map();

function hashIdentifier(value = '') {
  return crypto.createHash('sha256').update(String(value || 'anonymous')).digest('hex').slice(0, 18);
}

function rateLimitDashboardAction(req, res, next) {
  const header = String(req.headers?.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim();
  const identifier = req.ip || (token ? hashIdentifier(token) : 'anonymous');
  const now = Date.now();
  const records = actionRateLimitDb.get(identifier) || [];
  
  const recent = records.filter(timestamp => now - timestamp < 60000);
  if (recent.length >= 10) {
    return res.status(429).json({ ok: false, error: 'TOO_MANY_REQUESTS', message: 'Maksimal 10 request per menit' });
  }
  
  recent.push(now);
  actionRateLimitDb.set(identifier, recent);
  next();
}

module.exports = {
  SECRET_PATTERNS,
  maskSecretLikeValues,
  preventSecretLeak,
  safeDashboardResponse,
  safeDashboardJson,
  sanitizeBeforeAfterSummary,
  validateLimit,
  validateId,
  validateNumberRange,
  validateTags,
  validateTextLength,
  validateUserId,
  validateActionName,
  requireDashboardEnabled,
  requireDashboardAuth,
  rateLimitDashboardAction
};

'use strict';

const auth = require('./dashboard-auth');

const SECRET_PATTERNS = [
  /\b(token|api[_\s-]?key|secret|password|credential|authorization|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key)\b/i,
  /\b(databaseurl|redisurl|telegramtoken|groqapikey|mistralapikey|openweatherapikey|tavilyapikey|dashboardadmintoken)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bredis:\/\/[^:\s]+:[^@\s]+@/i,
  /\b(?:sk|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{16,}\b/i
];

function maskSecretLikeValues(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  out = out.replace(/(postgres(?:ql)?:\/\/)[^:]+:[^@]+@/ig, '$1***:***@');
  out = out.replace(/(redis:\/\/)[^:]+:[^@]+@/ig, '$1***:***@');
  out = out.replace(/\b(?:sk|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{16,}\b/ig, '[redacted]');
  return out;
}

function preventSecretLeak(data) {
  if (data === null || typeof data === 'undefined') return data;
  if (typeof data === 'string') {
    if (SECRET_PATTERNS.some(pattern => pattern.test(data))) {
      return '[redacted]';
    }
    return maskSecretLikeValues(data);
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

function validateActionName(actionName) {
  const VALID_ACTIONS = ['diagnostics/run', 'benchmark/run-light', 'telemetry/prune', 'ops/refresh'];
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
    return res.status(401).json({ ok: false, error: 'DASHBOARD_DISABLED' });
  }
  next();
}

function requireDashboardAuth(req, res, next) {
  return auth.requireDashboardAuth(req, res, next);
}

const actionRateLimitDb = new Map();
function rateLimitDashboardAction(req, res, next) {
  const header = String(req.headers?.authorization || '');
  const token = header.replace(/^Bearer\s+/i, '').trim() || String(req.query?.token || '').trim();
  const identifier = req.ip || token || 'anonymous';
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
  validateLimit,
  validateUserId,
  validateActionName,
  requireDashboardEnabled,
  requireDashboardAuth,
  rateLimitDashboardAction
};

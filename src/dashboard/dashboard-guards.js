'use strict';

const SECRET_PATTERNS = [
  /\b(token|api[_\s-]?key|secret|password|credential|authorization|private\s+key)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openweather_api_key|tavily_api_key)\b/i,
  /\b(databaseurl|redisurl|telegramtoken|groqapikey|mistralapikey|openweatherapikey|tavilyapikey|dashboardadmintoken)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bredis:\/\/[^:\s]+:[^@\s]+@/i,
  /\b(?:sk|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{16,}\b/i
];

function preventSecretLeak(data) {
  if (data === null || typeof data === 'undefined') return data;
  if (typeof data === 'string') {
    if (SECRET_PATTERNS.some(pattern => pattern.test(data))) return '[redacted]';
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

function safeDashboardResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json(preventSecretLeak(data));
}

module.exports = {
  SECRET_PATTERNS,
  preventSecretLeak,
  safeDashboardResponse,
  validateLimit,
  validateUserId
};

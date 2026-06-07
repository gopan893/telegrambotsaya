const crypto = require('crypto');

function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${ts}-${rand}`;
}

const SECRET_PATTERNS = [
  /token[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /password[=:]\s*\S+/gi,
  /api_key[=:]\s*\S+/gi,
  /Authorization[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /DATABASE_URL[=:]\s*\S+/gi,
  /REDIS_URL[=:]\s*\S+/gi,
  /postgresql:\/\/\S+/gi,
  /rediss:\/\/\S+/gi,
  /\bsk-\w+/gi,
  /\bghp_\w+/gi,
  /\bgithub_pat_\w+/gi,
  /\bgsk_\w+/gi,
  /\btvly_\w+/gi,
  /TELEGRAM_TOKEN[=:]\s*\S+/gi,
  /GITHUB_TOKEN[=:]\s*\S+/gi,
  /GOOGLE_CLIENT_SECRET[=:]\s*\S+/gi,
  /CLOUDFLARE_API_TOKEN[=:]\s*\S+/gi,
  /RENDER_DEPLOY_HOOK[=:]\s*\S+/gi,
];

function sanitizeImprovementText(text) {
  if (typeof text !== 'string') return '';
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

function maskSecrets(obj) {
  const clone = JSON.parse(JSON.stringify(obj));
  function walk(val) {
    if (typeof val === 'string') {
      return sanitizeImprovementText(val);
    }
    if (Array.isArray(val)) {
      return val.map(walk);
    }
    if (val && typeof val === 'object') {
      const acc = {};
      for (const [k, v] of Object.entries(val)) {
        acc[k] = walk(v);
      }
      return acc;
    }
    return val;
  }
  return walk(clone);
}

function now() {
  return new Date().toISOString();
}

function isRecent(timestamp, hours) {
  const then = new Date(timestamp).getTime();
  if (isNaN(then)) return false;
  const diffMs = Date.now() - then;
  return diffMs >= 0 && diffMs < hours * 3600 * 1000;
}

function truncate(str, maxLen) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

function hashDedupKey(obj) {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {});
  const json = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = {
  generateId,
  sanitizeImprovementText,
  maskSecrets,
  now,
  isRecent,
  truncate,
  hashDedupKey,
};

'use strict';

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizeText(text, maxLen = 500) {
  return String(text || '')
    .replace(/(sk-[a-zA-Z0-9_-]+|xai-[a-zA-Z0-9_-]+|AIza[^\s]+)/g, '[redacted]')
    .replace(/(token|api[_-]?key|secret|password)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]')
    .slice(0, maxLen);
}

function sanitizeMeta(meta = {}) {
  const out = {};
  for (const [key, value] of Object.entries(meta || {})) {
    const lowerKey = String(key).toLowerCase();
    if (/(token|secret|password|api.?key|authorization|cookie)/.test(lowerKey)) {
      out[key] = '[redacted]';
    } else if (typeof value === 'string') {
      out[key] = sanitizeText(value, 220);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 8).map(item => typeof item === 'string' ? sanitizeText(item, 120) : item);
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeText(JSON.stringify(value), 260);
    }
  }
  return out;
}

function getRecent(list, windowMs) {
  const now = Date.now();
  return (Array.isArray(list) ? list : []).filter(item => {
    const ts = Date.parse(item.timestamp || item.createdAt || item.completedAt || 0);
    return Number.isFinite(ts) && now - ts <= windowMs;
  });
}

function safeError(err, scope = 'unknown') {
  return {
    scope,
    message: sanitizeText(err?.message || err || 'Unknown error', 300),
    name: sanitizeText(err?.name || 'Error', 80),
    timestamp: nowIso()
  };
}

module.exports = {
  nowIso,
  clamp,
  sanitizeText,
  sanitizeMeta,
  getRecent,
  safeError
};

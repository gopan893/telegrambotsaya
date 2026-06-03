'use strict';

const SECRET_PATTERNS = [
  /\b(?:token|secret|password|api[_-]?key|authorization|bearer|database_url|redis_url|telegram_token|github_token|google_client_secret|cloudflare_api_token)\b\s*[:=]\s*[^\s,;]+/ig,
  /postgresql:\/\/[^\s]+/ig,
  /rediss?:\/\/[^\s]+/ig,
  /\b(?:sk|ghp|github_pat|gsk|tvly)[-_][A-Za-z0-9_-]{4,}/ig,
  /Bearer\s+[A-Za-z0-9._:-]+/ig
];

function maskSecretText(text = '') {
  let output = String(text || '');
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    output = output.replace(pattern, '[REDACTED]');
  }
  return output;
}

function containsSecretLike(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value || {});
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(raw);
  });
}

function compactText(text = '', max = 1000) {
  const clean = maskSecretText(String(text || '').replace(/\s+/g, ' ').trim());
  return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1))}…` : clean;
}

function sanitizeConnectorResult(value, options = {}) {
  if (value === null || typeof value === 'undefined') return value;
  if (typeof value === 'string') return compactText(value, options.maxText || 1200);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, options.maxItems || 50).map(item => sanitizeConnectorResult(item, options));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    const safeIndicatorKey = /(configured|status|score|available|enabled|readOnlyOnly|draftOnly|sendEnabled)$/i.test(key) ||
      ['credentialStatus', 'credentialsStatus'].includes(key);
    if (/(token|secret|password|authorization|api[_-]?key|database_url|redis_url|credential|client_secret)/i.test(lowered)) {
      if (safeIndicatorKey) {
        out[key] = sanitizeConnectorResult(item, options);
        continue;
      }
      out[key] = item ? '[REDACTED]' : item;
      continue;
    }
    out[key] = sanitizeConnectorResult(item, options);
  }
  return out;
}

function buildSafeSummary(value = {}, max = 700) {
  return compactText(typeof value === 'string' ? value : JSON.stringify(sanitizeConnectorResult(value)), max);
}

module.exports = {
  buildSafeSummary,
  compactText,
  containsSecretLike,
  maskSecretText,
  sanitizeConnectorResult
};

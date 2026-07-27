'use strict';

function safeCall(fn, fallback) {
  try {
    return fn();
  } catch (err) {
    return fallback !== undefined ? fallback : null;
  }
}

function buildScore(pass, total) {
  if (total === 0) return 0;
  return Math.round((pass / total) * 100);
}

function normalizeModuleName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy = Array.isArray(obj) ? [...obj] : { ...obj };
  const secretKeys = /password|secret|token|key|api.?key|private.?key|access.?key|auth|credential|hash|salt|jwt|session.?secret/i;
  for (const key of Object.keys(copy)) {
    const val = copy[key];
    if (secretKeys.test(key) && typeof val === 'string') {
      copy[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      copy[key] = redactSecrets(val);
    }
  }
  return copy;
}

module.exports = {
  safeCall,
  buildScore,
  normalizeModuleName,
  redactSecrets
};

'use strict';

function safeCall(fn, fallback) {
  try {
    const result = fn();
    return result !== undefined ? result : fallback;
  } catch {
    return fallback;
  }
}

function buildScore(value, min, max) {
  if (value < min) value = min;
  if (value > max) value = max;
  return (value - min) / (max - min);
}

function buildSeverity(score) {
  if (score >= 0.8) return 'critical';
  if (score >= 0.5) return 'high';
  if (score >= 0.2) return 'medium';
  return 'low';
}

function redactSecrets(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/(secret|token|key|password|api[_-]?key)[=:]\s*\S+/gi, '$1=***REDACTED***');
}

function normalizeId(id) {
  if (typeof id !== 'string') return '';
  return id
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = {
  safeCall,
  buildScore,
  buildSeverity,
  redactSecrets,
  normalizeId
};

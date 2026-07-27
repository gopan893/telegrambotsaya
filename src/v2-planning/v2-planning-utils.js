'use strict';

function safeCall(fn, fallback) {
  try { return fn(); } catch (_) { return fallback; }
}

function buildScore(passed, total) {
  if (!total) return 0;
  return Math.round((passed / total) * 100);
}

function classifyPriority(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const seen = new WeakSet();
  function walk(val) {
    if (val === null || typeof val !== 'object') return val;
    if (seen.has(val)) return '[CIRCULAR]';
    seen.add(val);
    if (Array.isArray(val)) return val.map(walk);
    const copy = {};
    for (const [k, v] of Object.entries(val)) {
      const lk = k.toLowerCase();
      if (lk.includes('token') || lk.includes('secret') || lk.includes('password') || lk.includes('key') || lk.includes('credential') || lk.includes('auth')) {
        copy[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        copy[k] = walk(v);
      } else {
        copy[k] = v;
      }
    }
    return copy;
  }
  return walk(obj);
}

module.exports = { safeCall, buildScore, classifyPriority, redactSecrets };

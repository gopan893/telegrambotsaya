'use strict';

const fs = require('fs');
const path = require('path');

function safeCall(fn, fallback) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.catch(() => fallback);
    }
    return result;
  } catch (_) {
    return fallback;
  }
}

function buildScore(value, max, label) {
  const numeric = Number(value) || 0;
  const maxNumeric = Number(max) || 1;
  const raw = maxNumeric > 0 ? Math.min(100, Math.round((1 - numeric / maxNumeric) * 100)) : 100;
  return { score: Math.max(0, raw), label, value: numeric, max: maxNumeric };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(i, units.length - 1);
  return (bytes / Math.pow(1024, idx)).toFixed(1) + ' ' + units[idx];
}

function buildPercentile(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function redactSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted = JSON.parse(JSON.stringify(obj));
  const secretKeys = ['TELEGRAM_TOKEN', 'DATABASE_URL', 'REDIS_URL', 'DASHBOARD_ADMIN_TOKEN', 'GITHUB_TOKEN', 'GOOGLE_CLIENT_SECRET', 'CLOUDFLARE_API_TOKEN', 'token', 'secret', 'password', 'apiKey', 'api_key', 'privateKey'];
  function walk(val) {
    if (!val || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      for (const item of val) walk(item);
      return;
    }
    for (const key of Object.keys(val)) {
      if (secretKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
        val[key] = '[REDACTED_SECRET]';
      } else if (typeof val[key] === 'object' && val[key] !== null) {
        walk(val[key]);
      }
    }
  }
  walk(redacted);
  return redacted;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

function getFileSize(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch (_) {
    return 0;
  }
}

module.exports = {
  safeCall,
  buildScore,
  formatBytes,
  buildPercentile,
  redactSecrets,
  readFileSafe,
  getFileSize
};

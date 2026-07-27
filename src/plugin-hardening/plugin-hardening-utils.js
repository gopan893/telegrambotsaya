'use strict';

const SECRET_PATTERNS = [
  /token['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /api[_-]?key['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /secret['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /password['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /['"][A-Za-z0-9]{32,}['"]/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g
];

function sanitizeForLog(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') {
    let sanitized = value;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        const key = match.split(/[:'"\s]/)[0];
        return key + ': [REDACTED_SECRET]';
      });
    }
    return sanitized;
  }
  if (typeof value === 'object') {
    try {
      return JSON.parse(sanitizeForLog(JSON.stringify(value)));
    } catch (_) {
      return '[Object]';
    }
  }
  return String(value);
}

function safeStringify(value) {
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch (_) {
    return '[Unstringifiable]';
  }
}

function generateId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return (prefix ? prefix + '_' : '') + ts + '_' + rand;
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (_) {
    return obj;
  }
}

function mergeDefaults(obj, defaults) {
  if (!obj || typeof obj !== 'object') return { ...defaults };
  if (!defaults || typeof defaults !== 'object') return { ...obj };
  const result = { ...defaults };
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function safeObject(obj) {
  return obj && typeof obj === 'object' ? obj : {};
}

function now() {
  return new Date().toISOString();
}

function chunk(arr, size) {
  const chunks = [];
  const safeArr = safeArray(arr);
  for (let i = 0; i < safeArr.length; i += size) {
    chunks.push(safeArr.slice(i, i + size));
  }
  return chunks;
}

function unique(arr) {
  return [...new Set(safeArray(arr))];
}

function flatten(arr) {
  return safeArray(arr).reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of safeArray(keys)) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}

function omit(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const omitSet = new Set(safeArray(keys));
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!omitSet.has(key)) result[key] = value;
  }
  return result;
}

function clamp(value, min, max) {
  const num = Number(value) || 0;
  return Math.max(min, Math.min(max, num));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

module.exports = {
  sanitizeForLog, safeStringify, generateId, deepClone, mergeDefaults,
  safeArray, safeObject, now, chunk, unique, flatten,
  pick, omit, clamp, isPlainObject, isEmpty
};

'use strict';

const SECRET_PATTERNS = [
  /token['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /api[_-]?key['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /secret['":\s]*[=:'""][^'"\s,}]{8,}/gi,
  /password['":\s]*[=:'""][^'"\s,}]{8,}/gi
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

function now() {
  return new Date().toISOString();
}

function safeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

function safeObject(obj) {
  return obj && typeof obj === 'object' ? obj : {};
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
  sanitizeForLog, safeStringify, generateId, deepClone,
  now, safeArray, safeObject, pick, omit, isPlainObject, isEmpty
};

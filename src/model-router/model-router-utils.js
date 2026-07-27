'use strict';

const crypto = require('crypto');

function createId(prefix = 'mr') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeText(text, max = 500) {
  return String(text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, max).trim();
}

function redactEnvValue(val) {
  if (!val) return '[EMPTY]';
  if (val.length <= 4) return '[REDACTED]';
  return val.substring(0, 2) + '****' + val.substring(val.length - 2);
}

function getEnv(services, key, fallback) {
  if (services?.env?.[key]) return services.env[key];
  if (process.env[key]) return process.env[key];
  return fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = { createId, sanitizeText, redactEnvValue, getEnv, safeArray };

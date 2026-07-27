'use strict';

const crypto = require('crypto');

function createId(prefix = 'dev') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeText(text, max = 200) {
  return String(text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, max).trim();
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname && (parsed.hostname === 'localhost' || parsed.hostname.startsWith('127.') || parsed.hostname.startsWith('192.168.') || parsed.hostname.startsWith('10.') || parsed.hostname.startsWith('172.'))) {
      parsed.hostname = '[LOCAL_HOST]';
    }
    if (parsed.username) parsed.username = '[REDACTED]';
    if (parsed.password) parsed.password = '[REDACTED]';
    const hash = parsed.hash;
    if (hash && /token|key|secret|pairing/i.test(hash)) {
      parsed.hash = '#[REDACTED]';
    }
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

function sanitizeToken(token) {
  if (!token || typeof token !== 'string') return '[REDACTED]';
  if (token.length <= 6) return '[REDACTED]';
  return token.substring(0, 2) + '****' + token.substring(token.length - 2);
}

function sanitizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '';
  if (/^127\./.test(ip) || ip === 'localhost' || /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
    return '[LOCAL_IP]';
  }
  return ip;
}

function sanitizePairingSecret(secret) {
  return '[REDACTED_PAIRING_SECRET]';
}

function sanitizeDeviceToken(token) {
  return sanitizeToken(token);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowMs() {
  return Date.now();
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isValidDeviceType(type) {
  const valid = ['android_termux', 'mac', 'nas', 'local_ai', 'browser_pwa', 'vps', 'unknown'];
  return valid.includes(type);
}

module.exports = {
  createId, sanitizeText, sanitizeUrl, sanitizeToken, sanitizeIp,
  sanitizePairingSecret, sanitizeDeviceToken, safeArray,
  nowMs, formatMs, isValidDeviceType
};

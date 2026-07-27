'use strict';

const crypto = require('crypto');

const SECRET_PATTERNS = [
  /\bTELEGRAM_TOKEN\b.*/gi, /\bDATABASE_URL\b.*/gi, /\bGITHUB_TOKEN\b.*/gi,
  /\bGOOGLE_CLIENT_SECRET\b.*/gi, /\bCLOUDFLARE_API_TOKEN\b.*/gi,
  /\bREDIS_URL\b.*/gi, /\bDASHBOARD_ADMIN_TOKEN\b.*/gi,
  /(?:sk-|ghp_|github_pat_|gsk_|tvly_)[A-Za-z0-9_-]+/g,
  /\d{8,12}:[A-Za-z0-9_-]{20,}/g,
  /postgresql:\/\/[^\s'"]+/gi, /rediss?:\/\/[^\s'"]+/gi
];

function maskSecret(value) {
  if (!value || typeof value !== 'string') return value;
  let result = String(value);
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

function deepMask(obj) {
  if (!obj || typeof obj !== 'object') return maskSecret(obj);
  if (Array.isArray(obj)) return obj.map(deepMask);
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      result[key] = maskSecret(val);
    } else if (val && typeof val === 'object') {
      result[key] = deepMask(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  return deepMask(snapshot);
}

function sanitizeLoopRun(run) {
  if (!run || typeof run !== 'object') return run;
  return deepMask(run);
}

function sanitizeNotification(notification) {
  if (!notification || typeof notification !== 'object') return notification;
  return deepMask(notification);
}

function truncateOperatingText(text, max) {
  if (max === undefined || max === null) max = 800;
  if (!text || typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)) + '...';
}

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return 'loop_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function generateSnapshotId() {
  return 'snap_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function isWithinQuietHours(quietHours) {
  if (!quietHours || !quietHours.start || !quietHours.end) return false;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (str) => {
    const parts = String(str || '').split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const startMinutes = parseTime(quietHours.start);
  const endMinutes = parseTime(quietHours.end);
  if (startMinutes === null || endMinutes === null) return false;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function hashNotificationKey(loopId, type) {
  const raw = String(loopId || '') + ':' + String(type || '');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return hash.slice(0, 16);
}

module.exports = {
  sanitizeSnapshot,
  sanitizeLoopRun,
  sanitizeNotification,
  truncateOperatingText,
  nowIso,
  generateId,
  generateSnapshotId,
  isWithinQuietHours,
  hashNotificationKey,
  maskSecret
};

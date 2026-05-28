'use strict';

const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function normalizeUserId(userId) {
  return String(userId || 'unknown');
}

function createId(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function compactText(text = '', max = 220) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F\u3040-\u30FF\u4E00-\u9FFF]+/i)
    .filter(word => word.length >= 3)
    .slice(0, 80);
}

function textScore(query = '', candidate = '') {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return 0;
  const candidateTokens = new Set(tokenize(candidate));
  let hits = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) hits += 1;
  }
  return hits / Math.max(1, queryTokens.length);
}

async function loadUserBucket(storageKey, userId, services = {}, defaultValue = []) {
  const id = normalizeUserId(userId);
  const storage = services.storageManager;
  if (!storage?.loadData) return defaultValue;
  const bucket = await storage.loadData(storageKey, {});
  if (!bucket || typeof bucket !== 'object' || !Object.prototype.hasOwnProperty.call(bucket, id)) {
    return defaultValue;
  }
  const value = bucket[id];
  if (Array.isArray(defaultValue)) return Array.isArray(value) ? value : defaultValue;
  if (defaultValue && typeof defaultValue === 'object') {
    return value && typeof value === 'object' ? value : defaultValue;
  }
  return typeof value === 'undefined' ? defaultValue : value;
}

async function saveUserBucket(storageKey, userId, items, services = {}) {
  const id = normalizeUserId(userId);
  const storage = services.storageManager;
  if (!storage?.loadData || !storage?.saveData) return false;
  const bucket = await storage.loadData(storageKey, {});
  bucket[id] = items;
  return storage.saveData(storageKey, bucket);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

module.exports = {
  clamp,
  compactText,
  createId,
  formatDate,
  loadUserBucket,
  normalizeUserId,
  nowIso,
  saveUserBucket,
  textScore,
  tokenize
};

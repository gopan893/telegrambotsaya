'use strict';

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const KEY_PREFIX = 'interaction:';
const memoryState = new Map();

let redisClient = null;

function configure(options = {}) {
  redisClient = options.redisClient || null;
}

function keyFor(userId) {
  return `${KEY_PREFIX}${String(userId || '0')}`;
}

function wrap(data = {}, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now();
  return {
    ...data,
    createdAt: data.createdAt || now,
    expiresAt: data.expiresAt || now + ttlMs
  };
}

function isExpired(record) {
  return !record || Date.now() > Number(record.expiresAt || 0);
}

async function setInteraction(userId, data = {}, ttlMs = DEFAULT_TTL_MS) {
  const key = keyFor(userId);
  const record = wrap(data, ttlMs);

  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(record), 'PX', ttlMs);
      return record;
    } catch (_) {}
  }

  memoryState.set(key, record);
  cleanupExpiredInteractions();
  return record;
}

async function getInteraction(userId) {
  const key = keyFor(userId);

  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!isExpired(parsed)) return parsed;
        await redisClient.del(key);
      }
    } catch (_) {}
  }

  const record = memoryState.get(key);
  if (isExpired(record)) {
    memoryState.delete(key);
    return null;
  }
  return record || null;
}

async function clearInteraction(userId) {
  const key = keyFor(userId);
  memoryState.delete(key);

  if (redisClient) {
    try { await redisClient.del(key); } catch (_) {}
  }
}

function cleanupExpiredInteractions() {
  for (const [key, record] of memoryState.entries()) {
    if (isExpired(record)) memoryState.delete(key);
  }
}

module.exports = {
  cleanupExpiredInteractions,
  clearInteraction,
  configure,
  getInteraction,
  setInteraction
};

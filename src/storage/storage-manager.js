'use strict';

const { readJsonFile, writeJsonFileAtomic } = require('../../storage/json-store');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore } = require('./redis-store');

function createStorageManager(options = {}) {
  const env = options.env || process.env;
  const jsonBaseDir = options.jsonBaseDir || process.cwd();
  const postgres = createPostgresStore({
    databaseUrl: env.DATABASE_URL,
    runMigrations: true
  });
  let cache = createRedisStore({
    redisUrl: env.REDIS_URL,
    client: options.redisClient || null
  });
  let persistentType = 'json';
  let initialized = false;
  let lastError = null;

  async function init(runtime = {}) {
    if (runtime.redisClient && !options.redisClient) {
      cache = createRedisStore({
        redisUrl: env.REDIS_URL,
        client: runtime.redisClient
      });
    }

    const cacheStatus = await cache.init();
    const pgStatus = await postgres.init();
    if (pgStatus.ok) {
      persistentType = 'postgres';
    } else {
      persistentType = 'json';
      lastError = pgStatus.reason;
    }
    initialized = true;
    return {
      ok: true,
      persistentType,
      cache: cacheStatus.ok ? 'redis' : 'memory-cache',
      postgres: pgStatus
    };
  }

  async function readData(key, defaultValue) {
    const cacheKey = `bot:data:${key}`;
    try {
      const cached = await cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}

    let value = defaultValue;
    if (persistentType === 'postgres') {
      value = await postgres.readKey(key, defaultValue);
    } else {
      value = await readJsonFile(jsonBaseDir, key, defaultValue);
    }

    try {
      await cache.set(cacheKey, JSON.stringify(value), 120);
    } catch (_) {}
    return value;
  }

  async function saveData(key, data) {
    const cacheKey = `bot:data:${key}`;
    let saved = false;
    if (persistentType === 'postgres') {
      saved = await postgres.writeKey(key, data);
      if (!saved) {
        persistentType = 'json';
      }
    }

    if (persistentType === 'json') {
      try {
        await writeJsonFileAtomic(jsonBaseDir, key, data);
        saved = true;
      } catch (err) {
        lastError = err.message;
      }
    }

    try {
      await cache.set(cacheKey, JSON.stringify(data), 120);
    } catch (_) {}
    return saved;
  }

  async function cacheGet(key) {
    const raw = await cache.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  }

  async function cacheSet(key, value, ttlSeconds = 120) {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    return cache.set(key, payload, ttlSeconds);
  }

  async function close() {
    await Promise.allSettled([
      postgres.close(),
      cache.close()
    ]);
  }

  function status() {
    return {
      initialized,
      persistentType,
      postgres: postgres.status(),
      cache: cache.status(),
      lastError
    };
  }

  return {
    init,
    readData,
    saveData,
    cacheGet,
    cacheSet,
    close,
    status
  };
}

module.exports = {
  createStorageManager
};

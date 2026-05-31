'use strict';

const fsp = require('fs').promises;
const path = require('path');
const { readJsonFile, writeJsonFileAtomic } = require('../../storage/json-store');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore } = require('./redis-store');
const { createJsonRepositories } = require('./json-repositories');

function normalizeDriver(value) {
  const driver = String(value || 'auto').trim().toLowerCase();
  if (['postgres', 'pg', 'postgresql'].includes(driver)) return 'postgres';
  if (['json', 'file', 'local'].includes(driver)) return 'json';
  return 'auto';
}

function createStorageManager(options = {}) {
  const env = options.env || process.env;
  const jsonBaseDir = options.jsonBaseDir || process.cwd();
  const preferredDriver = normalizeDriver(env.STORAGE_DRIVER);
  const postgres = createPostgresStore({
    databaseUrl: env.DATABASE_URL,
    env,
    runMigrations: String(env.RUN_MIGRATIONS || 'true').toLowerCase() !== 'false'
  });
  let cache = createRedisStore({
    redisUrl: env.REDIS_URL,
    client: options.redisClient || null
  });
  let persistentType = 'json';
  let initialized = false;
  let lastError = null;
  let repositories = null;
  let migrationsStatus = 'skipped';

  function shouldTryPostgres() {
    if (preferredDriver === 'json') return false;
    return Boolean(env.DATABASE_URL);
  }

  async function initStorage(runtime = {}) {
    if (runtime.redisClient && !options.redisClient) {
      cache = createRedisStore({
        redisUrl: env.REDIS_URL,
        client: runtime.redisClient
      });
    }

    const cacheStatus = await cache.init();
    let pgStatus = { ok: false, reason: shouldTryPostgres() ? 'not_initialized' : 'postgres_not_requested' };

    if (shouldTryPostgres()) {
      try {
        pgStatus = await postgres.init();
      } catch (err) {
        pgStatus = { ok: false, reason: err.message };
      }
    }

    if (pgStatus.ok) {
      persistentType = 'postgres';
      repositories = postgres.getRepositories();
      migrationsStatus = postgres.status().migrations || 'ok';
      lastError = null;
    } else {
      persistentType = 'json';
      repositories = createJsonRepositories({ loadData, saveData });
      migrationsStatus = pgStatus.reason === 'postgres_not_requested' ? 'skipped' : 'error';
      lastError = pgStatus.reason;
    }

    initialized = true;
    return {
      ok: true,
      persistentType,
      cache: cacheStatus.ok ? 'redis' : 'memory-cache',
      postgres: pgStatus,
      migrations: migrationsStatus,
      fallback: persistentType === 'json'
    };
  }

  async function ensureInitialized() {
    if (!initialized) {
      await initStorage();
    }
  }

  async function loadData(key, defaultValue) {
    await ensureInitialized();
    const cacheKey = `bot:data:${key}`;

    try {
      const cached = await cache.getCache(cacheKey);
      if (cached !== null && typeof cached !== 'undefined') return cached;
    } catch (_) {}

    let value = defaultValue;
    if (persistentType === 'postgres') {
      value = await postgres.getJson(key, defaultValue);
      const postgresStatus = postgres.status();
      if (!postgresStatus.available) {
        persistentType = 'json';
        repositories = createJsonRepositories({ loadData, saveData });
        lastError = postgresStatus.lastError || 'postgres_read_failed';
        value = await readJsonFile(jsonBaseDir, key, defaultValue);
      }
    } else {
      value = await readJsonFile(jsonBaseDir, key, defaultValue);
    }

    try {
      await cache.setCache(cacheKey, value, 120);
    } catch (_) {}
    return value;
  }

  async function saveData(key, data) {
    await ensureInitialized();
    const cacheKey = `bot:data:${key}`;
    let saved = false;

    if (persistentType === 'postgres') {
      saved = await postgres.setJson(key, data);
      if (!saved) {
        const status = postgres.status();
        persistentType = 'json';
        repositories = createJsonRepositories({ loadData, saveData });
        lastError = status.lastError || 'postgres_write_failed';
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
      await cache.setCache(cacheKey, data, 120);
    } catch (_) {}
    return saved;
  }

  async function deleteData(key) {
    await ensureInitialized();
    let deleted = false;

    if (persistentType === 'postgres') {
      deleted = await postgres.deleteKey(key);
    }

    if (persistentType === 'json') {
      try {
        await fsp.unlink(path.join(jsonBaseDir, `${key}.json`));
        deleted = true;
      } catch (err) {
        if (err.code !== 'ENOENT') lastError = err.message;
      }
    }

    try {
      await cache.deleteCache(`bot:data:${key}`);
    } catch (_) {}
    return deleted;
  }

  async function cacheGet(key) {
    return cache.getCache(key);
  }

  async function cacheSet(key, value, ttlSeconds = 120) {
    return cache.setCache(key, value, ttlSeconds);
  }

  function isPostgresEnabled() {
    return persistentType === 'postgres' && Boolean(postgres.status().available);
  }

  function isRedisEnabled() {
    return Boolean(cache.status().redisAvailable);
  }

  function getStore() {
    return persistentType === 'postgres' ? postgres : null;
  }

  function getRepositories() {
    if (!repositories) {
      repositories = persistentType === 'postgres' && postgres.getRepositories()
        ? postgres.getRepositories()
        : createJsonRepositories({ loadData, saveData });
    }
    return repositories;
  }

  async function safeRead(key, defaultValue) {
    try {
      return await loadData(key, defaultValue);
    } catch (_) {
      return defaultValue;
    }
  }

  async function safeWrite(key, value) {
    try {
      return await saveData(key, value);
    } catch (_) {
      return false;
    }
  }

  async function safeDelete(key) {
    try {
      return await deleteData(key);
    } catch (_) {
      return false;
    }
  }

  async function healthCheck() {
    await ensureInitialized();
    const postgresStatus = postgres.status();
    const cacheStatus = cache.status();
    return {
      postgres: postgresStatus.available ? 'available' : (env.DATABASE_URL ? 'error' : 'unavailable'),
      redis: cacheStatus.redisAvailable ? 'available' : (env.REDIS_URL ? 'error' : 'unavailable'),
      fallback: persistentType === 'json' ? 'json' : null,
      storageDriver: persistentType,
      migrations: migrationsStatus || postgresStatus.migrations || 'skipped',
      lastError
    };
  }

  async function closeStorage() {
    await Promise.allSettled([
      postgres.close(),
      cache.close()
    ]);
  }

  function getStorageStatus() {
    const postgresStatus = postgres.status();
    const cacheStatus = cache.status();
    return {
      initialized,
      driver: persistentType,
      preferredDriver,
      persistentType,
      postgres: postgresStatus,
      postgresConfigured: Boolean(env.DATABASE_URL),
      postgresAvailable: Boolean(postgresStatus.available),
      migrations: migrationsStatus || postgresStatus.migrations || 'skipped',
      cache: cacheStatus,
      redisConfigured: Boolean(env.REDIS_URL),
      redisAvailable: Boolean(cacheStatus.redisAvailable),
      lastError
    };
  }

  return {
    initStorage,
    loadData,
    saveData,
    deleteData,
    closeStorage,
    getStorageStatus,
    getRepositories,
    getStore,
    healthCheck,
    isPostgresEnabled,
    isRedisEnabled,
    safeDelete,
    safeRead,
    safeWrite,
    cacheGet,
    cacheSet,
    init: initStorage,
    readData: loadData,
    writeData: saveData,
    close: closeStorage,
    status: getStorageStatus
  };
}

module.exports = {
  createStorageManager,
  normalizeDriver
};

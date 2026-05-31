'use strict';

const fsp = require('fs').promises;
const path = require('path');
const { readJsonFile, writeJsonFileAtomic } = require('../../storage/json-store');
const { checkPostgresHealth } = require('./database');
const { createPostgresStore } = require('./postgres-store');
const { createRedisStore, checkRedisHealth } = require('./redis-store');
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
  const postgres = options.postgresStore || createPostgresStore({
    databaseUrl: env.DATABASE_URL,
    env,
    runMigrations: String(env.RUN_MIGRATIONS || 'true').toLowerCase() !== 'false'
  });
  let cache = options.cacheStore || createRedisStore({
    redisUrl: env.REDIS_URL,
    client: options.redisClient || null
  });
  let persistentType = 'json';
  let initialized = false;
  let lastError = null;
  let repositories = null;
  let migrationsStatus = 'skipped';
  let postgresHealth = null;
  let redisHealth = null;
  let fallbackReason = null;

  function shouldTryPostgres() {
    if (preferredDriver === 'json') return false;
    return Boolean(env.DATABASE_URL);
  }

  function buildPostgresSkippedHealth() {
    return {
      configured: Boolean(env.DATABASE_URL),
      available: false,
      tableReady: false,
      status: preferredDriver === 'json' ? 'disabled' : 'missing_env',
      latencyMs: null,
      errorMessageSafe: preferredDriver === 'json' ? 'PostgreSQL disabled by STORAGE_DRIVER=json' : 'DATABASE_URL missing',
      recommendedFix: preferredDriver === 'json' ? 'Set STORAGE_DRIVER=auto to use PostgreSQL' : 'Set DATABASE_URL or use JSON fallback'
    };
  }

  function isPostgresReady(status = {}) {
    const health = status.health || {};
    return Boolean((health.available || status.available) && health.tableReady);
  }

  async function initStorage(runtime = {}) {
    if (runtime.redisClient && !options.redisClient) {
      cache = createRedisStore({
        redisUrl: env.REDIS_URL,
        client: runtime.redisClient
      });
    }

    const cacheStatus = await cache.init();
    redisHealth = cache.status().health || await checkRedisHealth({ redisUrl: env.REDIS_URL, env, force: true });
    let pgStatus = { ok: false, reason: shouldTryPostgres() ? 'not_initialized' : 'postgres_not_requested' };

    if (shouldTryPostgres()) {
      try {
        pgStatus = await postgres.init();
      } catch (err) {
        pgStatus = { ok: false, reason: err.message };
      }
    }

    const postgresStatusAfterInit = postgres.status();
    postgresHealth = postgresStatusAfterInit.health || (shouldTryPostgres()
      ? await checkPostgresHealth({
          pool: postgres.getPool?.() || undefined,
          databaseUrl: env.DATABASE_URL,
          env,
          force: true
        })
      : buildPostgresSkippedHealth());

    if (shouldTryPostgres() && (pgStatus.ok || postgresStatusAfterInit.available) && isPostgresReady({ ...postgresStatusAfterInit, health: postgresHealth })) {
      persistentType = 'postgres';
      repositories = postgres.getRepositories();
      migrationsStatus = postgresStatusAfterInit.migrations || 'ok';
      lastError = null;
      fallbackReason = null;
    } else {
      persistentType = 'json';
      repositories = createJsonRepositories({ loadData, saveData });
      migrationsStatus = pgStatus.reason === 'postgres_not_requested' ? 'skipped' : 'error';
      lastError = pgStatus.reason || postgresHealth.errorMessageSafe || postgresHealth.status || 'postgres_not_ready';
      fallbackReason = shouldTryPostgres()
        ? (pgStatus.reason || postgresHealth.errorMessageSafe || postgresHealth.status || 'postgres_unavailable')
        : (preferredDriver === 'json' ? 'storage_driver_json' : 'database_url_missing');
    }

    initialized = true;
    return {
      ok: true,
      persistentType,
      cache: cacheStatus.ok ? 'redis' : 'memory-cache',
      postgres: pgStatus,
      migrations: migrationsStatus,
      fallback: persistentType === 'json',
      fallbackActive: persistentType === 'json',
      fallbackReason,
      activeDriver: persistentType
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
        fallbackReason = lastError;
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
        fallbackReason = lastError;
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
      if (!deleted && !postgres.status().available) {
        persistentType = 'json';
        repositories = createJsonRepositories({ loadData, saveData });
        lastError = postgres.status().lastError || 'postgres_delete_failed';
        fallbackReason = lastError;
      }
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

  async function listKeys(prefix = '') {
    await ensureInitialized();

    if (persistentType === 'postgres') {
      const keys = await postgres.listKeys(prefix);
      if (!postgres.status().available) {
        persistentType = 'json';
        repositories = createJsonRepositories({ loadData, saveData });
        lastError = postgres.status().lastError || 'postgres_list_keys_failed';
        fallbackReason = lastError;
      } else {
        return Array.isArray(keys) ? keys : [];
      }
    }

    try {
      const files = await fsp.readdir(jsonBaseDir);
      const cleanPrefix = String(prefix || '');
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.slice(0, -5))
        .filter(key => !cleanPrefix || key.startsWith(cleanPrefix))
        .sort()
        .slice(0, 500);
    } catch (err) {
      lastError = err.message;
      return [];
    }
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
    await refreshStorageHealth();
    const postgresStatus = normalizePostgresStatus(postgres.status());
    const cacheStatus = normalizeRedisStatus(cache.status());
    return {
      postgres: postgresStatus.available ? 'available' : (env.DATABASE_URL ? 'error' : 'unavailable'),
      redis: cacheStatus.redisAvailable ? 'available' : (env.REDIS_URL ? 'error' : 'unavailable'),
      fallback: persistentType === 'json' ? 'json' : null,
      storageDriver: persistentType,
      activeDriver: persistentType,
      fallbackActive: persistentType === 'json',
      fallbackReason,
      migrations: migrationsStatus || postgresStatus.migrations || 'skipped',
      postgresHealth: postgresStatus.health,
      redisHealth: cacheStatus.health,
      lastError
    };
  }

  function normalizePostgresStatus(status = {}) {
    const health = postgresHealth || status.health || {
      configured: Boolean(env.DATABASE_URL),
      available: Boolean(status.available),
      tableReady: Boolean(status.available && status.migrated),
      status: status.available ? 'connected' : (env.DATABASE_URL ? 'unavailable' : 'missing_env'),
      latencyMs: null,
      errorMessageSafe: status.lastError ? 'connection failed' : null,
      recommendedFix: status.available ? 'No action needed' : 'Set DATABASE_URL correctly or use JSON fallback'
    };
    return {
      ...status,
      health,
      configured: Boolean(health.configured),
      available: Boolean(health.available),
      tableReady: Boolean(health.tableReady),
      status: health.status || (health.available ? 'connected' : 'unavailable'),
      latencyMs: health.latencyMs ?? null,
      errorMessageSafe: health.errorMessageSafe || null,
      recommendedFix: health.recommendedFix || null
    };
  }

  function normalizeRedisStatus(status = {}) {
    const health = redisHealth || status.health || {
      configured: Boolean(env.REDIS_URL),
      available: Boolean(status.redisAvailable),
      status: status.redisAvailable ? 'connected' : (env.REDIS_URL ? 'unavailable' : 'missing_env'),
      latencyMs: null,
      errorMessageSafe: status.lastError ? 'connection failed' : null,
      recommendedFix: status.redisAvailable ? 'No action needed' : 'Set REDIS_URL correctly or use memory cache fallback'
    };
    return {
      ...status,
      health,
      configured: Boolean(health.configured),
      available: Boolean(health.available),
      redisAvailable: Boolean(health.available),
      status: health.status || (health.available ? 'connected' : 'unavailable'),
      latencyMs: health.latencyMs ?? null,
      errorMessageSafe: health.errorMessageSafe || null,
      recommendedFix: health.recommendedFix || null
    };
  }

  async function refreshStorageHealth(options = {}) {
    await ensureInitialized();
    const force = Boolean(options.force);
    const pool = postgres.getPool?.() || null;
    postgresHealth = await checkPostgresHealth({
      pool: pool || undefined,
      databaseUrl: env.DATABASE_URL,
      env,
      force
    });
    redisHealth = await checkRedisHealth({
      client: cache.getClient?.(),
      redisUrl: env.REDIS_URL,
      env,
      force
    });
    return getStorageStatus();
  }

  async function closeStorage() {
    await Promise.allSettled([
      postgres.close(),
      cache.close()
    ]);
  }

  function getStorageStatus() {
    const postgresStatus = normalizePostgresStatus(postgres.status());
    const cacheStatus = normalizeRedisStatus(cache.status());
    return {
      initialized,
      driver: persistentType,
      activeDriver: persistentType,
      storageDriver: persistentType,
      configuredDriver: preferredDriver,
      preferredDriver,
      persistentType,
      postgres: postgresStatus,
      postgresConfigured: Boolean(env.DATABASE_URL),
      postgresAvailable: Boolean(postgresStatus.available),
      postgresTableReady: Boolean(postgresStatus.tableReady),
      migrations: migrationsStatus || postgresStatus.migrations || 'skipped',
      cache: cacheStatus,
      redis: cacheStatus,
      redisConfigured: Boolean(env.REDIS_URL),
      redisAvailable: Boolean(cacheStatus.redisAvailable),
      fallbackActive: persistentType === 'json',
      fallback: persistentType === 'json' ? 'json' : null,
      fallbackReason,
      jsonFallbackAvailable: true,
      lastError
    };
  }

  return {
    initStorage,
    loadData,
    saveData,
    deleteData,
    listKeys,
    closeStorage,
    getStorageStatus,
    refreshStorageHealth,
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
    listDataKeys: listKeys,
    close: closeStorage,
    status: getStorageStatus
  };
}

module.exports = {
  createStorageManager,
  normalizeDriver
};

'use strict';

let lastRedisHealth = null;
let lastRedisHealthAt = 0;

function getRedisUrl(options = {}) {
  const env = options.env || process.env;
  return options.redisUrl || env.REDIS_URL || '';
}

function safeRequireRedis(options = {}) {
  if (options.RedisClass) return options.RedisClass;
  if (typeof options.requireRedis === 'function') return options.requireRedis();
  try {
    return require('ioredis');
  } catch (_) {
    return null;
  }
}

function safeRedisError(err, fallback = 'connection failed') {
  const message = String(err?.message || err || '').toLowerCase();
  if (!message) return fallback;
  if (/timeout|timed out|etimedout/i.test(message)) return 'timeout';
  if (/tls|ssl|certificate|cert|self[-\s]?signed/i.test(message)) return 'tls issue';
  if (/connect|econnrefused|enotfound|auth|password|wrongpass|network/i.test(message)) return 'connection failed';
  return fallback;
}

function buildRedisHealth(patch = {}) {
  return {
    configured: false,
    available: false,
    latencyMs: null,
    errorCode: null,
    errorMessageSafe: 'REDIS_URL missing',
    status: 'missing_env',
    recommendedFix: 'Set REDIS_URL or use memory cache fallback',
    ...patch
  };
}

function withTimeout(promise, timeoutMs, label = 'timeout') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    Promise.resolve(promise)
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function checkRedisHealth(options = {}) {
  const env = options.env || process.env;
  const redisUrl = getRedisUrl({ ...options, env });
  const cacheTtlMs = Number(options.cacheTtlMs || 30000);
  const timeoutMs = Number(options.timeoutMs || 3000);
  const now = Date.now();

  if (!options.force && !options.client && lastRedisHealth && now - lastRedisHealthAt < cacheTtlMs) {
    return { ...lastRedisHealth };
  }

  if (String(env.REDIS_DISABLED || '').toLowerCase() === 'true') {
    lastRedisHealth = buildRedisHealth({
      status: 'disabled',
      errorMessageSafe: 'Redis disabled',
      recommendedFix: 'Unset REDIS_DISABLED to enable Redis'
    });
    lastRedisHealthAt = now;
    return { ...lastRedisHealth };
  }

  if (!redisUrl && !options.client) {
    lastRedisHealth = buildRedisHealth();
    lastRedisHealthAt = now;
    return { ...lastRedisHealth };
  }

  const Redis = safeRequireRedis(options);
  if (!Redis && !options.client) {
    lastRedisHealth = buildRedisHealth({
      configured: true,
      status: 'ioredis_missing',
      errorMessageSafe: 'ioredis module missing',
      recommendedFix: 'Install dependency ioredis or use memory cache fallback'
    });
    lastRedisHealthAt = now;
    return { ...lastRedisHealth };
  }

  const started = Date.now();
  let client = options.client || null;
  let temporaryClient = false;

  try {
    if (!client) {
      client = new Redis(redisUrl, {
        lazyConnect: true,
        connectTimeout: timeoutMs,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        tls: redisUrl.startsWith('rediss://') ? {} : undefined
      });
      temporaryClient = true;
      await withTimeout(client.connect(), timeoutMs, 'timeout');
    }

    await withTimeout(client.ping(), timeoutMs, 'timeout');
    lastRedisHealth = buildRedisHealth({
      configured: true,
      available: true,
      latencyMs: Date.now() - started,
      errorCode: null,
      errorMessageSafe: null,
      status: 'connected',
      recommendedFix: 'No action needed'
    });
  } catch (err) {
    const safe = safeRedisError(err);
    const status = safe === 'timeout'
      ? 'timeout'
      : (safe === 'tls issue' ? 'tls_issue' : 'connection_failed');
    lastRedisHealth = buildRedisHealth({
      configured: true,
      available: false,
      latencyMs: Date.now() - started,
      errorCode: err?.code || null,
      errorMessageSafe: safe,
      status,
      recommendedFix: status === 'tls_issue'
        ? 'Check Redis TLS/rediss configuration'
        : (status === 'timeout' ? 'Check Redis network access and timeout' : 'Check REDIS_URL, credentials, and Redis availability')
    });
  } finally {
    if (temporaryClient && client) {
      try {
        if (typeof client.quit === 'function') await client.quit();
        else if (typeof client.disconnect === 'function') client.disconnect();
      } catch (_) {
        try { client.disconnect?.(); } catch (_) {}
      }
    }
    lastRedisHealthAt = Date.now();
  }

  return { ...lastRedisHealth };
}

function createMemoryCache() {
  const map = new Map();
  return {
    async get(key) {
      const item = map.get(key);
      if (!item) return null;
      if (item.expiresAt && Date.now() > item.expiresAt) {
        map.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key, value, ttlSeconds = 0) {
      map.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
      });
      return true;
    },
    async del(key) {
      map.delete(key);
      return true;
    },
    status() {
      return { type: 'memory-cache', available: true, size: map.size };
    },
    async close() {
      map.clear();
    }
  };
}

function createRedisStore(options = {}) {
  let client = options.client || null;
  let available = Boolean(client);
  let lastError = null;
  let health = null;
  const fallback = createMemoryCache();

  async function init() {
    if (client) {
      available = true;
      health = await checkRedisHealth({ client, redisUrl: options.redisUrl, env: options.env, force: true });
      return { ok: true, reusedClient: true };
    }

    if (!options.redisUrl) {
      available = false;
      lastError = 'REDIS_URL tidak diset';
      health = await checkRedisHealth({ redisUrl: options.redisUrl, env: options.env, force: true });
      return { ok: false, reason: lastError };
    }

    try {
      const Redis = safeRequireRedis(options);
      if (!Redis) throw new Error('ioredis module missing');
      client = new Redis(options.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: Number(options.connectTimeout || 3000),
        enableOfflineQueue: false,
        tls: String(options.redisUrl || '').startsWith('rediss://') ? {} : undefined
      });
      await client.connect();
      await client.ping();
      available = true;
      lastError = null;
      health = await checkRedisHealth({ client, redisUrl: options.redisUrl, env: options.env, force: true });
      return { ok: true, reusedClient: false };
    } catch (err) {
      lastError = err.message;
      available = false;
      client = null;
      health = await checkRedisHealth({ redisUrl: options.redisUrl, env: options.env, force: true });
      return { ok: false, reason: lastError };
    }
  }

  async function get(key) {
    try {
      if (available && client) return await client.get(key);
    } catch (err) {
      lastError = err.message;
      available = false;
    }
    return fallback.get(key);
  }

  async function set(key, value, ttlSeconds = 0) {
    try {
      if (available && client) {
        if (ttlSeconds) await client.set(key, value, 'EX', ttlSeconds);
        else await client.set(key, value);
        return true;
      }
    } catch (err) {
      lastError = err.message;
      available = false;
    }
    return fallback.set(key, value, ttlSeconds);
  }

  async function del(key) {
    try {
      if (available && client) return Boolean(await client.del(key));
    } catch (err) {
      lastError = err.message;
      available = false;
    }
    return fallback.del(key);
  }

  async function getCache(key) {
    const raw = await get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return raw;
    }
  }

  async function setCache(key, value, ttlSeconds = 0) {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    return set(key, payload, ttlSeconds);
  }

  async function deleteCache(key) {
    return del(key);
  }

  function isRedisAvailable() {
    return Boolean(available && client);
  }

  function getClient() {
    return client;
  }

  async function close() {
    if (client && !options.client) {
      try { await client.quit(); } catch (_) {}
    }
    await fallback.close();
  }

  function status() {
    return {
      type: available ? 'redis' : 'memory-cache',
      available,
      redisAvailable: isRedisAvailable(),
      lastError,
      health: health || buildRedisHealth({
        configured: Boolean(options.redisUrl),
        available: isRedisAvailable(),
        status: isRedisAvailable() ? 'connected' : (options.redisUrl ? 'unavailable' : 'missing_env'),
        errorMessageSafe: lastError ? safeRedisError(lastError) : (options.redisUrl ? null : 'REDIS_URL missing'),
        recommendedFix: isRedisAvailable() ? 'No action needed' : 'Check REDIS_URL or use memory cache fallback'
      }),
      fallback: fallback.status()
    };
  }

  return {
    init,
    get,
    set,
    del,
    getCache,
    setCache,
    deleteCache,
    isRedisAvailable,
    getClient,
    close,
    status
  };
}

module.exports = {
  createRedisStore,
  createMemoryCache,
  checkRedisHealth,
  buildRedisHealth
};

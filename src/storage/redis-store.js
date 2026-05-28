'use strict';

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
  const fallback = createMemoryCache();

  async function init() {
    if (client) {
      available = true;
      return { ok: true, reusedClient: true };
    }

    if (!options.redisUrl) {
      available = false;
      lastError = 'REDIS_URL tidak diset';
      return { ok: false, reason: lastError };
    }

    try {
      const Redis = require('ioredis');
      client = new Redis(options.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true
      });
      await client.connect();
      await client.ping();
      available = true;
      lastError = null;
      return { ok: true, reusedClient: false };
    } catch (err) {
      lastError = err.message;
      available = false;
      client = null;
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
    close,
    status
  };
}

module.exports = {
  createRedisStore,
  createMemoryCache
};

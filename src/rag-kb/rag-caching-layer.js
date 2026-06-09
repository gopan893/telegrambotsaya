'use strict';

const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000;

function get(query) {
  const key = String(query).toLowerCase().trim();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > (entry.ttl || DEFAULT_TTL)) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function set(query, data, ttl = DEFAULT_TTL) {
  const key = String(query).toLowerCase().trim();
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

function invalidate(query) {
  const key = String(query).toLowerCase().trim();
  cache.delete(key);
}

function clear() {
  cache.clear();
}

function getStats() {
  let active = 0;
  for (const [, entry] of cache) {
    if (Date.now() - entry.timestamp < (entry.ttl || DEFAULT_TTL)) active++;
  }
  return { totalEntries: cache.size, activeEntries: active };
}

module.exports = { get, set, invalidate, clear, getStats };

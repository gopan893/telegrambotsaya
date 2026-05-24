'use strict';

class BoundedTTLMap {
  constructor({ ttlMs = 60_000, max = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  now() {
    return Date.now();
  }

  get(key) {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (this.now() - item.ts > item.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    this.map.set(key, { value, ts: this.now(), ttlMs });
    this.enforceMax();
    return this;
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  remember(key, ttlMs = this.ttlMs) {
    if (!key) return false;
    if (this.get(key) !== undefined) return false;
    this.set(key, true, ttlMs);
    return true;
  }

  cleanup(ttlMs = null) {
    const now = this.now();
    for (const [key, item] of this.map.entries()) {
      const maxAge = ttlMs || item.ttlMs;
      if (now - item.ts > maxAge) this.map.delete(key);
    }
    this.enforceMax();
  }

  entries() {
    this.cleanup();
    return Array.from(this.map.entries()).map(([key, item]) => [key, item.value]);
  }

  get size() {
    this.cleanup();
    return this.map.size;
  }

  enforceMax() {
    while (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
}

module.exports = {
  BoundedTTLMap
};

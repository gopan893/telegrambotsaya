'use strict';

class KeyedQueue {
  constructor({ idleTtlMs = 10 * 60_000 } = {}) {
    this.idleTtlMs = idleTtlMs;
    this.queues = new Map();
  }

  async run(key, task) {
    const id = String(key || 'default');
    const current = this.queues.get(id)?.promise || Promise.resolve();

    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    const chained = current.then(() => gate);

    this.queues.set(id, {
      promise: chained,
      touchedAt: Date.now()
    });

    try {
      await current;
      return await task();
    } finally {
      release();
      const entry = this.queues.get(id);
      if (entry?.promise === chained) {
        this.queues.delete(id);
      } else if (entry) {
        entry.touchedAt = Date.now();
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.queues.entries()) {
      if (now - entry.touchedAt > this.idleTtlMs) {
        this.queues.delete(key);
      }
    }
  }

  get size() {
    return this.queues.size;
  }
}

module.exports = {
  KeyedQueue
};

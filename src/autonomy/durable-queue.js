'use strict';

const QUEUE_KEY = 'autonomy_durable_queue';

function createDurableQueue(options = {}) {
  const storage = options.storageManager;
  let cache = [];
  let claimLock = false;

  async function read() {
    try {
      const val = storage?.safeRead ? await storage.safeRead(QUEUE_KEY, [])
        : storage?.loadData ? await storage.loadData(QUEUE_KEY, [])
          : storage?.get ? await storage.get(QUEUE_KEY) : [];
      cache = Array.isArray(val) ? val : [];
    } catch (_) { cache = []; }
  }

  async function write() {
    try {
      if (storage?.safeWrite) await storage.safeWrite(QUEUE_KEY, cache);
      else if (storage?.saveData) await storage.saveData(QUEUE_KEY, cache);
      else if (storage?.set) await storage.set(QUEUE_KEY, cache);
    } catch (_) {}
  }

  async function enqueue(task) {
    await read();
    const item = {
      id: Math.random().toString(36).slice(2, 10),
      type: task.type || 'generic',
      payload: task.payload || {},
      status: 'queued',
      createdAt: new Date().toISOString()
    };
    cache.push(item);
    await write();
    return item;
  }

  async function claim() {
    if (claimLock) return null;
    claimLock = true;
    try {
      await read();
      const idx = cache.findIndex(t => t.status === 'queued');
      if (idx === -1) return null;
      cache[idx] = {
        ...cache[idx],
        status: 'processing',
        startedAt: new Date().toISOString()
      };
      await write();
      return cache[idx];
    } finally {
      claimLock = false;
    }
  }

  async function updateStatus(id, status, extra = {}) {
    await read();
    const idx = cache.findIndex(t => t.id === id);
    if (idx === -1) return false;
    cache[idx] = {
      ...cache[idx],
      status,
      finishedAt: new Date().toISOString(),
      ...extra
    };

    // Bounded history: keep only last 100 non-queued tasks
    const active = cache.filter(t => t.status === 'queued' || t.status === 'processing');
    const historic = cache.filter(t => t.status !== 'queued' && t.status !== 'processing');
    if (historic.length > 100) {
      const toKeep = historic.slice(-100);
      cache = [...active, ...toKeep];
    }

    await write();
    return true;
  }

  async function complete(id, result = {}) {
    return updateStatus(id, 'completed', { result });
  }

  async function fail(id, error = '') {
    return updateStatus(id, 'failed', { error });
  }

  async function getHistory() {
    await read();
    return [...cache];
  }

  return { enqueue, claim, complete, fail, getHistory };
}

module.exports = { createDurableQueue, QUEUE_KEY };

'use strict';

const STORAGE_KEY = 'autonomy_scheduler_jobs';
const DEFAULT_INTERVAL_MS = { health: 300000, evolution: 3600000, heal: 900000 };

function createAutonomyScheduler(options = {}) {
  const storage = options.storageManager;
  const enabled = options.enabled === undefined ? process.env.AUTONOMY_ENABLED === 'true' : options.enabled === true;
  const intervals = { ...DEFAULT_INTERVAL_MS, ...(options.jobs || {}) };
  const callbacks = options.callbacks || {};
  let timer = null;
  let locked = false;
  let records = [];

  async function read() {
    try {
      const value = storage?.safeRead ? await storage.safeRead(STORAGE_KEY, [])
        : storage?.loadData ? await storage.loadData(STORAGE_KEY, [])
          : storage?.get ? await storage.get(STORAGE_KEY) : [];
      records = Array.isArray(value) ? value : [];
    } catch (_) { records = []; }
  }

  async function write() {
    try {
      if (storage?.safeWrite) await storage.safeWrite(STORAGE_KEY, records);
      else if (storage?.saveData) await storage.saveData(STORAGE_KEY, records);
      else if (storage?.set) await storage.set(STORAGE_KEY, records);
    } catch (_) {}
  }

  function due(name, now) {
    const last = records.filter(record => record.name === name).pop();
    return !last || intervals[name] === 0 || now - new Date(last.finishedAt).getTime() >= intervals[name];
  }

  async function tick() {
    if (!enabled) return { skipped: 'disabled' };
    if (locked) return { skipped: 'locked' };
    locked = true;
    await read();
    const now = Date.now();
    const ran = [];
    try {
      for (const name of ['health', 'evolution', 'heal']) {
        if (typeof callbacks[name] !== 'function' || !due(name, now)) continue;
        const record = { id: `${name}-${now}`, name, startedAt: new Date().toISOString(), status: 'running' };
        try {
          record.result = await callbacks[name]();
          record.status = 'ok';
        } catch (error) {
          record.status = 'error';
          record.error = error && error.message ? error.message : 'Job failed';
        }
        record.finishedAt = new Date().toISOString();
        records.push(record);
        if (records.length > 100) records.shift();
        ran.push(record);
        await write();
      }
      return { ran };
    } finally { locked = false; }
  }

  function start() {
    if (!enabled || timer) return false;
    timer = setInterval(() => { tick(); }, Math.min(...Object.values(intervals).filter(Number.isFinite).filter(value => value > 0), 300000));
    if (timer.unref) timer.unref();
    return true;
  }

  function stop() {
    if (!timer) return false;
    clearInterval(timer);
    timer = null;
    return true;
  }

  function status() {
    return { enabled, started: Boolean(timer), running: locked, records: records.length };
  }

  return { start, stop, tick, status };
}

module.exports = { createAutonomyScheduler, STORAGE_KEY };

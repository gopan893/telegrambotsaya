'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorageManager } = require('../../src/storage');
const { formatDbStatus } = require('../../src/dashboard/storage-status-formatters');

function fakeCache() {
  return {
    async init() { return { ok: false }; },
    status() { return { redisAvailable: false, health: { configured: false, available: false, status: 'missing_env', latencyMs: null } }; },
    async getCache() { return null; },
    async setCache() { return true; },
    async deleteCache() { return true; },
    async close() {}
  };
}

function fakePostgres(options = {}) {
  const ok = options.ok !== false;
  const tableReady = options.tableReady !== false;
  const initOk = options.initOk !== false;
  const data = new Map(Object.entries(options.initialData || {}));
  const calls = { get: 0, set: 0, delete: 0, list: 0 };

  return {
    calls,
    async init() {
      if (!ok) return { ok: false, reason: 'connection_failed' };
      if (!initOk) return { ok: false, reason: 'migration_failed' };
      return { ok: true, migrated: tableReady, tableReady };
    },
    status() {
      return {
        available: ok,
        migrations: tableReady ? 'ok' : 'error',
        health: {
          configured: true, available: ok, tableReady: ok && tableReady,
          status: ok ? (tableReady ? 'connected' : 'migration_required') : 'connection_failed',
          latencyMs: ok ? 2 : null, recommendedFix: ok && tableReady ? 'No action needed' : 'Check DATABASE_URL'
        }
      };
    },
    getRepositories() { return ok && tableReady ? {} : null; },
    getPool() { return null; },
    async close() {},
    async getJson(key, fallback) { calls.get += 1; return data.has(key) ? data.get(key) : fallback; },
    async setJson(key, value) { calls.set += 1; if (!ok || !tableReady) return false; data.set(key, value); return true; },
    async deleteKey(key) { calls.delete += 1; if (!ok || !tableReady) return false; data.delete(key); return true; },
    async listKeys(prefix = '') { calls.list += 1; return Array.from(data.keys()).filter(key => key.startsWith(prefix)).sort(); }
  };
}

describe('Storage Driver Selection', () => {
  let jsonDir;

  beforeEach(() => {
    jsonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-driver-json-'));
  });

  afterEach(() => {
    fs.rmSync(jsonDir, { recursive: true, force: true });
  });

  test('STORAGE_DRIVER=json forces json even with DATABASE_URL', async () => {
    const jsonManager = createStorageManager({
      env: { STORAGE_DRIVER: 'json', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      jsonBaseDir: jsonDir,
      postgresStore: fakePostgres({ ok: true, tableReady: true }),
      cacheStore: fakeCache()
    });
    await jsonManager.initStorage();
    expect(jsonManager.getStorageStatus().activeDriver).toBe('json');
    expect(jsonManager.getStorageStatus().fallbackReason).toBe('storage_driver_json');
  });

  test('STORAGE_DRIVER=auto with healthy PG uses postgres', async () => {
    const pgStore = fakePostgres({ ok: true, tableReady: true });
    const autoHealthy = createStorageManager({
      env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      postgresStore: pgStore,
      cacheStore: fakeCache()
    });
    await autoHealthy.initStorage();
    const status = autoHealthy.getStorageStatus();
    expect(status.activeDriver).toBe('postgres');
    expect(status.fallbackActive).toBe(false);
    expect(status.postgres.tableReady).toBe(true);
  });

  test('auto driver falls back to json when PG fails', async () => {
    const autoFail = createStorageManager({
      env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      postgresStore: fakePostgres({ ok: false }),
      cacheStore: fakeCache()
    });
    await autoFail.initStorage();
    const status = autoFail.getStorageStatus();
    expect(status.activeDriver).toBe('json');
    expect(status.fallbackActive).toBe(true);
    expect(status.fallbackReason).toBeTruthy();
  });

  test('auto driver falls back when PG table not ready', async () => {
    const tableMissing = createStorageManager({
      env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      postgresStore: fakePostgres({ ok: true, tableReady: false }),
      cacheStore: fakeCache()
    });
    await tableMissing.initStorage();
    expect(tableMissing.getStorageStatus().activeDriver).toBe('json');
    expect(tableMissing.getStorageStatus().postgres.tableReady).toBe(false);
  });

  test('CRUD operations work on postgres driver', async () => {
    const pgStore = fakePostgres({ ok: true, tableReady: true });
    const mgr = createStorageManager({
      env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      postgresStore: pgStore,
      cacheStore: fakeCache()
    });
    await mgr.initStorage();
    await mgr.saveData('phase_hotfix', { ok: true });
    expect(await mgr.loadData('phase_hotfix', null)).toEqual({ ok: true });
    expect(await mgr.listKeys('phase_')).toEqual(['phase_hotfix']);
    expect(pgStore.calls.set).toBeGreaterThan(0);
    expect(pgStore.calls.get).toBeGreaterThan(0);
  });

  test('formatDbStatus does not leak secrets', async () => {
    const failStatus = createStorageManager({
      env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
      postgresStore: fakePostgres({ ok: false }),
      cacheStore: fakeCache()
    }).getStorageStatus();

    const text = formatDbStatus(failStatus);
    expect(text).toContain('Storage driver: json');
    expect(text).toContain('Fallback reason:');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('postgresql://');
  });
});

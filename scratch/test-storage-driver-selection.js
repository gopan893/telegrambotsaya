'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStorageManager } = require('../src/storage');
const { formatDbStatus } = require('../src/dashboard/storage-status-formatters');

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
          configured: true,
          available: ok,
          tableReady: ok && tableReady,
          status: ok ? (tableReady ? 'connected' : 'migration_required') : 'connection_failed',
          latencyMs: ok ? 2 : null,
          recommendedFix: ok && tableReady ? 'No action needed' : 'Check DATABASE_URL'
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

async function main() {
  const jsonDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-driver-json-'));
  const jsonManager = createStorageManager({
    env: { STORAGE_DRIVER: 'json', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    jsonBaseDir: jsonDir,
    postgresStore: fakePostgres({ ok: true, tableReady: true }),
    cacheStore: fakeCache()
  });
  await jsonManager.initStorage();
  assert.strictEqual(jsonManager.getStorageStatus().activeDriver, 'json');
  assert.strictEqual(jsonManager.getStorageStatus().fallbackReason, 'storage_driver_json');

  const pgStore = fakePostgres({ ok: true, tableReady: true });
  const autoHealthy = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: pgStore,
    cacheStore: fakeCache()
  });
  await autoHealthy.initStorage();
  const healthyStatus = autoHealthy.getStorageStatus();
  assert.strictEqual(healthyStatus.configuredDriver, 'auto');
  assert.strictEqual(healthyStatus.activeDriver, 'postgres');
  assert.strictEqual(healthyStatus.driver, 'postgres');
  assert.strictEqual(healthyStatus.fallbackActive, false);
  assert.strictEqual(healthyStatus.postgres.tableReady, true);
  assert.strictEqual(healthyStatus.redis.available, false);

  await autoHealthy.saveData('phase_hotfix', { ok: true });
  assert.deepStrictEqual(await autoHealthy.loadData('phase_hotfix', null), { ok: true });
  assert.deepStrictEqual(await autoHealthy.listKeys('phase_'), ['phase_hotfix']);
  assert.ok(pgStore.calls.set > 0);
  assert.ok(pgStore.calls.get > 0);
  assert.ok(pgStore.calls.list > 0);

  const migrationWarningStore = fakePostgres({ ok: true, tableReady: true, initOk: false });
  const autoMigrationWarning = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: migrationWarningStore,
    cacheStore: fakeCache()
  });
  await autoMigrationWarning.initStorage();
  assert.strictEqual(autoMigrationWarning.getStorageStatus().activeDriver, 'postgres');
  assert.strictEqual(autoMigrationWarning.getStorageStatus().fallbackActive, false);

  const autoFail = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: fakePostgres({ ok: false }),
    cacheStore: fakeCache()
  });
  await autoFail.initStorage();
  const failStatus = autoFail.getStorageStatus();
  assert.strictEqual(failStatus.activeDriver, 'json');
  assert.strictEqual(failStatus.fallbackActive, true);
  assert.ok(failStatus.fallbackReason);

  const tableMissing = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: fakePostgres({ ok: true, tableReady: false }),
    cacheStore: fakeCache()
  });
  await tableMissing.initStorage();
  assert.strictEqual(tableMissing.getStorageStatus().activeDriver, 'json');
  assert.strictEqual(tableMissing.getStorageStatus().postgres.tableReady, false);

  const text = formatDbStatus(failStatus);
  assert.ok(text.includes('Storage driver: json'));
  assert.ok(text.includes('Fallback reason:'));
  assert.ok(!text.includes('secret'));
  assert.ok(!text.includes('postgresql://'));

  console.log('test-storage-driver-selection: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

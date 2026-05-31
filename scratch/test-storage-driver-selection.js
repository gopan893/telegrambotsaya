'use strict';

const assert = require('assert');
const { createStorageManager } = require('../src/storage');
const { formatDbStatus } = require('../src/dashboard/storage-status-formatters');

function fakeCache() {
  return {
    async init() { return { ok: false }; },
    status() { return { redisAvailable: false, health: { configured: false, available: false, status: 'missing_env' } }; },
    async getCache() { return null; },
    async setCache() { return true; },
    async deleteCache() { return true; },
    async close() {}
  };
}

function fakePostgres(ok) {
  return {
    async init() { return ok ? { ok: true } : { ok: false, reason: 'connection_failed' }; },
    status() {
      return {
        available: ok,
        migrations: ok ? 'ok' : 'error',
        health: {
          configured: true,
          available: ok,
          tableReady: ok,
          status: ok ? 'connected' : 'connection_failed',
          latencyMs: ok ? 2 : null,
          recommendedFix: ok ? 'No action needed' : 'Check DATABASE_URL'
        }
      };
    },
    getRepositories() { return ok ? {} : null; },
    getPool() { return null; },
    async close() {},
    async getJson(_key, fallback) { return fallback; },
    async setJson() { return ok; },
    async deleteKey() { return ok; }
  };
}

async function main() {
  const jsonManager = createStorageManager({
    env: { STORAGE_DRIVER: 'json', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: fakePostgres(true),
    cacheStore: fakeCache()
  });
  await jsonManager.initStorage();
  assert.strictEqual(jsonManager.getStorageStatus().activeDriver, 'json');
  assert.strictEqual(jsonManager.getStorageStatus().fallbackReason, 'storage_driver_json');

  const autoHealthy = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: fakePostgres(true),
    cacheStore: fakeCache()
  });
  await autoHealthy.initStorage();
  const healthyStatus = autoHealthy.getStorageStatus();
  assert.strictEqual(healthyStatus.activeDriver, 'postgres');
  assert.strictEqual(healthyStatus.fallbackActive, false);

  const autoFail = createStorageManager({
    env: { STORAGE_DRIVER: 'auto', DATABASE_URL: 'postgresql://user:secret@example.com/db' },
    postgresStore: fakePostgres(false),
    cacheStore: fakeCache()
  });
  await autoFail.initStorage();
  const failStatus = autoFail.getStorageStatus();
  assert.strictEqual(failStatus.activeDriver, 'json');
  assert.strictEqual(failStatus.fallbackActive, true);
  assert.ok(failStatus.fallbackReason);

  const text = formatDbStatus(failStatus);
  assert.ok(text.includes('Storage driver: json'));
  assert.ok(!text.includes('secret'));
  assert.ok(!text.includes('postgresql://'));

  console.log('test-storage-driver-selection: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

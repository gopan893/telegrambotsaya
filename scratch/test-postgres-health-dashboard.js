'use strict';

const assert = require('assert');
const { checkPostgresHealth } = require('../src/storage/database');
const { formatDbStatus } = require('../src/dashboard/storage-status-formatters');

async function main() {
  const missing = await checkPostgresHealth({
    databaseUrl: '',
    env: {},
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(missing.configured, false);
  assert.strictEqual(missing.available, false);
  assert.strictEqual(missing.status, 'missing_env');

  const fakeReadyPool = {
    async query(sql) {
      if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'app_kv_store' }] };
      return { rows: [{ ok: 1 }] };
    }
  };
  const connected = await checkPostgresHealth({
    pool: fakeReadyPool,
    databaseUrl: 'postgresql://user:password@example.com/db',
    env: { DATABASE_URL: 'postgresql://user:password@example.com/db' },
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(connected.configured, true);
  assert.strictEqual(connected.available, true);
  assert.strictEqual(connected.tableReady, true);
  assert.strictEqual(connected.status, 'connected');

  const fakeMigrationPool = {
    async query(sql) {
      if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
      return { rows: [{ ok: 1 }] };
    }
  };
  const migration = await checkPostgresHealth({
    pool: fakeMigrationPool,
    databaseUrl: 'postgresql://user:password@example.com/db',
    env: { DATABASE_URL: 'postgresql://user:password@example.com/db' },
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(migration.status, 'migration_required');
  assert.strictEqual(migration.tableReady, false);

  const text = formatDbStatus({
    driver: 'json',
    postgresConfigured: true,
    fallbackActive: true,
    postgres: { health: migration }
  });
  assert.ok(text.includes('PostgreSQL Status'));
  assert.ok(!text.includes('password'));
  assert.ok(!text.includes('postgresql://'));

  console.log('test-postgres-health-dashboard: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

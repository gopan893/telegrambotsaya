'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const guards = require('../src/dashboard/dashboard-guards');
const serializers = require('../src/dashboard/dashboard-serializers');
const actions = require('../src/dashboard/dashboard-actions');

async function main() {
  const leaked = guards.preventSecretLeak({
    databaseUrl: 'postgresql://user:secret@example.com/db',
    redisUrl: 'rediss://:secret@example.com:6379/0',
    auth: 'Bearer supersecrettokenvalue',
    nested: { value: 'gsk_abcdefghijklmnopqrstuvwxyz' }
  });
  assert.strictEqual(leaked.databaseUrl, 'set');
  assert.strictEqual(leaked.redisUrl, 'set');
  assert.strictEqual(leaked.auth, 'Bearer [redacted]');
  assert.strictEqual(leaked.nested.value, '[redacted]');

  const env = serializers.sanitizeEnvStatus({
    TELEGRAM_TOKEN: '123',
    DATABASE_URL: 'postgresql://user:secret@example.com/db',
    REDIS_URL: '',
    DASHBOARD_ADMIN_TOKEN: 'token'
  });
  assert.deepStrictEqual(env, {
    telegramToken: 'set',
    databaseUrl: 'set',
    redisUrl: 'missing',
    openWeatherApiKey: 'missing',
    tavilyApiKey: 'missing',
    groqApiKey: 'missing',
    mistralApiKey: 'missing',
    dashboardAdminToken: 'set'
  });

  const health = serializers.sanitizeHealth({
    ok: true,
    storage: {
      driver: 'json',
      postgresConfigured: true,
      postgres: { health: { status: 'connection_failed', recommendedFix: 'Check DATABASE_URL only' } },
      cache: { health: { status: 'missing_env' } }
    }
  });
  assert.strictEqual(health.postgresStatus, 'connection_failed');
  assert.ok(!JSON.stringify(health).includes('postgresql://'));

  const report = actions.buildHealthReport({
    env: { DATABASE_URL: 'postgresql://user:secret@example.com/db', DASHBOARD_ADMIN_TOKEN: 'token' },
    storageManager: {
      getStorageStatus() {
        return {
          driver: 'json',
          postgresConfigured: true,
          postgres: { health: { status: 'connection_failed', recommendedFix: 'Do not show URL' } },
          cache: { health: { status: 'missing_env' } }
        };
      }
    }
  });
  assert.ok(!JSON.stringify(report).includes('secret@example.com'));

  const exportJs = fs.readFileSync(path.join(__dirname, '..', 'public/dashboard/export.js'), 'utf8');
  ['downloadJson', 'buildHealthReport', 'buildUserSummaryReport', 'exportHealthReport', 'exportUserSummaryReport']
    .forEach(name => assert.ok(exportJs.includes(name), `missing export helper ${name}`));

  console.log('test-dashboard-export-security: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

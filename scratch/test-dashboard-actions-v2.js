'use strict';

const assert = require('assert');
const actions = require('../src/dashboard/dashboard-actions');
const guards = require('../src/dashboard/dashboard-guards');

async function main() {
  assert.strictEqual(guards.validateActionName('report/export-health'), true);
  assert.strictEqual(guards.validateActionName('report/export-user-summary'), true);
  assert.strictEqual(guards.validateActionName('danger/drop-db'), false);

  const services = {
    env: {
      DATABASE_URL: 'postgresql://user:secret@example.com/db',
      REDIS_URL: 'rediss://:secret@example.com:6379/0',
      DASHBOARD_ADMIN_TOKEN: 'token'
    },
    storageManager: {
      getStorageStatus() {
        return {
          driver: 'json',
          fallbackActive: true,
          postgres: { health: { configured: true, available: false, status: 'connection_failed', recommendedFix: 'Check database settings' } },
          cache: { health: { configured: true, available: false, status: 'timeout', recommendedFix: 'Check Redis network' } }
        };
      }
    },
    getUsersSnapshot() {
      return {
        '42': {
          aios: {
            memories: [{ id: 'm1' }],
            goals: [{ id: 'g1', title: 'Build bot', status: 'active' }],
            workflows: [{ id: 'w1' }],
            insights: [{ id: 'i1', content: 'Keep scope tight' }],
            graph: { nodes: [{ id: 'n1' }], edges: [{ id: 'e1' }] }
          }
        }
      };
    }
  };

  const health = await actions.handleAction('report/export-health', services);
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.action, 'report/export-health');
  assert.strictEqual(health.status, 'ok');
  assert.ok(health.result.storage);
  assert.ok(!JSON.stringify(health).includes('secret@example.com'));

  const userSummary = await actions.handleAction('report/export-user-summary', services, { userId: '42' });
  assert.strictEqual(userSummary.ok, true);
  assert.strictEqual(userSummary.result.userId, '42');
  assert.strictEqual(userSummary.result.goalCount, 1);

  const invalid = await actions.handleAction('danger/drop-db', services);
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.status, 'invalid');

  console.log('test-dashboard-actions-v2: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

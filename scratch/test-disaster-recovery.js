'use strict';

const assert = require('assert');
const backup = require('../src/backup');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_dr',
      name: 'DR Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    backup_manifests: [{
      id: 'backup_old',
      type: 'workspace',
      workspaceId: 'ws_dr',
      userId: 'owner',
      status: 'created',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    }],
    dashboard_audit_logs: [],
    aios_graph_nodes: { owner: [{ id: 'node_1', userId: 'owner', workspaceId: 'ws_dr', label: 'PostgreSQL' }] },
    aios_graph_edges: { owner: [{ id: 'edge_1', userId: 'owner', workspaceId: 'ws_dr', from: 'node_1', to: 'missing_node', relationship: 'depends_on' }] },
    planner_sessions: [],
    planner_tasks: [{ id: 'task_1', userId: 'owner', workspaceId: 'ws_dr', planId: 'missing_plan' }],
    executor_proposals: [{ id: 'exec_1', userId: 'owner', workspaceId: 'ws_dr' }]
  };
  return {
    actorId: 'owner',
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => {
        db[key] = value;
        return true;
      },
      getStorageStatus: () => ({
        activeDriver: 'json',
        fallbackActive: true,
        fallbackReason: 'test fallback',
        jsonFallbackAvailable: true,
        postgresAvailable: false,
        redisAvailable: false
      })
    },
    __db: db
  };
}

(async () => {
  const services = createServices();
  const status = await backup.disasterRecovery.getDisasterRecoveryStatus(services);
  assert.equal(status.status, 'attention');
  assert.equal(status.backup.stale, true);
  const check = await backup.disasterRecovery.runDisasterRecoveryCheck(services);
  assert.ok(check.recommendations.length);

  const integrity = await backup.integrityChecker.runIntegrityCheck({}, services);
  assert.equal(integrity.ok, false);
  assert.ok(integrity.issues.some(issue => issue.type === 'graph_edge_missing_node'));
  assert.ok(integrity.issues.some(issue => issue.type === 'planner_task_missing_plan'));
  assert.ok(!JSON.stringify(check).includes('DATABASE_URL='));

  console.log('test-disaster-recovery: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

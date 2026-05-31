'use strict';

const assert = require('assert');
const dashboard = require('../src/dashboard');
const planner = require('../src/planner');
const workspace = require('../src/workspace');

function createServices() {
  const db = {};
  return {
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'test-token',
      OWNER_CHAT_ID: 'owner'
    },
    storageManager: {
      async safeRead(key, fallback) {
        return Object.prototype.hasOwnProperty.call(db, key) ? JSON.parse(JSON.stringify(db[key])) : fallback;
      },
      async safeWrite(key, value) {
        db[key] = JSON.parse(JSON.stringify(value));
        return true;
      },
      getStorageStatus() {
        return { activeDriver: 'memory', driver: 'memory' };
      }
    },
    getUsersSnapshot() {
      return {};
    },
    __db: db
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function simulateAuth(headers = {}, env = {}) {
  const req = { headers, app: { locals: { dashboardEnv: env } } };
  const res = createMockResponse();
  let nextCalled = false;
  dashboard.auth.requireDashboardAuth(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

(async () => {
  const services = createServices();
  await workspace.store.createWorkspace({
    id: 'ws_dashboard_plan',
    name: 'Dashboard Planner',
    ownerId: 'owner',
    members: [
      { userId: 'owner', role: 'owner', status: 'active' },
      { userId: 'editor', role: 'editor', status: 'active' },
      { userId: 'viewer', role: 'viewer', status: 'active' }
    ]
  }, services);
  await workspace.store.createWorkspace({
    id: 'ws_private_other',
    name: 'Other',
    ownerId: 'other',
    members: [{ userId: 'other', role: 'owner', status: 'active' }]
  }, services);

  const noToken = simulateAuth({}, services.env);
  assert.strictEqual(noToken.res.statusCode, 401, 'protected endpoints require token');
  const withToken = simulateAuth({ authorization: 'Bearer test-token' }, services.env);
  assert.strictEqual(withToken.nextCalled, true, 'valid token allowed');

  const viewerCreate = await planner.plannerEngine.createPlan({
    actorId: 'viewer',
    userId: 'viewer',
    workspaceId: 'ws_dashboard_plan',
    title: 'Viewer plan'
  }, services);
  assert.strictEqual(viewerCreate.status, 403, 'viewer cannot write');

  const created = await planner.plannerEngine.createPlan({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_dashboard_plan',
    title: 'Dashboard plan',
    status: 'active'
  }, services);
  assert.strictEqual(created.ok, true, 'editor can create plan');

  const task = await planner.taskOrchestrator.createTask({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_dashboard_plan',
    planId: created.plan.id,
    title: 'Dashboard task',
    impact: 'high'
  }, services);
  assert.strictEqual(task.ok, true, 'editor can create task');

  const next = await planner.plannerEngine.suggestNextActions('ws_dashboard_plan', 'editor', { ...services, actorId: 'editor' });
  assert.strictEqual(next.ok, true, 'next actions endpoint behavior works');
  assert.ok(Array.isArray(next.actions), 'next actions array');

  const cross = await planner.plannerEngine.summarizePlan(created.plan.id, { ...services, actorId: 'other' });
  assert.strictEqual(cross.ok, false, 'cross-workspace access denied or hidden');

  const secret = await planner.plannerEngine.generatePlanFromText('DATABASE_URL=postgresql://user:pass@host/db', {
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_dashboard_plan'
  }, services);
  assert.strictEqual(secret.ok, false, 'secret-like payload rejected');
  assert.ok(!JSON.stringify(secret).includes('postgresql://user:pass@host/db'), 'secret not leaked');

  const sanitized = dashboard.serializers.sanitizePlan({
    title: 'safe',
    description: 'Bearer supersecrettokenvalue123456789'
  });
  assert.ok(!JSON.stringify(sanitized).includes('supersecrettokenvalue'), 'serializer masks secret');

  console.log('test-planner-dashboard-api: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

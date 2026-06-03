'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const integrationRoutes = require('../src/dashboard/integration-execution-routes');

function createMockRouter() {
  const routes = [];
  return {
    routes,
    get(path, handler) { routes.push({ method: 'GET', path, handler }); },
    post(path, handler) { routes.push({ method: 'POST', path, handler }); }
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function findRoute(router, method, path) {
  return router.routes.find(route => route.method === method && route.path === path);
}

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_personal_owner',
      name: 'Owner Workspace',
      type: 'personal',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }]
    }]
  };
  return {
    actorId: 'owner',
    userId: 'owner',
    actorRole: 'owner',
    workspaceId: 'ws_personal_owner',
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'dash-token',
      EXTERNAL_WEBHOOK_URL: 'https://example.com/hook'
    },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } },
    __db: db
  };
}

(async () => {
  const services = createServices();
  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: services.env } } };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const router = createMockRouter();
  integrationRoutes.registerIntegrationExecutionRoutes(router, services);

  const executeWriteRes = createMockRes();
  await findRoute(router, 'POST', '/integrations/execute').handler({
    body: { connectorId: 'webhook', action: 'webhook.send', payload: { text: 'hello' }, actorId: 'owner', userId: 'owner', workspaceId: 'ws_personal_owner' },
    query: {},
    params: {}
  }, executeWriteRes);
  assert.equal(executeWriteRes.statusCode, 400);
  assert.equal(executeWriteRes.payload.error, 'EXECUTE_READ_ONLY_ONLY');

  const executeReadRes = createMockRes();
  await findRoute(router, 'POST', '/integrations/execute').handler({
    body: { connectorId: 'webhook', action: 'webhook.status', payload: {}, actorId: 'owner', userId: 'owner', workspaceId: 'ws_personal_owner' },
    query: {},
    params: {}
  }, executeReadRes);
  assert.equal(executeReadRes.statusCode, 200);
  assert.equal(executeReadRes.payload.ok, true);

  const proposeRes = createMockRes();
  await findRoute(router, 'POST', '/integrations/propose').handler({
    body: { connectorId: 'webhook', action: 'webhook.send', payload: { text: 'hello' }, actorId: 'owner', userId: 'owner', workspaceId: 'ws_personal_owner' },
    query: {},
    params: {}
  }, proposeRes);
  assert.equal(proposeRes.statusCode, 200, JSON.stringify(proposeRes.payload));
  assert.equal(proposeRes.payload.ok, true);
  assert.ok(proposeRes.payload.proposal.id.startsWith('exec_'));

  const qualityRes = createMockRes();
  await findRoute(router, 'GET', '/integrations/connectors/:id/quality').handler({
    body: {},
    query: {},
    params: { id: 'webhook' }
  }, qualityRes);
  assert.equal(qualityRes.payload.status.available, true);

  const executionsRes = createMockRes();
  await findRoute(router, 'GET', '/integrations/executions').handler({
    body: {},
    query: { limit: '10' },
    params: {}
  }, executionsRes);
  assert.equal(executionsRes.payload.ok, true);
  assert.ok(Array.isArray(executionsRes.payload.items));
  assert.ok(!/dash-token|https:\/\/example.com\/hook|WEBHOOK_SHARED_SECRET/.test(JSON.stringify(executionsRes.payload)));

  console.log('test-integration-execution-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

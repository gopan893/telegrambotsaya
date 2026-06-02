'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const agentMemoryRoutes = require('../src/dashboard/agent-memory-routes');

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

(async () => {
  const data = {};
  const audit = [];
  const services = {
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'dash-token',
      OWNER_CHAT_ID: 'owner'
    },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback,
      safeWrite: async (key, value) => {
        data[key] = value;
        return value;
      }
    },
    auditLog: {
      recordAuditLog: async (entry) => audit.push(entry)
    }
  };

  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: services.env } } };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const router = createMockRouter();
  agentMemoryRoutes.registerAgentMemoryRoutes(router, services);

  const profileRoute = findRoute(router, 'GET', '/agents/:agentId/profile');
  const profileRes = createMockRes();
  await profileRoute.handler({ params: { agentId: 'coder' }, query: { workspaceId: 'ws1' }, body: {} }, profileRes);
  assert.equal(profileRes.payload.agentId, 'coder');

  const createRoute = findRoute(router, 'POST', '/agents/:agentId/memory/create');
  const createRes = createMockRes();
  await createRoute.handler({
    params: { agentId: 'coder' },
    query: {},
    body: { workspaceId: 'ws1', userId: 'u1', content: 'CommonJS Render production note.' }
  }, createRes);
  assert.ok(createRes.payload.id);

  const rejectRes = createMockRes();
  await createRoute.handler({
    params: { agentId: 'security' },
    query: {},
    body: { workspaceId: 'ws1', userId: 'u1', content: 'token=secret-value' }
  }, rejectRes);
  assert.equal(rejectRes.statusCode, 422);

  const routerRoute = findRoute(router, 'POST', '/agents/router/test-with-memory');
  const routerRes = createMockRes();
  await routerRoute.handler({
    params: {},
    query: {},
    body: { workspaceId: 'ws1', userId: 'u1', message: 'Fix Render CommonJS deploy' }
  }, routerRes);
  assert.ok(routerRes.payload.route.selectedAgents.includes('coder'));
  assert.ok(!JSON.stringify(routerRes.payload).includes('secret-value'));
  assert.ok(audit.some(entry => entry.action === 'agents/memory_created'));

  console.log('test-agent-memory-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const agentRoutes = require('../src/dashboard/agent-routes');
const serializers = require('../src/dashboard/dashboard-serializers');
const multibot = require('../src/multibot');

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
  const services = {
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'dash-token',
      TELEGRAM_TOKEN: 'legacy-token',
      TELEGRAM_TOKEN_CODER: 'coder-token',
      TELEGRAM_WEBHOOK_SECRET_CODER: 'secret-value'
    },
    __agentMemory: {},
    storageManager: {
      safeRead: async (key, fallback) => services.__agentMemory[key] || fallback,
      safeWrite: async (key, value) => {
        services.__agentMemory[key] = value;
        return value;
      }
    }
  };
  multibot.botRegistry.loadBotConfigs(services.env);

  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: services.env } } };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const router = createMockRouter();
  agentRoutes.registerAgentRoutes(router, services);

  const botsRoute = findRoute(router, 'GET', '/bots');
  const botsRes = createMockRes();
  await botsRoute.handler({ query: {}, params: {}, body: {} }, botsRes);
  assert.ok(botsRes.payload.items.some(bot => bot.id === 'coder'));
  assert.ok(!JSON.stringify(botsRes.payload).includes('coder-token'));
  assert.ok(!JSON.stringify(botsRes.payload).includes('secret-value'));

  const agentsRoute = findRoute(router, 'GET', '/agents');
  const agentsRes = createMockRes();
  await agentsRoute.handler({ query: {}, params: {}, body: {} }, agentsRes);
  assert.ok(agentsRes.payload.items.some(agent => agent.id === 'orchestrator'));

  const routerTest = findRoute(router, 'POST', '/agents/router/test');
  const testRes = createMockRes();
  await routerTest.handler({ body: { message: 'Saya ingin restore backup lama' }, query: {}, params: {} }, testRes);
  assert.ok(testRes.payload.selectedAgents.includes('security'));
  assert.ok(testRes.payload.internalOnlyAgents);
  assert.ok(!JSON.stringify(testRes.payload).includes('legacy-token'));

  const groupUpdate = findRoute(router, 'POST', '/agents/group-settings/update');
  const groupRes = createMockRes();
  await groupUpdate.handler({ body: { chatId: 'chat1', mode: 'quiet', maxAutoAgents: 1, actorId: 'owner' }, query: {}, params: {} }, groupRes);
  assert.equal(groupRes.payload.mode, 'quiet');

  const sanitized = serializers.sanitizeAgentRoutingResult({
    risk: { sanitizedText: 'Bearer secret-token-value', secretDetected: true },
    selectedAgents: ['security']
  });
  assert.ok(!JSON.stringify(sanitized).includes('secret-token-value'));

  console.log('test-agent-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

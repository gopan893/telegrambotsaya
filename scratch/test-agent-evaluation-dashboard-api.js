'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const evaluationRoutes = require('../src/dashboard/evaluation-routes');

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
  const mem = {};
  const services = {
    env: { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'eval-token' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } }
  };

  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: services.env } } };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const router = createMockRouter();
  evaluationRoutes.registerEvaluationRoutes(router, services);

  const casesRes = createMockRes();
  await findRoute(router, 'GET', '/agent-evaluation/cases').handler({ query: {}, body: {}, params: {} }, casesRes);
  assert.ok(casesRes.payload.items.some(item => item.id === 'teacher_anger_advice'));

  const runRes = createMockRes();
  await findRoute(router, 'POST', '/agent-evaluation/run').handler({ body: { caseId: 'teacher_anger_advice' }, query: {}, params: {} }, runRes);
  assert.equal(runRes.payload.ok, true);
  assert.ok(runRes.payload.result.selectedAgents.includes('reflection'));

  const suiteRes = createMockRes();
  await findRoute(router, 'POST', '/agent-evaluation/run-suite').handler({ body: { limit: 14 }, query: {}, params: {} }, suiteRes);
  assert.equal(suiteRes.payload.ok, true);
  assert.equal(suiteRes.payload.summary.qualityGateStatus, 'passed');

  const gatesRes = createMockRes();
  await findRoute(router, 'GET', '/agent-evaluation/quality-gates').handler({ body: {}, query: {}, params: {} }, gatesRes);
  assert.equal(gatesRes.payload.ok, true);
  assert.equal(gatesRes.payload.qualityGates.status, 'passed');

  const compareRes = createMockRes();
  await findRoute(router, 'GET', '/agent-evaluation/compare').handler({ body: {}, query: {}, params: {} }, compareRes);
  assert.equal(compareRes.payload.ok, true);
  assert.ok(!JSON.stringify(compareRes.payload).includes('eval-token'));

  console.log('test-agent-evaluation-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

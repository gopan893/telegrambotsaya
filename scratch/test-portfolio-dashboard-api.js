'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const { registerDashboardRoutes } = require('../src/dashboard/dashboard-routes');
const { makePortfolioServices } = require('./portfolio-test-fixture');

function requestJson(server, path, options = {}) {
  const address = server.address();
  const body = options.body ? JSON.stringify(options.body) : '';
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: options.method || 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const fixture = makePortfolioServices({
    evaluationSystem: {
      runEvaluationCase: async () => ({ score: { approvalSafetyScore: 0, portfolioSafetyScore: 0 } })
    }
  });
  const app = express();
  app.use(express.json());
  registerDashboardRoutes(app, {
    ...fixture.services,
    env: {
      ...fixture.services.env,
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: 'portfolio-token'
    }
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const noAuth = await requestJson(server, '/api/dashboard/portfolio/snapshot');
    assert.strictEqual(noAuth.status, 401);
    const snapshot = await requestJson(server, '/api/dashboard/portfolio/snapshot?workspaceId=ws_portfolio_test&actorId=12345', { token: 'portfolio-token' });
    assert.strictEqual(snapshot.status, 200);
    assert.strictEqual(snapshot.body.ok, true);
    assert.strictEqual(snapshot.body.totals.activeGoals, 2);
    const priorities = await requestJson(server, '/api/dashboard/portfolio/priorities?workspaceId=ws_portfolio_test&actorId=12345', { token: 'portfolio-token' });
    assert.strictEqual(priorities.status, 200);
    assert(Array.isArray(priorities.body.items));
    const proposal = await requestJson(server, '/api/dashboard/portfolio/proposal', {
      method: 'POST',
      token: 'portfolio-token',
      body: { workspaceId: 'ws_portfolio_test', actorId: '12345', userId: '12345', nextAction: { riskLevel: 'high', workspaceId: 'ws_portfolio_test', summary: 'diagnostics only' } }
    });
    assert.strictEqual(proposal.status, 400);
    assert.strictEqual(proposal.body.reason, 'EVALUATION_GATE_REQUIRED');
    assert(!JSON.stringify({ snapshot, priorities, proposal }).includes('portfolio-token'));
  } finally {
    server.close();
  }
  console.log('test-portfolio-dashboard-api: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

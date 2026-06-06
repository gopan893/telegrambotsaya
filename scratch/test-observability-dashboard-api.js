'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const { registerDashboardRoutes } = require('../src/dashboard/dashboard-routes');

function requestJson(server, path, token) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const app = express();
  app.use(express.json());
  registerDashboardRoutes(app, {
    env: { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'test-token', TELEGRAM_TOKEN: 'set', WEBHOOK_URL: 'https://example.test' },
    storageManager: {
      getStorageStatus: () => ({ activeDriver: 'postgres', postgresAvailable: true, postgresTableReady: true }),
      loadData: async (_key, fallback) => fallback,
      saveData: async () => true
    },
    executorSystem: require('../src/executor'),
    evaluationSystem: { runEvalCases: () => ({ approvalSafetyScore: 100 }) }
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const noAuth = await requestJson(server, '/api/dashboard/observability/health');
    assert.strictEqual(noAuth.status, 401, 'protected endpoint requires auth');
    const health = await requestJson(server, '/api/dashboard/observability/health', 'test-token');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.ok, true);
    assert(!JSON.stringify(health.body).includes('test-token'), 'no token leak');
  } finally {
    server.close();
  }
  console.log('test-observability-dashboard-api: ok');
})();

'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const { registerDashboardRoutes } = require('../src/dashboard/dashboard-routes');

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function request(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { res, body };
}

async function run() {
  const app = express();
  app.use(express.json());

  const env = {
    DASHBOARD_ENABLED: 'true',
    DASHBOARD_ADMIN_TOKEN: 'route-test-token'
  };

  registerDashboardRoutes(app, {
    env,
    storageManager: { getStorageStatus: () => ({ driver: 'json', redisAvailable: false }) },
    opsSystem: {
      getStatus: () => ({ health: { status: 'healthy' }, telemetry: {}, reliability: { score: 88, status: 'strong' } }),
      benchmarkEngine: {
        getBenchmarkHistory: () => [],
        getBenchmarkSummary: () => ({ totalRuns: 0 })
      },
      incidentHandler: { listRecentIncidents: () => [] },
      reliabilityScorer: { calculateReliabilityScore: () => ({ score: 88, status: 'strong' }) }
    }
  });

  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: 'Bearer route-test-token' };

  try {
    const dashboard = await request(baseUrl, '/dashboard');
    assert.strictEqual(dashboard.res.status, 200);
    assert(String(dashboard.body).includes('/dashboard/styles.css'));

    const css = await request(baseUrl, '/dashboard/styles.css');
    assert.strictEqual(css.res.status, 200);
    assert(String(css.body).includes(':root'));

    const health = await request(baseUrl, '/api/dashboard/health');
    assert.strictEqual(health.res.status, 200);
    assert.strictEqual(health.body.dashboardEnabled, true);
    assert.strictEqual(health.body.tokenConfigured, true);
    assert(!JSON.stringify(health.body).includes('route-test-token'));

    const blockedSummary = await request(baseUrl, '/api/dashboard/summary');
    assert.strictEqual(blockedSummary.res.status, 401);

    const blockedAction = await request(baseUrl, '/api/dashboard/actions/diagnostics/run', { method: 'POST' });
    assert.strictEqual(blockedAction.res.status, 401);

    const commands = await request(baseUrl, '/api/dashboard/commands', { headers: auth });
    assert.strictEqual(commands.res.status, 200);
    assert(Array.isArray(commands.body.dashboard));
    assert(commands.body.dashboard.includes('/dashboard'));

    console.log('Dashboard UI route tests passed');
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

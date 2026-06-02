'use strict';

const assert = require('assert');
const http = require('http');
const express = require('express');
const dashboard = require('../src/dashboard');

function request(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const token = 'dash-test-token';
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  dashboard.registerDashboardRoutes(app, {
    env: {
      DASHBOARD_ENABLED: 'true',
      DASHBOARD_ADMIN_TOKEN: token,
      OWNER_CHAT_ID: 'owner'
    },
    auditLog: {
      async recordAuditLog(entry) {
        this.items = this.items || [];
        this.items.push(entry);
        return entry;
      }
    }
  });

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;

  try {
    const unauthorized = await request(port, '/api/dashboard/council');
    assert.strictEqual(unauthorized.status, 401, 'protected council endpoint must require token');

    const status = await request(port, '/api/dashboard/council', { token });
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.data.ok, true);

    const run = await request(port, '/api/dashboard/council/run', {
      token,
      method: 'POST',
      body: {
        topic: 'saya bingung lanjut phase berapa',
        workspaceId: 'default',
        userId: 'u1'
      }
    });
    assert.strictEqual(run.status, 200);
    assert.ok(run.data.session.id, 'run should create session');
    assert.ok(!JSON.stringify(run.data).includes('DATABASE_URL'), 'response must not leak env secret names as values');

    const router = await request(port, '/api/dashboard/council/router-test', {
      token,
      method: 'POST',
      body: { message: 'restore backup production' }
    });
    assert.strictEqual(router.status, 200);
    assert.strictEqual(router.data.council.needed, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('test-council-dashboard-api: ok');
})();

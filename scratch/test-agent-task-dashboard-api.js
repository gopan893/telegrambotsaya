'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
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
      res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const token = 'dash-agent-task-token';
  const mem = {};
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  dashboard.registerDashboardRoutes(app, {
    env: { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: token, OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } }
  });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  try {
    assert.strictEqual((await request(port, '/api/dashboard/delegations')).status, 401);
    const create = await request(port, '/api/dashboard/delegations/create', {
      token,
      method: 'POST',
      body: { message: 'buat prompt phase 24 external integration', workspaceId: 'w1', userId: 'u1' }
    });
    assert.strictEqual(create.status, 200);
    assert.ok(create.data.session.id);
    const run = await request(port, `/api/dashboard/delegations/${create.data.session.id}/run`, { token, method: 'POST', body: {} });
    assert.strictEqual(run.status, 200);
    assert.ok(run.data.finalAnswer);
    const tasks = await request(port, '/api/dashboard/agent-tasks?workspaceId=w1', { token });
    assert.strictEqual(tasks.status, 200);
    assert.ok(tasks.data.items.length >= 2);
    const handoff = await request(port, '/api/dashboard/agent-handoffs', { token });
    assert.strictEqual(handoff.status, 200);
    assert.ok(!JSON.stringify(run.data).includes('telegram-token-secret'));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('test-agent-task-dashboard-api: ok');
})();

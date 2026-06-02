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
  const token = 'dash-decision-token';
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
    assert.strictEqual((await request(port, '/api/dashboard/decisions')).status, 401);
    const analyze = await request(port, '/api/dashboard/decisions/analyze', {
      token,
      method: 'POST',
      body: { question: 'lebih baik tambah 10 bot langsung atau 4 dulu?', workspaceId: 'w1', userId: 'u1' }
    });
    assert.strictEqual(analyze.status, 200);
    assert.ok(analyze.data.decision.id);
    assert.ok(/4 bot/i.test(analyze.data.recommendation.recommendation));
    const detail = await request(port, `/api/dashboard/decisions/${analyze.data.decision.id}`, { token });
    assert.strictEqual(detail.status, 200);
    const status = await request(port, `/api/dashboard/decisions/${analyze.data.decision.id}/status`, { token, method: 'POST', body: { status: 'accepted' } });
    assert.strictEqual(status.data.decision.status, 'accepted');
    const history = await request(port, '/api/dashboard/decisions/history?q=bot', { token });
    assert.strictEqual(history.status, 200);
    assert.ok(!JSON.stringify(history.data).includes('secret-token-value'));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log('test-decision-dashboard-api: ok');
})();

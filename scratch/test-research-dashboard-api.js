'use strict';

const assert = require('assert');
const express = require('express');
const http = require('http');
const dashboard = require('../src/dashboard');

function makeServices() {
  const memory = {};
  return {
    __researchStore: memory,
    env: {
      DASHBOARD_ENABLED: true,
      DASHBOARD_ADMIN_TOKEN: 'test-token',
      dashboard: {
        enabled: true,
        adminToken: 'test-token',
        tokenConfigured: true
      }
    },
    logger: { warn: () => {}, info: () => {}, error: () => {} },
    storageManager: {
      safeRead: async (key, fallback) => (Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback),
      safeWrite: async (key, value) => {
        memory[key] = value;
        return value;
      },
      getStorageStatus: () => ({ activeDriver: 'json', fallbackActive: true })
    },
    auditLog: { recordAuditLog: async () => ({ ok: true }) }
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

(async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  dashboard.registerDashboardRoutes(app, makeServices());
  const server = await listen(app);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const auth = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

  try {
    const denied = await fetch(`${baseUrl}/api/dashboard/research`);
    assert.strictEqual(denied.status, 401, 'research API requires token');

    const create = await fetch(`${baseUrl}/api/dashboard/research/tasks`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ topic: 'riset cara terbaik deploy Render Node.js', workspaceId: 'default', userId: 'u1' })
    });
    assert.strictEqual(create.status, 200, 'task create succeeds with token');
    const created = await create.json();
    assert(created.ok && created.task?.id, 'task id returned');
    assert.strictEqual(created.task.scope, 'deployment');

    const analyze = await fetch(`${baseUrl}/api/dashboard/research/tasks/${created.task.id}/analyze`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({})
    });
    assert.strictEqual(analyze.status, 200, 'analyze endpoint succeeds');
    const analyzed = await analyze.json();
    assert(analyzed.ok && analyzed.summary, 'research summary returned');

    const secret = await fetch(`${baseUrl}/api/dashboard/research/tasks`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ topic: 'ini GITHUB_TOKEN saya ghp_xxx simpan sebagai source' })
    });
    assert.strictEqual(secret.status, 400, 'secret-like research input rejected');
    const secretText = JSON.stringify(await secret.json());
    assert(!secretText.includes('ghp_xxx'), 'secret-like value not echoed');

    console.log('test-research-dashboard-api: ok');
  } finally {
    await close(server);
  }
})();

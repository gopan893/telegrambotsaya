'use strict';

const assert = require('assert');
const express = require('express');
const dashboard = require('../src/dashboard');

function createMemoryStorage() {
  const data = new Map();
  return {
    async safeRead(key, fallback) {
      return data.has(key) ? data.get(key) : fallback;
    },
    async safeWrite(key, value) {
      data.set(key, value);
      return true;
    },
    getStorageStatus() {
      return {
        configuredDriver: 'json',
        activeDriver: 'json',
        driver: 'json',
        postgres: { configured: false, available: false, tableReady: false, status: 'unavailable' },
        redis: { configured: false, available: false, status: 'unavailable' },
        fallbackActive: true,
        fallbackReason: 'test memory storage',
        jsonFallbackAvailable: true
      };
    },
    isPostgresEnabled() {
      return false;
    }
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const app = express();
  app.use(express.json());

  const env = {
    DASHBOARD_ENABLED: 'true',
    DASHBOARD_ADMIN_TOKEN: 'dash-secret',
    OWNER_CHAT_ID: 'owner'
  };
  const storageManager = createMemoryStorage();
  dashboard.registerDashboardRoutes(app, {
    env,
    storageManager,
    aiOS: {
      unifiedMemory: {
        listMemories: () => [
          { id: 'm_project', userId: 'owner', workspaceId: 'ws_placeholder', type: 'semantic', content: 'project memory' },
          { id: 'm_personal', userId: 'owner', type: 'semantic', content: 'personal memory' }
        ]
      }
    },
    ensureUser: userId => ({ id: userId, aios: {} }),
    getUsersSnapshot: () => ({ owner: { lastSeenAt: 'now' }, user2: { lastSeenAt: 'later' } })
  });

  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await requestJson(baseUrl, '/api/dashboard/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(JSON.stringify(health.body).includes('dash-secret'), false);

    const denied = await requestJson(baseUrl, '/api/dashboard/workspaces');
    assert.strictEqual(denied.status, 401);

    const workspaces = await requestJson(baseUrl, '/api/dashboard/workspaces?actorId=owner', { token: 'dash-secret' });
    assert.strictEqual(workspaces.status, 200);
    assert.ok(Array.isArray(workspaces.body.items));

    const create = await requestJson(baseUrl, '/api/dashboard/workspaces/create', {
      method: 'POST',
      token: 'dash-secret',
      body: { actorId: 'owner', name: 'Dashboard Project', type: 'project' }
    });
    assert.strictEqual(create.status, 200);
    const workspaceId = create.body.workspace.id;
    assert.ok(workspaceId);
    const items = await storageManager.safeRead('workspaces', []);
    items.push({
      id: 'ws_filter_target',
      name: 'Filter Target',
      description: '',
      type: 'project',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active', addedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null
    });
    await storageManager.safeWrite('workspaces', items);

    const addMember = await requestJson(baseUrl, `/api/dashboard/workspaces/${workspaceId}/members/add`, {
      method: 'POST',
      token: 'dash-secret',
      body: { actorId: 'owner', userId: 'user2', role: 'viewer' }
    });
    assert.strictEqual(addMember.status, 200);

    const permission = await requestJson(baseUrl, `/api/dashboard/permissions/me?workspaceId=${encodeURIComponent(workspaceId)}&actorId=user2`, { token: 'dash-secret' });
    assert.strictEqual(permission.status, 200);
    assert.strictEqual(permission.body.role, 'viewer');
    assert.strictEqual(permission.body.canRead, true);
    assert.strictEqual(permission.body.canWrite, false);

    const roleChange = await requestJson(baseUrl, `/api/dashboard/workspaces/${workspaceId}/members/role`, {
      method: 'POST',
      token: 'dash-secret',
      body: { actorId: 'owner', userId: 'user2', role: 'editor' }
    });
    assert.strictEqual(roleChange.status, 200);

    const removeMember = await requestJson(baseUrl, `/api/dashboard/workspaces/${workspaceId}/members/remove`, {
      method: 'POST',
      token: 'dash-secret',
      body: { actorId: 'owner', userId: 'user2' }
    });
    assert.strictEqual(removeMember.status, 200);

    const deniedOverview = await requestJson(baseUrl, `/api/dashboard/users/owner/overview?workspaceId=${encodeURIComponent(workspaceId)}&actorId=outsider`, { token: 'dash-secret' });
    assert.strictEqual(deniedOverview.status, 403);

    const filtered = await requestJson(baseUrl, `/api/dashboard/user/owner/memories?workspaceId=${encodeURIComponent('ws_filter_target')}&actorId=owner`, { token: 'dash-secret' });
    assert.strictEqual(filtered.status, 200);
    assert.deepStrictEqual((filtered.body.items || []).map(item => item.id), []);

    const audit = await requestJson(baseUrl, `/api/dashboard/audit?workspaceId=${encodeURIComponent(workspaceId)}&decision=denied`, { token: 'dash-secret' });
    assert.strictEqual(audit.status, 200);
    assert.ok((audit.body.items || []).some(item => item.decision === 'denied'));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('test-workspace-dashboard-api: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

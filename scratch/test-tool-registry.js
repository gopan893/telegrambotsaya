'use strict';

const assert = require('assert');
const tools = require('../src/tools');

function createServices() {
  const now = new Date().toISOString();
  const db = {
    workspaces: [{
      id: 'ws_tools',
      name: 'Tools Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }],
      createdAt: now,
      updatedAt: now
    }]
  };
  return {
    actorId: 'owner',
    actorType: 'test',
    workspaceId: 'ws_tools',
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => (Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback),
      safeWrite: async (key, value) => {
        db[key] = value;
        return value;
      },
      getRepositories: () => ({})
    },
    __db: db
  };
}

(async () => {
  const services = createServices();
  await tools.builtinTools.registerBuiltInTools(services, { force: true });

  const registered = await tools.toolRegistry.registerTool({
    id: 'utility.echo',
    name: 'Echo Tool',
    description: 'Echo sanitized input.',
    category: 'utility',
    riskLevel: 'low',
    permissionsRequired: ['read'],
    requiresApproval: false
  }, async (input) => ({ ok: true, result: { input } }), services);
  assert.equal(registered.ok, true, registered.error);

  const listed = await tools.toolRegistry.listTools({ q: 'echo' }, services);
  assert.ok(listed.some(tool => tool.id === 'utility.echo'));

  const found = await tools.toolRegistry.getTool('utility.echo', services);
  assert.equal(found.name, 'Echo Tool');

  const disabled = await tools.toolRegistry.disableTool('utility.echo', services);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.tool.enabled, false);

  const enabled = await tools.toolRegistry.enableTool('utility.echo', services);
  assert.equal(enabled.ok, true);
  assert.equal(enabled.tool.enabled, true);

  const invalid = tools.toolRegistry.validateToolDefinition({
    id: '',
    name: 'Invalid'
  });
  assert.equal(invalid.ok, false);

  const builtin = await tools.toolRegistry.getTool('weather.lookup', services);
  assert.ok(builtin, 'weather builtin should be registered even when unavailable');
  assert.equal(builtin.enabled, false);
  assert.equal(builtin.unavailableReason, 'OPENWEATHER_API_KEY_MISSING');

  const secretMeta = tools.toolRegistry.validateToolDefinition({
    id: 'utility.bad',
    name: 'Bad',
    description: 'postgresql://user:pass@host/db',
    category: 'utility'
  });
  assert.equal(secretMeta.ok, false);

  const summary = await tools.toolRegistry.buildToolRegistrySummary(services);
  assert.ok(summary.total >= 1);

  console.log('test-tool-registry: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

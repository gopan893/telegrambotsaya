'use strict';

const assert = require('assert');
const tools = require('../src/tools');

function createServices() {
  const now = new Date().toISOString();
  const db = {
    workspaces: [{
      id: 'ws_gov',
      name: 'Governance Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'admin', role: 'admin', status: 'active' },
        { userId: 'editor', role: 'editor', status: 'active' },
        { userId: 'viewer', role: 'viewer', status: 'active' }
      ],
      createdAt: now,
      updatedAt: now
    }]
  };
  return {
    actorId: 'owner',
    actorType: 'test',
    workspaceId: 'ws_gov',
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
  await tools.toolRegistry.registerTool({
    id: 'utility.read',
    name: 'Read Tool',
    category: 'utility',
    riskLevel: 'low',
    permissionsRequired: ['read'],
    requiresApproval: false,
    rateLimit: { windowMs: 60000, max: 1 }
  }, async () => ({ ok: true, result: { ok: true } }), services);
  await tools.toolRegistry.registerTool({
    id: 'goal.progress.update.test',
    name: 'Write Tool',
    category: 'goal',
    riskLevel: 'medium',
    permissionsRequired: ['write'],
    requiresApproval: true
  }, async () => ({ ok: true }), services);
  await tools.toolRegistry.registerTool({
    id: 'danger.test',
    name: 'Danger Tool',
    category: 'ops',
    riskLevel: 'danger',
    permissionsRequired: ['danger'],
    requiresApproval: true
  }, async () => ({ ok: true }), services);

  const readTool = await tools.toolRegistry.getTool('utility.read', services);
  const readDecision = await tools.toolGovernance.buildToolGovernanceDecision(readTool, { q: 'ok' }, {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(readDecision.allowed, true);
  assert.equal(readDecision.requiresApproval, false);

  const writeTool = await tools.toolRegistry.getTool('goal.progress.update.test', services);
  const writeDecision = await tools.toolGovernance.buildToolGovernanceDecision(writeTool, { goalId: 'g1', progress: 20 }, {
    actorId: 'editor',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(writeDecision.allowed, true);
  assert.equal(writeDecision.requiresApproval, true);

  const viewerWrite = await tools.toolGovernance.buildToolGovernanceDecision(writeTool, { goalId: 'g1', progress: 20 }, {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(viewerWrite.allowed, false);

  const dangerTool = await tools.toolRegistry.getTool('danger.test', services);
  const dangerEditor = await tools.toolGovernance.buildToolGovernanceDecision(dangerTool, {}, {
    actorId: 'editor',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(dangerEditor.allowed, false);

  const dangerOwner = await tools.toolGovernance.buildToolGovernanceDecision(dangerTool, {}, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(dangerOwner.allowed, true);
  assert.equal(dangerOwner.requiresApproval, true);

  const secret = tools.toolGovernance.validateToolInput(readTool, { token: 'sk-test-secret-value-1234567890' });
  assert.equal(secret.ok, false);

  const limited = await tools.toolGovernance.buildToolGovernanceDecision(readTool, { q: 'second' }, {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_gov'
  }, services);
  assert.equal(limited.allowed, false);
  assert.equal(limited.reason, 'TOOL_RATE_LIMITED');

  console.log('test-tool-governance: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const serializers = require('../src/dashboard/dashboard-serializers');
const tools = require('../src/tools');
const executor = require('../src/executor');

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createServices() {
  const now = new Date().toISOString();
  const db = {
    workspaces: [{
      id: 'ws_tool_dash',
      name: 'Tool Dashboard Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'editor', role: 'editor', status: 'active' },
        { userId: 'viewer', role: 'viewer', status: 'active' }
      ],
      createdAt: now,
      updatedAt: now
    }]
  };
  return {
    actorId: 'owner',
    actorType: 'dashboard',
    workspaceId: 'ws_tool_dash',
    env: { OWNER_CHAT_ID: 'owner', DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'dash-token' },
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

  const reqNoToken = { headers: {}, app: { locals: { dashboardEnv: services.env } } };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const reqToken = { headers: { authorization: 'Bearer dash-token' }, app: { locals: { dashboardEnv: services.env } } };
  const resToken = createMockRes();
  let authed = false;
  dashboardAuth.requireDashboardAuth(reqToken, resToken, () => { authed = true; });
  assert.equal(authed, true);

  await tools.toolRegistry.registerTool({
    id: 'utility.preview',
    name: 'Preview Tool',
    category: 'utility',
    riskLevel: 'low',
    permissionsRequired: ['read'],
    requiresApproval: false
  }, async (input) => ({ ok: true, result: { echoed: input.text || '' } }), services);
  await tools.toolRegistry.registerTool({
    id: 'planner.write.test',
    name: 'Write Tool',
    category: 'planner',
    riskLevel: 'medium',
    permissionsRequired: ['write'],
    requiresApproval: true
  }, async () => ({ ok: true, result: { changed: true } }), services);

  const listed = await tools.toolRegistry.listTools({}, services);
  assert.ok(listed.some(tool => tool.id === 'utility.preview'));

  const beforeRuns = await tools.toolAudit.listToolRuns({}, services);
  const preview = await tools.toolRunner.previewToolRun('utility.preview', { text: 'hello' }, {
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_tool_dash'
  }, services);
  assert.equal(preview.ok, true);
  const afterPreviewRuns = await tools.toolAudit.listToolRuns({}, services);
  assert.equal(afterPreviewRuns.length, beforeRuns.length, 'preview must not execute tool run');

  const directWrite = await tools.toolRunner.runTool('planner.write.test', { ok: true }, {
    actorId: 'editor',
    userId: 'owner',
    workspaceId: 'ws_tool_dash'
  }, services);
  assert.equal(directWrite.ok, false);
  assert.equal(directWrite.requiresApproval, true);

  const proposal = await tools.toolRunner.buildToolExecutionProposal('planner.write.test', { ok: true }, {
    actorId: 'editor',
    userId: 'owner',
    workspaceId: 'ws_tool_dash',
    sourceType: 'dashboard',
    sourceId: 'planner.write.test'
  }, services);
  assert.equal(proposal.ok, true, proposal.reason);
  assert.equal(proposal.proposal.status, 'pending_approval');

  const approved = await executor.executionQueue.approveExecution(proposal.proposal.id, 'editor', services);
  assert.equal(approved.ok, true, approved.reason);
  const run = await executor.approvedRunner.runApprovedExecution(proposal.proposal.id, { ...services, actorId: 'editor' });
  assert.equal(run.ok, true, run.reason);

  const disabled = await tools.toolRegistry.disableTool('utility.preview', services);
  assert.equal(disabled.ok, true);
  const enabled = await tools.toolRegistry.enableTool('utility.preview', services);
  assert.equal(enabled.ok, true);
  const audit = await tools.toolAudit.listToolAudit({ limit: 100 }, services);
  assert.ok(audit.some(item => item.action === 'tool/disabled'));
  assert.ok(audit.some(item => item.action === 'tool/enabled'));

  const sanitized = serializers.sanitizeToolMetadata({
    id: 'bad',
    description: 'Bearer abcdefghijklmnopqrstuvwxyz123456'
  });
  assert.ok(!/abcdefghijklmnopqrstuvwxyz/.test(JSON.stringify(sanitized)));

  console.log('test-tool-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

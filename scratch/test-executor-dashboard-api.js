'use strict';

const assert = require('assert');
const dashboardAuth = require('../src/dashboard/dashboard-auth');
const dashboardGuards = require('../src/dashboard/dashboard-guards');
const serializers = require('../src/dashboard/dashboard-serializers');
const executor = require('../src/executor');
const planner = require('../src/planner');

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
    workspaces: [
      {
        id: 'ws_dash',
        name: 'Dashboard Workspace',
        type: 'project',
        ownerId: 'owner',
        members: [
          { userId: 'owner', role: 'owner', status: 'active' },
          { userId: 'editor', role: 'editor', status: 'active' },
          { userId: 'viewer', role: 'viewer', status: 'active' }
        ],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'ws_other',
        name: 'Other Workspace',
        type: 'project',
        ownerId: 'other',
        members: [{ userId: 'other', role: 'owner', status: 'active' }],
        createdAt: now,
        updatedAt: now
      }
    ]
  };
  const services = {
    actorId: 'owner',
    actorType: 'dashboard',
    env: { OWNER_CHAT_ID: 'owner', DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'dash-token' },
    storageManager: {
      safeRead: async (key, fallback) => (Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback),
      safeWrite: async (key, value) => {
        db[key] = value;
        return value;
      },
      getRepositories: () => ({})
    }
  };
  services.__db = db;
  return services;
}

async function createTaskProposal(services) {
  const plan = await planner.plannerEngine.createPlan({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash',
    title: 'Dashboard API plan',
    status: 'active'
  }, services);
  const task = await planner.taskOrchestrator.createTask({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash',
    planId: plan.plan.id,
    title: 'Dashboard task'
  }, services);
  const proposal = await executor.executionPlanner.proposeFromPlannerTask(task.task.id, { actorId: 'owner' }, services);
  return { task: task.task, proposal: proposal.proposal };
}

(async () => {
  const services = createServices();

  const reqNoToken = {
    headers: {},
    app: { locals: { dashboardEnv: services.env } }
  };
  const resNoToken = createMockRes();
  dashboardAuth.requireDashboardAuth(reqNoToken, resNoToken, () => {});
  assert.equal(resNoToken.statusCode, 401);

  const reqWithToken = {
    headers: { authorization: 'Bearer dash-token' },
    app: { locals: { dashboardEnv: services.env } }
  };
  const resWithToken = createMockRes();
  let called = false;
  dashboardAuth.requireDashboardAuth(reqWithToken, resWithToken, () => { called = true; });
  assert.equal(called, true);

  const { task, proposal } = await createTaskProposal(services);
  const pending = await executor.executionQueue.listPendingApprovals({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash'
  }, services);
  assert.ok(pending.some(item => item.id === proposal.id));

  const before = await planner.taskOrchestrator.getTask(task.id, services);
  assert.equal(before.status, 'todo');

  const unapprovedRun = await executor.approvedRunner.runApprovedExecution(proposal.id, { ...services, actorId: 'owner' });
  assert.equal(unapprovedRun.ok, false);

  const approved = await executor.executionQueue.approveExecution(proposal.id, 'owner', services);
  assert.equal(approved.ok, true);
  const run = await executor.approvedRunner.runApprovedExecution(proposal.id, { ...services, actorId: 'owner' });
  assert.equal(run.ok, true);

  const cancel = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash',
    title: 'Cancel from dashboard',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  const cancelled = await executor.executionQueue.cancelExecution(cancel.proposal.id, 'owner', services);
  assert.equal(cancelled.ok, true);

  const reject = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash',
    title: 'Reject from dashboard',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  const rejected = await executor.executionQueue.rejectExecution(reject.proposal.id, 'owner', 'dashboard reject', services);
  assert.equal(rejected.ok, true);

  const otherProposal = await executor.executionPlanner.createExecutionProposal({
    actorId: 'other',
    userId: 'other',
    workspaceId: 'ws_other',
    title: 'Other workspace proposal',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, { ...services, actorId: 'other' });
  const cross = await executor.executorGuards.enforceWorkspaceExecutionAccess(otherProposal.proposal, { ...services, actorId: 'owner' }, 'read');
  assert.equal(cross.ok, false);

  const secret = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_dash',
    title: 'Secret dashboard proposal',
    proposedActions: [{ type: 'report.health.export', payload: { DATABASE_URL: 'postgresql://u:p@host/db' } }]
  }, services);
  assert.equal(secret.ok, false);

  const sanitized = serializers.sanitizeExecutionProposal({
    ...proposal,
    description: 'Bearer abcdefghijklmnopqrstuvwxyz123456'
  });
  assert.ok(!/abcdefghijklmnopqrstuvwxyz/.test(JSON.stringify(sanitized)));
  assert.equal(dashboardGuards.preventSecretLeak('postgresql://user:pass@host/db'), 'postgresql://***:***@host/db');

  console.log('test-executor-dashboard-api: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

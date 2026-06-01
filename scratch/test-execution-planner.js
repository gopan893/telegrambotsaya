'use strict';

const assert = require('assert');
const executor = require('../src/executor');
const planner = require('../src/planner');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_test',
      name: 'Test Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'editor', role: 'editor', status: 'active' },
        { userId: 'viewer', role: 'viewer', status: 'active' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  };
  const services = {
    actorId: 'owner',
    actorType: 'test',
    env: { OWNER_CHAT_ID: 'owner' },
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

(async () => {
  const services = createServices();

  const manual = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_test',
    sourceType: 'manual',
    title: 'Export health report',
    description: 'Prepare a safe health report export.',
    proposedActions: [{
      type: 'report.health.export',
      targetType: 'report',
      description: 'Export sanitized health report.',
      payload: {},
      riskLevel: 'low'
    }]
  }, services);
  assert.equal(manual.ok, true, manual.reason);
  assert.equal(manual.proposal.status, 'pending_approval');
  assert.equal(manual.proposal.requiresApproval, true);

  const plan = await planner.plannerEngine.createPlan({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_test',
    title: 'Executor test plan',
    status: 'active'
  }, services);
  assert.equal(plan.ok, true, plan.reason);
  const task = await planner.taskOrchestrator.createTask({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_test',
    planId: plan.plan.id,
    title: 'Mark me done by approved execution'
  }, services);
  assert.equal(task.ok, true, task.reason);

  const fromTask = await executor.executionPlanner.proposeFromPlannerTask(task.task.id, { actorId: 'owner' }, services);
  assert.equal(fromTask.ok, true, fromTask.reason);
  const unchanged = await planner.taskOrchestrator.getTask(task.task.id, services);
  assert.equal(unchanged.status, 'todo', 'proposal creation must not execute task');

  const risk = executor.executionPlanner.estimateRisk([{ type: 'ops.benchmark.light', riskLevel: 'medium' }]);
  assert.equal(risk, 'medium');

  const secret = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_test',
    title: 'Bad proposal',
    proposedActions: [{
      type: 'report.health.export',
      payload: { token: 'sk-test-secret-token-value' }
    }]
  }, services);
  assert.equal(secret.ok, false);
  assert.match(secret.reason || secret.error || '', /SECRET_LIKE_PAYLOAD_REJECTED/);

  const expiring = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_test',
    title: 'Expired proposal',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  assert.equal(expiring.ok, true);
  const expired = await executor.executionPlanner.expireOldProposals(services);
  assert.ok(expired.expired >= 1);

  const denied = await executor.executionPlanner.createExecutionProposal({
    actorId: 'viewer',
    userId: 'owner',
    workspaceId: 'ws_test',
    title: 'Viewer write attempt',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 403);

  console.log('test-execution-planner: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

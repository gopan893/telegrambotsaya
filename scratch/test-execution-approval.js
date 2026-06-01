'use strict';

const assert = require('assert');
const executor = require('../src/executor');
const planner = require('../src/planner');
const auditLog = require('../src/dashboard/audit-log');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_exec',
      name: 'Execution Workspace',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'admin', role: 'admin', status: 'active' },
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

async function createTaskProposal(services) {
  const plan = await planner.plannerEngine.createPlan({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    title: 'Approval plan',
    status: 'active'
  }, services);
  const task = await planner.taskOrchestrator.createTask({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    planId: plan.plan.id,
    title: 'Approved runner task'
  }, services);
  const proposal = await executor.executionPlanner.proposeFromPlannerTask(task.task.id, { actorId: 'owner' }, services);
  return { task: task.task, proposal: proposal.proposal };
}

(async () => {
  const services = createServices();

  const { task, proposal } = await createTaskProposal(services);
  const viewerApprove = await executor.executionQueue.approveExecution(proposal.id, 'viewer', services);
  assert.equal(viewerApprove.ok, false);
  assert.equal(viewerApprove.status, 403);

  const editorApprove = await executor.executionQueue.approveExecution(proposal.id, 'editor', services);
  assert.equal(editorApprove.ok, true, editorApprove.reason);
  assert.equal(editorApprove.proposal.status, 'approved');

  const beforeRun = await planner.taskOrchestrator.getTask(task.id, services);
  assert.equal(beforeRun.status, 'todo', 'approval must not run automatically');

  const run = await executor.approvedRunner.runApprovedExecution(proposal.id, { ...services, actorId: 'editor' });
  assert.equal(run.ok, true, run.reason);
  const afterRun = await planner.taskOrchestrator.getTask(task.id, services);
  assert.equal(afterRun.status, 'done');

  const rejectedProposal = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    title: 'Reject me',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  const rejected = await executor.executionQueue.rejectExecution(rejectedProposal.proposal.id, 'owner', 'test reject', services);
  assert.equal(rejected.ok, true);
  const rejectedRun = await executor.approvedRunner.runApprovedExecution(rejectedProposal.proposal.id, { ...services, actorId: 'owner' });
  assert.equal(rejectedRun.ok, false);
  assert.match(rejectedRun.reason, /NOT_APPROVED_rejected/);

  const unapproved = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    title: 'Do not run yet',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  const unapprovedRun = await executor.approvedRunner.runApprovedExecution(unapproved.proposal.id, { ...services, actorId: 'owner' });
  assert.equal(unapprovedRun.ok, false);
  assert.match(unapprovedRun.reason, /NOT_APPROVED_pending_approval/);

  const expired = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    title: 'Expired approval',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, services);
  const expiredApprove = await executor.executionQueue.approveExecution(expired.proposal.id, 'owner', services);
  assert.equal(expiredApprove.ok, false);
  assert.equal(expiredApprove.reason, 'PROPOSAL_EXPIRED');

  const danger = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_exec',
    title: 'Danger proposal',
    proposedActions: [{
      type: 'goal.progress.update',
      targetType: 'goal',
      targetId: 'goal_1',
      description: 'danger update request',
      payload: { goalId: 'goal_1', progress: 10 },
      riskLevel: 'danger'
    }]
  }, services);
  assert.equal(danger.ok, true);
  const dangerEditor = await executor.executionQueue.approveExecution(danger.proposal.id, 'editor', services);
  assert.equal(dangerEditor.ok, false);
  const dangerOwner = await executor.executionQueue.approveExecution(danger.proposal.id, 'owner', services);
  assert.equal(dangerOwner.ok, true);

  const logs = await auditLog.listAuditLogs({ limit: 100 }, services);
  assert.ok(logs.some(item => item.action === 'executor/approved'));
  assert.ok(logs.some(item => item.action === 'executor/run_completed'));

  console.log('test-execution-approval: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

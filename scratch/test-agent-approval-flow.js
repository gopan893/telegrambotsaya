'use strict';

const assert = require('assert');
const executor = require('../src/executor');
const approval = require('../src/agents/agent-approval-flow');

function services() {
  const db = {
    workspaces: [{
      id: 'ws_approval',
      name: 'Approval',
      type: 'project',
      ownerId: 'owner',
      members: [
        { userId: 'owner', role: 'owner', status: 'active' },
        { userId: 'editor', role: 'editor', status: 'active' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  };
  return {
    actorId: 'owner',
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; },
      getRepositories: () => ({})
    },
    __db: db
  };
}

(async () => {
  assert.equal(approval.validateHumanApprovalActor('agent:executor').ok, false);
  assert.equal(approval.validateHumanApprovalActor('owner').ok, true);

  const svc = services();
  const created = await executor.executionPlanner.createExecutionProposal({
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_approval',
    title: 'Approval boundary',
    proposedActions: [{ type: 'report.health.export', payload: {}, riskLevel: 'low' }]
  }, svc);
  assert.equal(created.ok, true, created.reason);

  const agentApprove = await executor.executionQueue.approveExecution(created.proposal.id, 'agent:executor', svc);
  assert.equal(agentApprove.ok, false);
  assert.equal(agentApprove.reason, 'HUMAN_APPROVER_REQUIRED');

  const humanApprove = await executor.executionQueue.approveExecution(created.proposal.id, 'owner', svc);
  assert.equal(humanApprove.ok, true, humanApprove.reason);
  assert.equal(humanApprove.proposal.status, 'approved');

  console.log('test-agent-approval-flow: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

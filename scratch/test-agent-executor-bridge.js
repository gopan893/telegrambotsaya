'use strict';

const assert = require('assert');
const agents = require('../src/agents');
const executor = require('../src/executor');

function services() {
  const db = {
    workspaces: [{
      id: 'ws_phase25',
      name: 'Phase 25',
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
    actorType: 'test',
    env: { OWNER_CHAT_ID: 'owner' },
    __agentMemory: db,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; },
      getRepositories: () => ({})
    },
    auditLog: { async recordAuditLog(entry) { db.audit = db.audit || []; db.audit.push(entry); return entry; } },
    __db: db
  };
}

(async () => {
  const svc = services();
  const result = await agents.agentExecutorBridge.createProposalFromNaturalText('jalankan backup sekarang', {
    workspaceId: 'ws_phase25',
    userId: 'owner',
    source: 'natural_chat',
    createdByAgentId: 'executor'
  }, svc);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.proposal.status, 'pending_approval');
  assert.equal(result.proposal.proposedActions[0].type, 'backup.create');

  const proposal = await executor.executionStore.getExecutionItem(executor.executionStore.EXECUTOR_PROPOSALS_KEY, result.proposal.id, svc);
  assert.equal(proposal.status, 'pending_approval', 'proposal creation must not run');

  const duplicate = await agents.agentExecutorBridge.createProposalFromActionPlan(result.actionPlan.id, svc);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.reused, true);
  assert.equal(duplicate.proposal.id, result.proposal.id);

  const restore = await agents.agentExecutorBridge.createProposalFromNaturalText('restore backup lama', {
    workspaceId: 'ws_phase25',
    userId: 'owner',
    source: 'natural_chat',
    createdByAgentId: 'executor'
  }, svc);
  assert.equal(restore.ok, true, restore.reason);
  assert.equal(restore.proposal.riskLevel, 'danger');
  assert.equal(restore.preflight.ownerAdminRequired, true);

  console.log('test-agent-executor-bridge: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

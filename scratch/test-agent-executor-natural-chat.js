'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function services() {
  const db = {
    workspaces: [{
      id: 'ws_natural_exec',
      name: 'Natural Exec',
      type: 'project',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }]
  };
  return {
    actorId: 'owner',
    env: { OWNER_CHAT_ID: 'owner' },
    __agentMemory: db,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; },
      getRepositories: () => ({})
    },
    auditLog: { async recordAuditLog(entry) { db.audit = db.audit || []; db.audit.push(entry); return entry; } }
  };
}

(async () => {
  const svc = services();
  const need = agents.agentActionDetector.shouldUseAgentExecutor('jalankan backup sekarang', { workspaceId: 'ws_natural_exec', userId: 'owner' }, svc);
  assert.equal(need.needed, true);
  const result = await agents.agentExecutorBridge.createProposalFromNaturalText('jalankan backup sekarang', {
    workspaceId: 'ws_natural_exec',
    userId: 'owner',
    source: 'natural_chat'
  }, svc);
  assert.equal(result.ok, true, result.reason);
  const reply = agents.agentApprovalFlow.formatProposalCreatedReply(result);
  assert.match(reply, /Belum dijalankan/);
  assert.match(reply, /\/approve/);
  assert.match(reply, /\/runexec/);
  assert.ok(!/Smart Agent Router|Mode:|#visual-analysis|API Vision/i.test(reply));

  const restore = await agents.agentExecutorBridge.createProposalFromNaturalText('restore backup lama', {
    workspaceId: 'ws_natural_exec',
    userId: 'owner',
    source: 'natural_chat'
  }, svc);
  assert.equal(restore.ok, true, restore.reason);
  assert.equal(restore.proposal.riskLevel, 'danger');

  const secret = await agents.agentExecutorBridge.createActionPlanFromText('jalankan backup dengan token sk-secret-value', {
    workspaceId: 'ws_natural_exec',
    userId: 'owner',
    source: 'natural_chat'
  }, svc).catch(err => ({ ok: false, reason: err.code || err.message }));
  assert.equal(secret.ok, false);

  console.log('test-agent-executor-natural-chat: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

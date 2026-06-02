'use strict';

const assert = require('assert');
const actionPlan = require('../src/agents/agent-action-plan');
const preflight = require('../src/agents/executor-preflight-review');
const builder = require('../src/agents/proposal-builder');

(() => {
  assert.throws(() => actionPlan.buildActionPlan({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Backup token sk-abcdefghijklmnop should be rejected',
    actions: [{ type: 'backup.create', description: 'safe backup', payload: {}, riskLevel: 'medium' }]
  }), /ACTION_PLAN_SECRET_REJECTED/);

  const plan = actionPlan.buildActionPlan({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Backup workspace',
    actions: [{ type: 'backup.create', description: 'safe backup', payload: {}, riskLevel: 'medium' }]
  });
  const payload = builder.buildProposalPayload(plan, { riskLevel: 'medium', approvalRequired: true });
  assert.equal(payload.sourceType, 'agent_action_plan');
  assert.equal(payload.proposedActions[0].type, 'backup.create');
  assert.ok(!JSON.stringify(payload).includes('DATABASE_URL'));

  const reply = builder.summarizeProposalForTelegram({ id: 'exec_1', title: 'Backup workspace', status: 'pending_approval', riskLevel: 'medium' }, plan);
  assert.match(reply, /Approve: \/approve exec_1/);
  assert.match(reply, /Run setelah approve: \/runexec exec_1/);

  console.log('test-proposal-builder: ok');
})();

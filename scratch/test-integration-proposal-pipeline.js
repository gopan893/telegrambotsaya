'use strict';

const assert = require('assert');
const integrations = require('../src/integrations');

function createServices() {
  const db = {
    workspaces: [{
      id: 'ws_personal_owner',
      name: 'Owner Workspace',
      type: 'personal',
      ownerId: 'owner',
      members: [{ userId: 'owner', role: 'owner', status: 'active' }]
    }]
  };
  return {
    actorId: 'owner',
    userId: 'owner',
    actorRole: 'owner',
    workspaceId: 'ws_personal_owner',
    env: { EXTERNAL_WEBHOOK_URL: 'https://example.com/hook' },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } },
    __db: db
  };
}

(async () => {
  const services = createServices();
  const created = await integrations.proposalPipeline.createIntegrationProposalPipeline({
    connectorId: 'webhook',
    action: 'webhook.send',
    payload: { text: 'pipeline test' },
    context: {
      actorId: 'owner',
      userId: 'owner',
      workspaceId: 'ws_personal_owner',
      actorRole: 'owner'
    }
  }, services);
  assert.equal(created.ok, true);
  assert.equal(created.pipeline.stages.planCreated, true);

  const preflight = await integrations.proposalPipeline.runIntegrationPreflight(created.pipeline.id, services);
  assert.equal(preflight.ok, true, preflight.reason);
  assert.equal(preflight.pipeline.stages.preflightPassed, true);

  const dry = await integrations.proposalPipeline.runIntegrationDryRun(created.pipeline.id, services);
  assert.equal(dry.ok, true, dry.reason);
  assert.equal(dry.pipeline.stages.dryRunPassed, true);
  assert.equal(dry.dryRun.result.dryRun.externalWriteBlocked, true);

  const evaluated = await integrations.proposalPipeline.runIntegrationEvaluationGate(created.pipeline.id, services);
  assert.equal(evaluated.ok, true, evaluated.reason);
  assert.equal(evaluated.pipeline.stages.evaluationPassed, true);

  const proposal = await integrations.proposalPipeline.createExecutorProposalAfterGate(created.pipeline.id, services);
  assert.equal(proposal.ok, true, proposal.reason);
  assert.equal(proposal.pipeline.stages.proposalCreated, true);
  assert.equal(proposal.proposal.proposedActions[0].type, 'integration.connector.run');

  const forced = await integrations.proposalPipeline.createIntegrationProposalPipeline({
    connectorId: 'webhook',
    action: 'webhook.send',
    payload: { text: 'blocked', __forceEvaluationFail: true },
    context: {
      actorId: 'owner',
      userId: 'owner',
      workspaceId: 'ws_personal_owner',
      actorRole: 'owner'
    }
  }, services);
  assert.equal(forced.ok, true);
  await integrations.proposalPipeline.runIntegrationPreflight(forced.pipeline.id, services);
  await integrations.proposalPipeline.runIntegrationDryRun(forced.pipeline.id, services);
  const failedEval = await integrations.proposalPipeline.runIntegrationEvaluationGate(forced.pipeline.id, services);
  assert.equal(failedEval.ok, false);
  const blockedProposal = await integrations.proposalPipeline.createExecutorProposalAfterGate(forced.pipeline.id, services);
  assert.equal(blockedProposal.ok, false);
  assert.equal(blockedProposal.reason, 'EVALUATION_GATE_REQUIRED');

  assert.ok(!/EXTERNAL_WEBHOOK_URL|https:\/\/example.com\/hook/.test(JSON.stringify(services.__db)));

  console.log('test-integration-proposal-pipeline: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

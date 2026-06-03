'use strict';

const assert = require('assert');
const agents = require('../src/agents');
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
    env: {
      GITHUB_TOKEN: 'set',
      GITHUB_OWNER: 'owner',
      GITHUB_REPO: 'repo',
      EXTERNAL_WEBHOOK_URL: 'https://example.com/hook'
    },
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

  const readOnlyRoute = agents.agentRouter.routeMessage('cek issue GitHub project saya', {}, services);
  assert.ok(readOnlyRoute.topics.includes('github'));
  const readOnlyIntent = agents.agentActionDetector.detectActionIntent('cek issue GitHub project saya', {}, services);
  assert.equal(readOnlyIntent.hasActionIntent, false);

  const issueIntent = agents.agentActionDetector.detectActionIntent('buat issue GitHub untuk bug deploy Render', {}, services);
  assert.equal(issueIntent.hasActionIntent, true);
  assert.equal(issueIntent.actionType, 'integration.connector.run');
  assert.equal(issueIntent.targetId, 'github.issue.create');

  const issueRoute = agents.agentRouter.routeMessage('buat issue GitHub untuk bug deploy Render', {}, services);
  assert.ok(issueRoute.selectedAgents.includes('executor'));
  assert.equal(issueRoute.approvalRequired, true);

  const webhookRoute = agents.agentRouter.routeMessage('kirim webhook ke sistem external', {}, services);
  assert.ok(webhookRoute.selectedAgents.includes('executor'));
  assert.equal(webhookRoute.approvalRequired, true);

  const proposal = await integrations.connectorExecutor.executeConnectorAction('github', 'github.issue.create', {
    title: 'Deploy bug',
    body: 'Render deploy failed'
  }, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_personal_owner',
    actorRole: 'owner'
  }, services);
  assert.equal(proposal.ok, true, proposal.reason);
  assert.equal(proposal.proposal.status, 'pending_approval');
  assert.ok(!/issue sudah dibuat|ghp_secret|github_pat_secret/.test(JSON.stringify(proposal)));

  const evaluation = await agents.agentEvaluationV2.suite.runEvaluationCase('github_issue_create_proposal', services);
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.actionType, 'integration.connector.run');
  assert.equal(evaluation.approvalRequired, true);
  assert.equal(evaluation.didExecute, false);

  console.log('test-integration-execution-natural-chat: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

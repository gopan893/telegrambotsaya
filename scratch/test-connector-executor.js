'use strict';

const assert = require('assert');
const integrations = require('../src/integrations');

function createServices(extra = {}) {
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
    allowAnonymousIntegrationTests: false,
    env: {
      EXTERNAL_WEBHOOK_URL: 'https://example.com/hook',
      GITHUB_TOKEN: 'set',
      GITHUB_OWNER: 'owner',
      GITHUB_REPO: 'repo',
      GOOGLE_CLIENT_ID: 'client',
      GOOGLE_CLIENT_SECRET: 'set',
      GOOGLE_REDIRECT_URI: 'https://example.com/oauth',
      CLOUDFLARE_API_TOKEN: 'set',
      CLOUDFLARE_ACCOUNT_ID: 'acct',
      NAS_HEALTH_URL: 'https://example.com/health',
      ...(extra.env || {})
    },
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(db, key) ? db[key] : fallback,
      safeWrite: async (key, value) => { db[key] = value; return value; }
    },
    auditLog: {
      items: [],
      async recordAuditLog(entry) { this.items.push(entry); return entry; }
    },
    __db: db,
    ...extra
  };
}

(async () => {
  const services = createServices();
  const listed = integrations.connectorExecutor.listConnectorsSafe(services);
  assert.ok(listed.some(item => item.id === 'github'));
  assert.ok(listed.some(item => item.id === 'webhook'));
  assert.ok(!/GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|CLOUDFLARE_API_TOKEN/.test(JSON.stringify(listed)));

  const status = await integrations.connectorExecutor.executeConnectorAction('github', 'github.status', {}, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_personal_owner',
    actorRole: 'owner'
  }, services);
  assert.equal(status.ok, true);
  assert.equal(status.result.result.tokenConfigured, true);
  assert.ok(!/ghp_|set/.test(JSON.stringify(status.result.result.tokenConfigured ? status.result.result : {})));

  const dryRun = await integrations.connectorExecutor.runConnectorDryRun('webhook', 'webhook.send', { text: 'hello' }, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_personal_owner',
    actorRole: 'owner'
  }, services);
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.result.dryRun.externalWriteBlocked, true);

  const proposal = await integrations.connectorExecutor.executeConnectorAction('webhook', 'webhook.send', { text: 'hello' }, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_personal_owner',
    actorRole: 'owner'
  }, services);
  assert.equal(proposal.ok, true, proposal.reason);
  assert.ok(proposal.proposal.id.startsWith('exec_'));
  assert.equal(proposal.proposal.status, 'pending_approval');
  assert.equal(proposal.proposal.proposedActions[0].type, 'integration.connector.run');

  const rejectedSecret = await integrations.connectorExecutor.executeConnectorAction('webhook', 'webhook.send', {
    token: 'sk-abcdefghijklmnopqrstuvwxyz'
  }, {
    actorId: 'owner',
    userId: 'owner',
    workspaceId: 'ws_personal_owner',
    actorRole: 'owner'
  }, services);
  assert.equal(rejectedSecret.ok, false);
  assert.equal(rejectedSecret.reason, 'CONNECTOR_PAYLOAD_SECRET_REJECTED');

  const approvedBoundary = await integrations.connectorExecutor.runApprovedConnectorAction({
    connectorId: 'webhook',
    action: 'webhook.send',
    payload: { payload: { text: 'approved after human approval' } },
    userId: 'owner',
    workspaceId: 'ws_personal_owner'
  }, services);
  assert.equal(approvedBoundary.ok, true);
  assert.equal(approvedBoundary.result.externalWriteHandler, 'not_implemented_v1');

  console.log('test-connector-executor: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

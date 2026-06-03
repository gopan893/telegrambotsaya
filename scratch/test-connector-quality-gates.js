'use strict';

const assert = require('assert');
const integrations = require('../src/integrations');

function services(env = {}) {
  const mem = {};
  return {
    actorId: 'owner',
    userId: 'owner',
    actorRole: 'owner',
    workspaceId: 'ws_personal_owner',
    env,
    integrationConnectors: integrations.connectorExecutor,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } }
  };
}

(async () => {
  const missingSvc = services({});
  const missingStatus = integrations.connectorQualityGates.getConnectorQualityStatus('github', missingSvc);
  assert.equal(missingStatus.available, false);
  assert.equal(missingStatus.status, 'degraded');

  const blocked = await integrations.connectorQualityGates.blockIfQualityGateFailed('github', 'github.issue.create', missingSvc);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'CONNECTOR_WRITE_BLOCKED_UNTIL_CONFIGURED');

  const readOnlyAllowed = await integrations.connectorQualityGates.blockIfQualityGateFailed('github', 'github.status', missingSvc);
  assert.equal(readOnlyAllowed.ok, true);
  assert.equal(readOnlyAllowed.status.readOnlyOnly, true);

  const readySvc = services({ GITHUB_TOKEN: 'set', GITHUB_OWNER: 'owner', GITHUB_REPO: 'repo' });
  const readyStatus = integrations.connectorQualityGates.getConnectorQualityStatus('github', readySvc);
  assert.equal(readyStatus.available, true);
  assert.equal(readyStatus.status, 'ready');
  const gate = await integrations.connectorQualityGates.runIntegrationQualityGate('github', readySvc);
  assert.equal(gate.ok, true);
  assert.equal(gate.status.available, true);
  assert.ok(!/set|GITHUB_TOKEN/.test(JSON.stringify(gate.status)));

  console.log('test-connector-quality-gates: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

'use strict';

const assert = require('assert');
const integrations = require('../src/integrations');

function services() {
  const mem = {};
  return {
    actorId: 'owner',
    userId: 'owner',
    actorRole: 'owner',
    workspaceId: 'ws_personal_owner',
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } }
  };
}

(async () => {
  const svc = services();
  const testCase = integrations.integrationEvaluationGate.buildIntegrationEvaluationCase({
    connectorId: 'github',
    action: 'github.issue.create',
    text: 'buat issue GitHub untuk bug deploy Render',
    riskLevel: 'medium'
  });
  assert.equal(testCase.expectedApprovalRequired, true);
  assert.equal(testCase.expectedShouldNotExecute, true);
  assert.ok(testCase.mustNotContain.includes('ghp_'));

  const passed = await integrations.integrationEvaluationGate.runEvaluationGateForIntegration({
    connectorId: 'github',
    action: 'github.issue.create',
    text: 'buat issue GitHub untuk bug deploy Render',
    riskLevel: 'medium'
  }, svc);
  assert.equal(passed.ok, true, passed.reason);
  assert.equal(passed.report.status, 'passed');
  assert.equal(passed.report.scores.externalWriteApprovalScore, 100);

  const forced = await integrations.integrationEvaluationGate.runEvaluationGateForIntegration({
    connectorId: 'github',
    action: 'github.issue.create',
    payload: { __forceEvaluationFail: true },
    text: 'buat issue GitHub',
    riskLevel: 'medium'
  }, svc);
  assert.equal(forced.ok, false);
  assert.equal(forced.reason, 'FORCED_EVALUATION_FAILURE');

  const readOnly = await integrations.integrationEvaluationGate.runEvaluationGateForIntegration({
    connectorId: 'github',
    action: 'github.status',
    text: 'cek status GitHub',
    riskLevel: 'low'
  }, svc);
  assert.equal(readOnly.ok, true);
  assert.equal(readOnly.report.scores.noExternalWriteDryRunScore, 100);

  console.log('test-integration-evaluation-gate: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

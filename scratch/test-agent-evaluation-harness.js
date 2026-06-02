'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function services() {
  const mem = {};
  return {
    __agentMemory: mem,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { async recordAuditLog(entry) { this.items = this.items || []; this.items.push(entry); return entry; } }
  };
}

(async () => {
  const svc = services();
  const cases = await agents.agentEvaluationHarness.listEvaluationCases({}, svc);
  assert.ok(cases.length >= 8);
  const backup = await agents.agentEvaluationHarness.runEvaluationCase('eval_backup_proposal', svc);
  assert.equal(backup.ok, true);
  assert.equal(backup.actionType, 'backup.create');
  assert.equal(backup.approvalRequired, true);
  assert.ok(!/postgresql:\/\/|REDIS_URL=|TELEGRAM_TOKEN=/i.test(JSON.stringify(backup)));

  const suite = await agents.agentEvaluationHarness.runEvaluationSuite({ limit: 5 }, svc);
  assert.equal(suite.ok, true);
  assert.ok(suite.summary.total >= 5);
  assert.ok(suite.summary.average >= 40);

  console.log('test-agent-evaluation-harness: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

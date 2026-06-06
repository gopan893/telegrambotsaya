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
  const cases = await agents.agentEvaluationV2.suite.listEvaluationCases({}, svc);
  assert.ok(cases.some(item => item.id === 'teacher_anger_advice'), 'teacher golden case required');
  assert.ok(cases.some(item => item.id === 'teacher_followup_solution'), 'short follow-up golden case required');

  const teacher = await agents.agentEvaluationV2.suite.runEvaluationCase('teacher_anger_advice', svc);
  assert.equal(teacher.ok, true);
  assert.ok(teacher.selectedAgents.includes('reflection'));
  assert.ok(!teacher.selectedAgents.includes('coder'));
  assert.ok(teacher.score.domainRoutingScore >= 90);
  assert.ok(!/Python|regresi|deploy|debug/i.test(teacher.outputText));

  const backup = await agents.agentEvaluationV2.suite.runEvaluationCase('backup_action_proposal', svc);
  assert.equal(backup.actionType, 'backup.create');
  assert.equal(backup.approvalRequired, true);
  assert.equal(backup.didExecute, false);

  const suite = await agents.agentEvaluationV2.suite.runEvaluationSuite({}, svc);
  assert.equal(suite.ok, true);
  assert.ok(suite.summary.averageScore >= 80);
  assert.equal(suite.summary.qualityGateStatus, 'passed');
  const userFacingOutputs = suite.results.map(item => item.outputText).join('\n');
  assert.ok(!/sk-xxxx|postgresql:\/\/|rediss?:\/\/|\d{8,12}:[A-Za-z0-9_-]{20,}/i.test(userFacingOutputs));

  console.log('test-agent-evaluation-v2: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

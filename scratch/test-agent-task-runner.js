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
  const task = await agents.agentTaskStore.createTask({
    workspaceId: 'w1',
    userId: 'u1',
    assignedAgentId: 'security',
    type: 'risk_review',
    title: 'Restore safety',
    description: 'Apakah restore backup lama aman?',
    riskLevel: 'danger',
    requiresApproval: true
  }, svc);
  const done = await agents.agentTaskRunner.runAgentTask(task.id, svc);
  assert.strictEqual(done.status, 'completed');
  assert.ok(/proposal|approval/i.test(done.resultSummary));
  assert.ok(!/chain-of-thought|internal reasoning/i.test(JSON.stringify(done.result)));
  assert.ok(!/#visual-analysis|Sumber file|API Vision belum dikonfigurasi/i.test(JSON.stringify(done.result)));

  console.log('test-agent-task-runner: ok');
})();

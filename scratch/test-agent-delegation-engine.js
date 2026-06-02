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
  const complexRoute = agents.agentRouter.routeMessage('buat prompt phase 24 external integration', {}, svc);
  const trigger = agents.delegationEngine.shouldTriggerDelegation('buat prompt phase 24 external integration', {}, complexRoute, {}, svc);
  assert.strictEqual(trigger.needed, true);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('halo', {}, {}, {}, svc).needed, false);
  assert.strictEqual(agents.delegationEngine.shouldTriggerDelegation('saya capek hari ini', {}, {}, {}, svc).needed, false);

  const session = await agents.delegationEngine.createDelegationSession({
    workspaceId: 'w1',
    userId: 'u1',
    chatId: 'c1',
    originalMessage: 'buat prompt phase 24 external integration'
  }, svc);
  const plan = await agents.delegationEngine.planDelegation(session.id, svc);
  assert.ok(plan.tasks.length >= 2 && plan.tasks.length <= 5);
  assert.ok(plan.tasks.some(task => task.assignedAgentId === 'planner'));
  assert.ok(plan.tasks.every(task => task.workspaceId === 'w1'));

  const result = await agents.delegationEngine.runDelegation(session.id, svc);
  assert.strictEqual(result.session.status, 'completed');
  assert.ok(/Rekomendasi|Ringkasan agent/i.test(result.finalAnswer));
  assert.ok(!JSON.stringify(result).includes('sk-test-secret'));
  assert.ok((await agents.delegationEngine.listDelegationSessions({ workspaceId: 'w1' }, svc)).length >= 1);

  console.log('test-agent-delegation-engine: ok');
})();

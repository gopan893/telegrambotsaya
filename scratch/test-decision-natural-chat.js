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
  const bots = await agents.decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'lebih baik tambah 10 bot langsung atau 4 dulu?' }, svc);
  assert.ok(/4 bot/i.test(bots.finalAnswer));

  const phase = await agents.decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'lanjut phase berapa?' }, svc);
  assert.ok(/Phase 24|phase berikutnya/i.test(phase.finalAnswer));

  const restore = await agents.decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'apakah saya harus restore backup lama?' }, svc);
  assert.ok(/approval|checksum|integrity|restore plan/i.test(restore.finalAnswer));

  const storage = await agents.decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'mana yang lebih aman PostgreSQL atau JSON untuk storage?' }, svc);
  assert.ok(/PostgreSQL/i.test(storage.finalAnswer));

  assert.ok(!/Smart Agent Router|Mode:|#visual-analysis|API Vision belum dikonfigurasi/i.test([
    bots.finalAnswer,
    phase.finalAnswer,
    restore.finalAnswer,
    storage.finalAnswer
  ].join('\n')));

  const route = agents.agentRouter.routeMessage('lebih baik tambah 10 bot langsung atau 4 dulu?', {}, svc);
  assert.strictEqual(agents.decisionDetector.shouldTriggerDecisionSystem('lebih baik tambah 10 bot langsung atau 4 dulu?', route, {}, {}, svc).needed, true);

  console.log('test-decision-natural-chat: ok');
})();

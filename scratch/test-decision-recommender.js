'use strict';

const assert = require('assert');
const decisionStore = require('../src/agents/decision-store');

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
  const bots = await decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'lebih baik tambah 10 bot langsung atau 4 dulu?' }, svc);
  assert.ok(/4 bot/i.test(bots.recommendation.recommendation));
  assert.ok(bots.recommendation.nextSteps.length);

  const restore = await decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'apakah saya harus restore backup lama?' }, svc);
  assert.strictEqual(restore.recommendation.approvalRequired, true);
  assert.ok(/approval|restore plan|checksum|integrity/i.test(JSON.stringify(restore.recommendation)));

  const vague = await decisionStore.analyzeDecision({ workspaceId: 'w1', userId: 'u1', question: 'mana yang paling bagus?' }, svc);
  assert.ok(/informasi|kecil|reversible|tunda/i.test(vague.recommendation.recommendation + JSON.stringify(vague.recommendation.nextSteps)));
  assert.ok(!/direct dangerous action/i.test(vague.finalAnswer));

  console.log('test-decision-recommender: ok');
})();

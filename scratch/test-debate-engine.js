'use strict';

const assert = require('assert');
const councilEngine = require('../src/agents/council-engine');
const debateEngine = require('../src/agents/debate-engine');

function createServices() {
  return {
    __agentMemory: {},
    actorId: 'tester',
    auditLog: {
      async recordAuditLog(entry) {
        this.items = this.items || [];
        this.items.push(entry);
        return entry;
      }
    }
  };
}

(async () => {
  const services = createServices();
  const session = await councilEngine.createCouncilSession({
    workspaceId: 'default',
    userId: 'u1',
    source: 'telegram_command',
    mode: 'debate',
    topic: 'lebih baik mulai 10 bot atau 4 dulu?',
    originalMessage: 'lebih baik mulai 10 bot atau 4 dulu?',
    riskLevel: 'medium'
  }, services);

  const round = await debateEngine.createDebateRound(session, ['planner', 'critic', 'coder'], services);
  assert.ok(round.opinions.length >= 2, 'debate should collect opening positions');
  assert.ok(round.critiques.length >= 1, 'debate should collect critiques');
  assert.ok(round.revisions.length >= 1, 'debate should collect revisions');
  assert.ok(/4 bot/i.test(round.recommendation.recommendation), '10 vs 4 bot should recommend staged rollout');

  const result = await debateEngine.runDebate(session, services);
  assert.ok(result.finalAnswer, 'debate should produce final answer');
  assert.ok(!/hidden chain-of-thought/i.test(result.finalAnswer), 'final answer must not expose hidden reasoning');

  console.log('test-debate-engine: ok');
})();

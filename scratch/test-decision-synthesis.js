'use strict';

const assert = require('assert');
const synthesis = require('../src/agents/decision-synthesis');

(() => {
  const phaseSession = {
    source: 'natural_chat',
    topic: 'saya bingung lanjut phase berapa',
    originalMessage: 'saya bingung lanjut phase berapa',
    opinions: [{ agentId: 'planner', concerns: ['Scope terlalu melebar.'] }],
    critiques: []
  };
  const phaseDecision = synthesis.buildDecision(phaseSession, phaseSession.opinions, [], {});
  assert.ok(phaseDecision.recommendation.includes('Phase 22'), 'phase decision should recommend Phase 22');
  const phaseAnswer = synthesis.buildFinalUserAnswer({ ...phaseSession, decision: phaseDecision });
  assert.ok(phaseAnswer.includes('Langkah berikutnya'), 'natural answer should include next steps');
  assert.ok(!/Smart Agent Router|Mode:|Agent:/i.test(phaseAnswer), 'natural synthesis must hide diagnostics');

  const restoreSession = {
    source: 'natural_chat',
    topic: 'restore backup production',
    originalMessage: 'restore backup production',
    approvalRequired: true,
    riskReview: { approvalRequired: true, mitigationPlan: ['Approval eksplisit.'] }
  };
  const restoreDecision = synthesis.buildDecision(restoreSession, [], [], restoreSession.riskReview);
  assert.ok(/proposal|approval/i.test(restoreDecision.recommendation), 'restore decision should require approval');

  const prosCons = synthesis.buildProsCons({ originalMessage: '10 bot atau 4 dulu?' });
  assert.ok(prosCons.pros.length && prosCons.cons.length, 'pros/cons required');

  console.log('test-decision-synthesis: ok');
})();

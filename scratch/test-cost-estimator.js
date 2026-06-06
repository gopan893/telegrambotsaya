'use strict';

const estimator = require('../src/cost/cost-estimator');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-cost-estimator');

const r1 = estimator.estimateCost('openai', 'gpt-4o-mini', 1000, 500);
assert(r1.known === true, 'estimateCost known model');
assert(r1.estimatedCost > 0, 'estimateCost cost positive');

const r2 = estimator.estimateCost('nonexistent-provider', 'nonexistent-model', 1000, 500);
assert(r2.known === false, 'estimateCost unknown model');
assert(r2.estimatedCost === null, 'estimateCost null cost');

const r3 = estimator.estimateWorkflowCost(null);
assert(r3.known === false, 'estimateWorkflowCost null');

const r4 = estimator.estimateWorkflowCost({ steps: [] });
assert(r4.known === true, 'estimateWorkflowCost empty steps');
assert(r4.estimatedCost === null, 'estimateWorkflowCost null cost');

const r5 = estimator.estimateWorkflowCost({
  steps: [{ prompt: 'test', type: 'simple' }],
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o-mini'
});
assert(r5.known === true, 'estimateWorkflowCost with steps');

const r6 = estimator.estimateAgentRunCost(null);
assert(r6.known === false, 'estimateAgentRunCost null');

const r7 = estimator.estimateAgentRunCost({ provider: 'openai', model: 'gpt-4o-mini', context: 'test' });
assert(r7.known === true, 'estimateAgentRunCost basic');

const r8 = estimator.estimateCouncilCost(null);
assert(r8.known === false, 'estimateCouncilCost null');

const r9 = estimator.estimateCouncilCost({ agents: [] });
assert(r9.known === true, 'estimateCouncilCost empty');

const r10 = estimator.estimateCouncilCost({ agents: [{ provider: 'openai', model: 'gpt-4o-mini', context: 'test' }] });
assert(r10.agentCount === 1, 'estimateCouncilCost count');

const r11 = estimator.estimateEvaluationSuiteCost(null);
assert(r11.known === false, 'estimateEvaluationSuiteCost null');

const r12 = estimator.estimateEvaluationSuiteCost({ cases: [{ input: 'test' }] });
assert(r12.known === true, 'estimateEvaluationSuiteCost basic');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

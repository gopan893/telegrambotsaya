'use strict';

const estimator = require('../src/cost/token-estimator');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-token-estimator');

const r1 = estimator.estimateTokensFromText('');
assert(r1.tokens === 0, 'estimateTokensFromText empty');

const r2 = estimator.estimateTokensFromText('hello world');
assert(r2.tokens > 0, 'estimateTokensFromText basic');
assert(r2.estimated === true, 'estimateTokensFromText estimated');

const r3 = estimator.estimateTokensFromMessages([]);
assert(r3.tokens === 0, 'estimateTokensFromMessages empty');
assert(r3.messageCount === 0, 'estimateTokensFromMessages messageCount');

const r4 = estimator.estimateTokensFromMessages([{ role: 'user', content: 'test' }]);
assert(r4.tokens > 0, 'estimateTokensFromMessages one message');
assert(r4.messageCount === 1, 'estimateTokensFromMessages count');

const r5 = estimator.estimatePromptTokens('test prompt');
assert(r5.tokens > 0, 'estimatePromptTokens string');

const r6 = estimator.estimatePromptTokens([{ content: 'hello' }]);
assert(r6.tokens > 0, 'estimatePromptTokens array');

const r7 = estimator.estimateResponseTokens('simple');
assert(r7.tokens === 50, 'estimateResponseTokens simple');

const r8 = estimator.estimateResponseTokens('report');
assert(r8.tokens === 2000, 'estimateResponseTokens report');

const r9 = estimator.estimateResponseTokens('unknown_type');
assert(r9.tokens === 200, 'estimateResponseTokens default');

const r10 = estimator.estimateWorkflowTokens(null);
assert(r10.tokens === 0, 'estimateWorkflowTokens null');

const r11 = estimator.estimateWorkflowTokens({ steps: [], prompt: 'test' });
assert(r11.tokens > 0, 'estimateWorkflowTokens basic');

const r12 = estimator.buildTokenEstimateSummary(null);
assert(r12.tokens === 0, 'buildTokenEstimateSummary null');

const r13 = estimator.buildTokenEstimateSummary({ tokens: 100, estimated: true, method: 'test' });
assert(r13.tokens === 100, 'buildTokenEstimateSummary basic');
assert(r13.method === 'test', 'buildTokenEstimateSummary method');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

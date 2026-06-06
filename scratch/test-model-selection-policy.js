'use strict';

const policy = require('../src/cost/model-selection-policy');
const registry = require('../src/cost/model-cost-registry');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-model-selection-policy');

assert(policy.getCurrentMode() === 'balanced', 'default mode balanced');

const r1 = policy.setModelSelectionMode('economy');
assert(r1.ok === true, 'setMode economy');
assert(policy.getCurrentMode() === 'economy', 'mode is economy');

const r2 = policy.setModelSelectionMode('invalid');
assert(r2.ok === false, 'setMode invalid rejected');
assert(policy.getCurrentMode() === 'economy', 'mode unchanged after invalid');

policy.setModelSelectionMode('balanced');
assert(policy.getCurrentMode() === 'balanced', 'mode reset to balanced');

const r3 = policy.selectModelForRequest({ type: 'chat' }, {}, {});
assert(r3 !== null, 'selectModelForRequest returns model');
assert(r3.mode === 'balanced', 'selectModelForRequest mode balanced');

const r4 = policy.selectModelForRequest({ type: 'council', complexity: 'high' }, {}, {});
assert(r4 !== null, 'selectModelForRequest council');
assert(r4.qualityTier === 'high' || r4.qualityTier === 'medium', 'council quality high or medium');

const r5 = policy.selectModelForAgent('test-agent', { type: 'chat' }, {});
assert(r5 !== null, 'selectModelForAgent returns model');

const r6 = policy.selectModelForEvaluation('security', {});
assert(r6 !== null, 'selectModelForEvaluation security');

const r7 = policy.selectModelForCodingTask({ complexity: 'high' }, {});
assert(r7 !== null, 'selectModelForCodingTask high');

const r8 = policy.selectModelForRoutine({ type: 'simple' }, {});
assert(r8 !== null, 'selectModelForRoutine simple');

const r9 = policy.setPolicyOverride('agent1', { provider: 'openai', model: 'gpt-4o' });
assert(r9.ok === true, 'setPolicyOverride');

const r10 = policy.getPolicyOverrides();
assert(r10.agent1 !== undefined, 'getPolicyOverrides has agent1');
assert(r10.agent1.model === 'gpt-4o', 'getPolicyOverrides model correct');

policy.clearPolicyOverride('agent1');
const r11 = policy.getPolicyOverrides();
assert(r11.agent1 === undefined, 'clearPolicyOverride works');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

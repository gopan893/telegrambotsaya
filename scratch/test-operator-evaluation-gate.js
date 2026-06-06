'use strict';

const gate = require('../src/operator/operator-evaluation-gate');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-evaluation-gate');

const r1 = gate.runOperatorEvaluationGate(null);
assert(r1.ok === false, 'eval null');

const safeTask = { id: 't1', title: 'Simple task', type: 'planning', riskLevel: 'low', requiresApproval: true };
const r2 = gate.runOperatorEvaluationGate(safeTask);
assert(r2.ok === true, 'safe task passes');
assert(r2.passed === true, 'safe task passed');
assert(r2.checks.length === 3, 'three checks');

const r3 = gate.assertNoDirectExternalWrite(safeTask);
assert(r3.passed === true, 'no direct write');

const dangerTask = { id: 't2', title: 'Git push and deploy', type: 'deployment', riskLevel: 'high', requiresApproval: false };
const r4 = gate.runOperatorEvaluationGate(dangerTask);
assert(r4.ok === false, 'danger task fails');

const r5 = gate.assertApprovalBoundary({ riskLevel: 'high', requiresApproval: false, type: 'deployment' });
assert(r5.passed === false, 'no approval boundary fails');

const r6 = gate.assertApprovalBoundary({ riskLevel: 'low', requiresApproval: true, type: 'planning' });
assert(r6.passed === true, 'approval boundary intact');

const r7 = gate.assertOperatorSafety(null);
assert(r7.passed === false, 'null safety fails');

const r8 = gate.assertOperatorSafety({});
assert(r8.passed === true, 'safety passes');

const r9 = gate.buildOperatorEvaluationCase(safeTask);
assert(r9.gates.length === 3, 'eval case has 3 gates');

const r10 = gate.buildOperatorGateReport(null);
assert(r10 === 'No evaluation result.', 'null gate report');

const r11 = gate.buildOperatorGateReport(r2);
assert(r11.includes('PASSED'), 'gate report');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

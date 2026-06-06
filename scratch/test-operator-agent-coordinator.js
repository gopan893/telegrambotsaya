'use strict';

const coordinator = require('../src/operator/operator-agent-coordinator');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-agent-coordinator');

const r1 = coordinator.selectAgentsForOperatorTask(null);
assert(Array.isArray(r1), 'select null returns array');
assert(r1.length === 0, 'select null empty');

const task = { id: 't1', title: 'Implement feature', type: 'coding', riskLevel: 'medium', requiresApproval: true };
const r2 = coordinator.selectAgentsForOperatorTask(task);
assert(r2.length > 0, 'select returns agents');
assert(r2.some(a => a.role === 'orchestrator'), 'includes orchestrator');
assert(r2.some(a => a.role === 'coder'), 'includes coder');

const r3 = coordinator.coordinateAgentWork(task);
assert(r3.taskId === 't1', 'coordinate includes taskId');
assert(r3.agents.length > 0, 'coordinate has agents');

const r4 = coordinator.collectAgentOpinions(task);
assert(r4.length > 0, 'opinions collected');
assert(r4[0].role !== undefined, 'opinion has role');
assert(r4[0].opinion !== undefined, 'opinion has text');

const r5 = coordinator.synthesizeAgentResult(task);
assert(r5.taskId === 't1', 'synthesize taskId');
assert(r5.synthesizedBy === 'orchestrator', 'synthesized by orchestrator');
assert(typeof r5.approved === 'boolean', 'approved boolean');
assert(r5.securityChecked === true, 'security checked for approval task');

const simpleTask = { id: 't2', title: 'Simple chat', type: 'planning', riskLevel: 'low', requiresApproval: false };
const r6 = coordinator.synthesizeAgentResult(simpleTask);
assert(r6.costChecked === false, 'cost not checked for planning task');

const r7 = coordinator.preventAgentSpam(task);
assert(r7.limited === false, 'no spam limit for normal task');

const manyRolesTask = { id: 't3', title: 'Complex', type: 'coding', riskLevel: 'high', requiresApproval: true };
const r8 = coordinator.preventAgentSpam(manyRolesTask);
assert(r8.agents.length <= 6, 'spam prevention limits agents');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

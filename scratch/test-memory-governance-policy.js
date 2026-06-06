'use strict';

const policy = require('../src/knowledge/memory-governance-policy');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-memory-governance-policy');

const cls = policy.classifyMemoryCandidate({ type: 'decision', title: 'Use Node 20', summary: 'runtime' });
assert(cls.category === 'decision', 'classify decision');
assert(cls.score >= 0 && cls.score <= 1, 'classify score in range');

const inc = policy.classifyMemoryCandidate({ type: 'incident', title: 'Render down', summary: 'incident' });
assert(inc.category === 'incident', 'classify incident');

const dep = policy.classifyMemoryCandidate({ type: 'deploy', title: 'Deploy v1', summary: 'deploy' });
assert(dep.category === 'deployment', 'classify deployment');

const scope1 = policy.decideMemoryScope({ type: 'project', title: 'X' });
assert(scope1 === 'project_memory', 'project scope');

const scope2 = policy.decideMemoryScope({ type: 'decision', title: 'X' });
assert(scope2 === 'decision_memory', 'decision scope');

const sens1 = policy.decideMemorySensitivity({ type: 'memory', title: 'plain', summary: 'public note' });
assert(sens1 === 'public' || sens1 === 'internal', 'sensitivity ok');

const sens2 = policy.decideMemorySensitivity({ type: 'memory', title: 'note', summary: 'token: ghp_12345abcdef' });
assert(sens2 === 'secret', 'sensitivity detects secret');

const ret1 = policy.decideMemoryRetention({ type: 'phase', title: 'p' });
assert(ret1 === 'active', 'phase retention active');

const ret2 = policy.decideMemoryRetention({ type: 'memory', title: 't', source: 'ephemeral' });
assert(ret2 === 'temporary', 'ephemeral retention temporary');

const dec = policy.buildMemoryGovernanceDecision({ type: 'decision', title: 'Use Node 20', summary: 'core decision' });
assert(dec.scope === 'decision_memory', 'decision scope from builder');
assert(dec.retention === 'active', 'decision retention active');
assert(dec.canStore === true, 'canStore true for safe');

const dec2 = policy.buildMemoryGovernanceDecision({ type: 'memory', title: 't', summary: 'sk-abcdef1234567890' });
assert(dec2.blocked === true, 'blocked when secret present');
assert(dec2.sensitivity === 'secret', 'sensitivity secret');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

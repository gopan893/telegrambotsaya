'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const reviewer = require('../src/knowledge/memory-staleness-reviewer');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-memory-staleness-reviewer');
store.reset();

const a = store.createKnowledgeNode({ type: 'memory', title: 'Old note', summary: 'old' });
const oldNode = store.getKnowledgeNode(a.node.id);
oldNode.createdAt = new Date(Date.now() - 200 * 86400000).toISOString();
oldNode.updatedAt = oldNode.createdAt;

const b = store.createKnowledgeNode({ type: 'memory', title: 'Recent note', summary: 'new' });

const stale = reviewer.detectStaleKnowledge({ minAgeMs: 30 * 86400000 });
assert(stale.length >= 1, 'stale detection');
assert(stale.find(s => s.id === a.node.id), 'old note in stale list');
assert(!stale.find(s => s.id === b.node.id), 'recent note not in stale list');

const plan = reviewer.suggestArchiveCandidates({ minAgeMs: 30 * 86400000 });
assert(plan.archivePlan.length >= 1, 'archive plan has items');
assert(plan.noHardDelete !== true || plan.noHardDelete === undefined, 'plan structure ok');

const full = reviewer.createMemoryCleanupPlan({ minAgeMs: 30 * 86400000 });
assert(full.requireApproval === true, 'cleanup plan requires approval');
assert(full.noHardDelete === true, 'cleanup plan never hard deletes');

const seed = store.createKnowledgeNode({ type: 'decision', title: 'Use Node.js 20', summary: 'core', source: 'core', sourceId: 'core-node-20' });
const arch = reviewer.archiveStaleKnowledge([seed.node.id]);
assert(arch.ok, 'archive run ok');
const skipped = arch.skipped.find(s => s.id === seed.node.id);
assert(skipped && skipped.reason === 'PROTECTED_DECISION', 'protected decision skipped');

const archAll = reviewer.archiveStaleKnowledge([a.node.id]);
assert(archAll.ok && archAll.archived.length === 1, 'archive non-protected');

const noIds = reviewer.archiveStaleKnowledge([]);
assert(!noIds.ok, 'archiveStaleKnowledge rejects empty');

const sup = reviewer.detectSupersededDecisions();
assert(Array.isArray(sup), 'detectSupersededDecisions returns array');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

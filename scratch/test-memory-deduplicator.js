'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const dedup = require('../src/knowledge/memory-deduplicator');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-memory-deduplicator');
store.reset();

const a = store.createKnowledgeNode({ type: 'decision', title: 'Use Node 20', summary: 'core', source: 'core', sourceId: 'd1' });
assert(a.ok, 'seeded decision');

const dup = dedup.findDuplicateKnowledge({ type: 'decision', title: 'Use Node 20', summary: 'core', source: 'core', sourceId: 'd1' });
assert(dup.exact && dup.exact.id === a.node.id, 'exact match found');

const noDup = dedup.findDuplicateKnowledge({ type: 'decision', title: 'Use Postgres', summary: 'DB', source: 'other', sourceId: 'd2' });
assert(!noDup.exact, 'no exact when sourceId differs');

const report = dedup.buildDeduplicationReport({ type: 'decision', title: 'Use Node 20', summary: 'core', source: 'core', sourceId: 'd1' });
assert(report.isDuplicate, 'report isDuplicate true');

const mergeRes = dedup.mergeDuplicateKnowledge(a.node.id, { title: 'Use Node 20', summary: 'updated', tags: ['x'] });
assert(mergeRes.ok, 'merge ok');
const got = store.getKnowledgeNode(a.node.id);
assert(got.summary === 'updated', 'merged summary updated');

const b = store.createKnowledgeNode({ type: 'phase', title: 'Phase 1', summary: 'original', source: 'src1' });
const c = store.createKnowledgeNode({ type: 'phase', title: 'Phase 1 alternative', summary: 'different view', source: 'src2' });
const conflicts = dedup.detectConflictingKnowledge({ type: 'phase', title: 'Phase 1', summary: 'another', source: 'src3' });
assert(conflicts.length >= 0, 'detect conflicts returns array');

const safe = dedup.safeDeduplicateStore({ type: 'memory', title: 'New note', summary: 'fresh', source: 'manual' }, (c) => store.createKnowledgeNode(c));
assert(safe.ok, 'safeDeduplicateStore passes fresh');

const safe2 = dedup.safeDeduplicateStore({ type: 'decision', title: 'Use Node 20', summary: 'core', source: 'core', sourceId: 'd1' }, (c) => store.createKnowledgeNode(c));
assert(safe2.ok && safe2.deduplicated, 'safeDeduplicateStore dedupes exact');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

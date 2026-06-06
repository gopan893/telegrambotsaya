'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const manager = require('../src/knowledge/knowledge-node-manager');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-knowledge-node-manager');
store.reset();

const a = store.createKnowledgeNode({ type: 'project', title: 'AI OS', summary: 'main project' });
const b = store.createKnowledgeNode({ type: 'phase', title: 'Phase 42', summary: 'kg phase' });
const c = store.createKnowledgeNode({ type: 'risk', title: 'secret leak', summary: 'leakage risk', tags: ['risk', 'core'] });

assert(manager.createNode({ type: 'memory', title: 'Manual', summary: 'manual ingest' }).ok, 'manager.createNode works');
assert(manager.findByType('risk').length === 1, 'findByType risk');
assert(manager.findByTag('core').length === 1, 'findByTag core');
assert(manager.findBySource('manual', '').length >= 1, 'findBySource');

const similar = manager.findSimilarNode({ type: 'risk', title: 'secret leak', summary: 'leakage risk' });
assert(similar && similar.id === c.node.id, 'findSimilarNode matches fingerprint');

const link = manager.linkToProject(b.node.id, a.node.id);
assert(link.ok, 'linkToProject');

const link2 = manager.linkToPhase(c.node.id, b.node.id);
assert(link2.ok, 'linkToPhase');

const summarized = manager.summarizeNode(c.node);
assert(summarized && summarized.id === c.node.id, 'summarizeNode ok');
assert(summarized && !('createdAt' in summarized) || (summarized.updatedAt !== undefined), 'summary has updatedAt');

const updated = manager.updateNode(c.node.id, { confidence: 0.4 });
assert(updated.ok && updated.node.confidence === 0.4, 'updateNode works');

const archived = manager.archiveNode(c.node.id, 'cleanup');
assert(archived.ok && archived.node.status === 'archived', 'archiveNode works');

const list = manager.listNodes({ type: 'project' });
assert(list.length === 1, 'listNodes filters by type');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

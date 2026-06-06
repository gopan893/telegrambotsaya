'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const edges = require('../src/knowledge/knowledge-edge-manager');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-knowledge-edge-manager');
store.reset();

const a = store.createKnowledgeNode({ type: 'project', title: 'A', summary: 'a' });
const b = store.createKnowledgeNode({ type: 'phase', title: 'B', summary: 'b' });
const c = store.createKnowledgeNode({ type: 'risk', title: 'C', summary: 'c' });

const e1 = edges.safeConnect(a.node.id, b.node.id, 'depends_on', { source: 'test' });
assert(e1.ok, 'safeConnect');
const e2 = edges.safeConnect(b.node.id, c.node.id, 'affects', { source: 'test' });
assert(e2.ok, 'safeConnect affects');

const eBad = edges.safeConnect(a.node.id, b.node.id, 'not_a_relation');
assert(!eBad.ok, 'safeConnect rejects invalid relation');

const out = edges.edgesFromNode(a.node.id);
assert(out.length === 1, 'edgesFromNode count');
const into = edges.edgesToNode(b.node.id);
assert(into.length === 1, 'edgesToNode count');
const related = edges.relatedNodeIds(a.node.id);
assert(related.includes(b.node.id), 'relatedNodeIds includes target');

const list = edges.listEdges({ relation: 'depends_on' });
assert(list.length === 1, 'listEdges relation filter');

const map = edges.buildRelationMap('default');
assert(map.depends_on && map.affects, 'buildRelationMap has both relations');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

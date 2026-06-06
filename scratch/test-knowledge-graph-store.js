'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-knowledge-graph-store');
store.reset();

const created = store.createKnowledgeNode({
  type: 'decision',
  title: 'Use Postgres advisory locks',
  summary: 'Avoids duplicate job pickup when worker restarts.',
  tags: ['core', 'runtime'],
  source: 'core_decisions',
  sourceId: 'core-pg-locks',
  sensitivity: 'internal',
  confidence: 0.95
});
assert(created.ok === true, 'create node');
assert(created.node && created.node.id, 'node has id');
assert(created.node.status === 'active', 'default status active');
assert(created.node.sensitivity === 'internal', 'sensitivity preserved');

const bad = store.createKnowledgeNode({ type: 'invalid_type', title: 'x', summary: 'y' });
assert(bad.ok === false && bad.error === 'INVALID_NODE_TYPE', 'rejects invalid type');

const secret = store.createKnowledgeNode({ type: 'memory', title: 'Note', summary: 'token: abc123def456ghi789' });
assert(secret.ok === false && secret.error === 'SECRET_IN_CONTENT', 'rejects secret in summary');

const list = store.listKnowledgeNodes({ type: 'decision' });
assert(list.length === 1, 'list filters by type');

const updated = store.updateKnowledgeNode(created.node.id, { confidence: 0.5 });
assert(updated.ok && updated.node.confidence === 0.5, 'update works');

const got = store.getKnowledgeNode(created.node.id);
assert(got && got.id === created.node.id, 'get node works');

const archived = store.archiveKnowledgeNode(created.node.id, 'test');
assert(archived.ok && archived.node.status === 'archived', 'archive works');

const edgeRes = store.createKnowledgeEdge({ fromNodeId: 'a', toNodeId: 'b', relation: 'relates_to' });
assert(edgeRes.ok === false && edgeRes.error === 'NODE_NOT_FOUND', 'edge requires existing nodes');

const e2 = store.createKnowledgeNode({ type: 'project', title: 'P1', summary: 'project' });
const e3 = store.createKnowledgeNode({ type: 'phase', title: 'Phase 1', summary: 'phase' });
const edge = store.createKnowledgeEdge({ fromNodeId: e2.node.id, toNodeId: e3.node.id, relation: 'depends_on', source: 'test' });
assert(edge.ok === true, 'edge created');
assert(edge.edge.relation === 'depends_on', 'edge relation preserved');

const invalidEdge = store.createKnowledgeEdge({ fromNodeId: e2.node.id, toNodeId: e3.node.id, relation: 'not_real' });
assert(invalidEdge.ok === false && invalidEdge.error === 'INVALID_RELATION', 'invalid relation rejected');

const dupEdge = store.createKnowledgeEdge({ fromNodeId: e2.node.id, toNodeId: e3.node.id, relation: 'depends_on' });
assert(dupEdge.ok === true && dupEdge.deduplicated === true, 'duplicate edge deduplicated');

const graph = store.getGraphAroundNode(e2.node.id, 2);
assert(graph.ok && graph.nodes.length >= 2, 'graph walk returns nodes');
assert(graph.edges.length >= 1, 'graph walk returns edges');

const search = store.searchKnowledgeGraph('phase');
assert(search.ok && search.nodes.length >= 1, 'search by text works');

const stats = store.stats();
assert(stats.totalNodes >= 3, 'stats count nodes');
assert(stats.totalEdges >= 1, 'stats count edges');

const audit = store.getAuditLog({ limit: 50 });
assert(audit.length > 0, 'audit log has entries');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

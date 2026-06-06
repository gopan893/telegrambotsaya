'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const engine = require('../src/knowledge/context-retrieval-engine');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-context-retrieval-engine');
store.reset();

const proj = store.createKnowledgeNode({ type: 'project', title: 'AI OS', summary: 'main project' });
const ph = store.createKnowledgeNode({ type: 'phase', title: 'Phase 42', summary: 'kg', source: 'phase_summary', sourceId: '42' });
const ph2 = store.createKnowledgeNode({ type: 'phase', title: 'Phase 36', summary: 'deploy', source: 'phase_summary', sourceId: '36' });
const dec = store.createKnowledgeNode({ type: 'decision', title: 'No React', summary: 'vanilla only', tags: ['core'] });
const risk = store.createKnowledgeNode({ type: 'risk', title: 'Memory leak', summary: 'unbounded store' });

store.createKnowledgeEdge({ fromNodeId: ph.node.id, toNodeId: proj.node.id, relation: 'relates_to' });
store.createKnowledgeEdge({ fromNodeId: dec.node.id, toNodeId: proj.node.id, relation: 'relates_to' });

const pack = engine.buildContextPack('phase 42');
assert(pack.query === 'phase 42', 'query preserved');
assert(pack.selectedNodes.length >= 1, 'selectedNodes populated');
assert(pack.confidence >= 0, 'confidence numeric');
assert(Array.isArray(pack.decisions), 'decisions array');
assert(Array.isArray(pack.risks), 'risks array');

const projCtx = engine.retrieveProjectContext('AI OS');
assert(projCtx.projects.length >= 1, 'project context has projects');
assert(projCtx.contextPack, 'contextPack included');

const phaseCtx = engine.retrievePhaseContext('42');
assert(phaseCtx.phase === '42', 'phase context preserves phase number');
assert(phaseCtx.phaseNodes.length >= 1, 'phase context has phase nodes');

const incidentCtx = engine.retrieveIncidentContext('deploy');
assert(incidentCtx.contextPack, 'incident context has contextPack');

const decCtx = engine.retrieveDecisionContext('react');
assert(decCtx.decisions.length >= 1, 'decision context finds No React');

const handoffCtx = engine.retrieveAgentHandoffContext('opencode');
assert(handoffCtx.contextPack, 'handoff context has contextPack');

const empty = engine.buildContextPack('zzz_no_match_query_xyz');
assert(empty.selectedNodes.length === 0, 'no nodes for unmatched query');
assert(empty.missingContext.length >= 1, 'missing context populated');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

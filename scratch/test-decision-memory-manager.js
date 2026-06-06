'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const dm = require('../src/knowledge/decision-memory-manager');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-decision-memory-manager');
store.reset();

const rec = dm.recordDecisionMemory({ title: 'Use Node.js 20', summary: 'Runtime pinned.', tags: ['runtime'], source: 'core' });
assert(rec.ok, 'recordDecisionMemory');
assert(rec.decision && rec.decision.type === 'decision', 'decision type is decision');

const noTitle = dm.recordDecisionMemory({ summary: 'no title' });
assert(!noTitle.ok, 'rejects missing title');

const secret = dm.recordDecisionMemory({ title: 'Hide token', summary: 'token: abc123def456ghi789' });
assert(!secret.ok, 'blocks secret');
assert(secret.safeSummary && secret.safeSummary.includes('redacted'), 'safe summary provided');

const searchReact = dm.searchDecisionMemory('node');
assert(searchReact.length >= 1, 'searchDecisionMemory finds by text');

const seedRes = dm.seedCoreDecisions();
assert(seedRes.ok && seedRes.seeded >= 15, 'seeds at least 15 core decisions');

const dupRes = dm.recordDecisionMemory({ title: 'Use Node.js 20', summary: 'duplicate' });
assert(dupRes.ok && dupRes.deduplicated === true, 'exact decision is deduped');

const summary = dm.summarizeDecisionHistory();
assert(summary.total >= 15, 'history total includes core');
assert(summary.core >= 15, 'history core count');
assert(summary.protected >= 15, 'history protected count');

const project = store.createKnowledgeNode({ type: 'project', title: 'AI OS', summary: 'main' });
const phase = store.createKnowledgeNode({ type: 'phase', title: 'Phase 42', summary: 'kg phase' });
const linkP = dm.linkDecisionToProject(seedRes.ids[0], project.node.id);
assert(linkP.ok, 'linkDecisionToProject');
const linkPh = dm.linkDecisionToPhase(seedRes.ids[0], phase.node.id);
assert(linkPh.ok, 'linkDecisionToPhase');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

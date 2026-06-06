'use strict';

const fs = require('fs');
const path = require('path');
const knowledge = require('../src/knowledge');
let passed = 0;
let failed = 0;
let skipped = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }
function skip(name) { skipped++; console.log('  SKIP:', name); }

console.log('test-phase42-knowledge-regression');

const ROOT = path.resolve(__dirname, '..');
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

assert(exists('src/knowledge/knowledge-utils.js'), 'knowledge-utils.js exists');
assert(exists('src/knowledge/knowledge-graph-store.js'), 'knowledge-graph-store.js exists');
assert(exists('src/knowledge/knowledge-node-manager.js'), 'knowledge-node-manager.js exists');
assert(exists('src/knowledge/knowledge-edge-manager.js'), 'knowledge-edge-manager.js exists');
assert(exists('src/knowledge/project-knowledge-ingestor.js'), 'project-knowledge-ingestor.js exists');
assert(exists('src/knowledge/decision-memory-manager.js'), 'decision-memory-manager.js exists');
assert(exists('src/knowledge/memory-governance-policy.js'), 'memory-governance-policy.js exists');
assert(exists('src/knowledge/memory-safety-gate.js'), 'memory-safety-gate.js exists');
assert(exists('src/knowledge/memory-deduplicator.js'), 'memory-deduplicator.js exists');
assert(exists('src/knowledge/memory-staleness-reviewer.js'), 'memory-staleness-reviewer.js exists');
assert(exists('src/knowledge/context-retrieval-engine.js'), 'context-retrieval-engine.js exists');
assert(exists('src/knowledge/documentation-intelligence.js'), 'documentation-intelligence.js exists');
assert(exists('src/knowledge/knowledge-report-generator.js'), 'knowledge-report-generator.js exists');
assert(exists('src/knowledge/index.js'), 'knowledge/index.js exists');

assert(exists('src/dashboard/knowledge-routes.js'), 'knowledge-routes.js exists');
assert(exists('public/dashboard/knowledge.js'), 'public knowledge.js exists');
assert(exists('docs/PROJECT_KNOWLEDGE_GRAPH.md'), 'PROJECT_KNOWLEDGE_GRAPH.md exists');
assert(exists('docs/LONG_TERM_MEMORY_GOVERNANCE.md'), 'LONG_TERM_MEMORY_GOVERNANCE.md exists');
assert(exists('docs/DECISION_MEMORY.md'), 'DECISION_MEMORY.md exists');
assert(exists('docs/KNOWLEDGE_SECURITY.md'), 'KNOWLEDGE_SECURITY.md exists');
assert(exists('docs/KNOWLEDGE_DASHBOARD.md'), 'KNOWLEDGE_DASHBOARD.md exists');

assert(exists('scratch/test-knowledge-graph-store.js'), 'test-knowledge-graph-store.js exists');
assert(exists('scratch/test-knowledge-node-manager.js'), 'test-knowledge-node-manager.js exists');
assert(exists('scratch/test-knowledge-edge-manager.js'), 'test-knowledge-edge-manager.js exists');
assert(exists('scratch/test-project-knowledge-ingestor.js'), 'test-project-knowledge-ingestor.js exists');
assert(exists('scratch/test-decision-memory-manager.js'), 'test-decision-memory-manager.js exists');
assert(exists('scratch/test-memory-governance-policy.js'), 'test-memory-governance-policy.js exists');
assert(exists('scratch/test-memory-safety-gate.js'), 'test-memory-safety-gate.js exists');
assert(exists('scratch/test-memory-deduplicator.js'), 'test-memory-deduplicator.js exists');
assert(exists('scratch/test-memory-staleness-reviewer.js'), 'test-memory-staleness-reviewer.js exists');
assert(exists('scratch/test-context-retrieval-engine.js'), 'test-context-retrieval-engine.js exists');
assert(exists('scratch/test-documentation-intelligence.js'), 'test-documentation-intelligence.js exists');
assert(exists('scratch/test-knowledge-dashboard-api.js'), 'test-knowledge-dashboard-api.js exists');

const stateJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
assert(/knowledge:[\s\S]+?aliases:[\s\S]+?memory-graph/.test(stateJs) || /knowledge:[\s\S]+?renderer:\s*'renderKnowledge'/.test(stateJs), 'state.js has knowledge tab');

const html = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
assert(/data-tab="knowledge"/.test(html), 'index.html has knowledge tab');
assert(/dashboard\/knowledge\.js/.test(html), 'index.html loads knowledge.js');

const routesJs = fs.readFileSync(path.join(ROOT, 'src/dashboard/dashboard-routes.js'), 'utf8');
assert(/knowledge-routes/.test(routesJs) || /knowledgeRoutes/.test(routesJs), 'dashboard-routes references knowledge routes');

knowledge.knowledgeGraphStore.reset();
const gate = knowledge.memorySafetyGate.runMemorySafetyGate({ title: 't', summary: 'token: ghp_secret' });
assert(!gate.ok, 'safety gate blocks');
const clean = knowledge.memorySafetyGate.runMemorySafetyGate({ title: 't', summary: 'safe' });
assert(clean.ok, 'safety gate allows safe');

const seed = knowledge.decisionMemoryManager.seedCoreDecisions();
assert(seed.ok && seed.seeded >= 15, 'core decisions seeded');

const decReport = knowledge.knowledgeReportGenerator.generateDecisionReport();
assert(decReport.total >= 15, 'decision report counts core');

const graph = knowledge.knowledgeReportGenerator.buildKnowledgeGraphSummary('default');
assert(typeof graph.totalNodes === 'number', 'graph summary numeric');

const ctx = knowledge.contextRetrievalEngine.buildContextPack('Node.js');
assert(ctx.selectedNodes.length >= 1, 'context pack for Node.js has nodes');

const dup = knowledge.memoryDeduplicator.findDuplicateKnowledge({ type: 'decision', title: 'Use Node.js 20', summary: 'Runtime pinned to Node.js 20 LTS.', source: 'core_decisions', sourceId: 'core-use-node-js-20' });
assert(dup.exact, 'dedup finds seeded decision');

const docs = knowledge.documentationIntelligence.suggestDocumentationUpdates({ rootDir: ROOT });
assert(Array.isArray(docs.findings), 'doc intelligence returns findings');

const safe = knowledge.memorySafetyGate.runMemorySafetyGate({ title: 'Test DATABASE_URL', summary: 'DATABASE_URL=postgresql://user:pass@host:5432/db' });
assert(!safe.ok && safe.safeSummary, 'database url redacted message present');

const phaseCtx = knowledge.contextRetrievalEngine.retrievePhaseContext('42');
assert(phaseCtx.phase === '42', 'phase context returns 42');

const projectReport = knowledge.knowledgeReportGenerator.generateProjectKnowledgeReport('nonexistent');
assert(!projectReport.ok, 'unknown project returns error');

const report = knowledge.knowledgeReportGenerator.generateMemoryGovernanceReport();
assert(typeof report.totalActive === 'number', 'governance report numeric');

if (exists('scratch/test-portfolio-scanner.js')) {
  console.log('  INFO: portfolio scanner test exists (would run in CI)');
} else {
  skip('scratch/test-portfolio-scanner.js (Phase 41 not yet implemented)');
}

console.log(`\n  Total: ${passed + failed + skipped} | PASS: ${passed} | FAIL: ${failed} | SKIP: ${skipped}`);
process.exit(failed > 0 ? 1 : 0);

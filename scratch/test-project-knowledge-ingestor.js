'use strict';

const store = require('../src/knowledge/knowledge-graph-store');
const ingestor = require('../src/knowledge/project-knowledge-ingestor');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-project-knowledge-ingestor');
store.reset();

const goal = ingestor.ingestProjectGoal({ id: 'g1', title: 'Build Knowledge Graph', summary: 'Phase 42', category: 'coding', priority: 'high' });
assert(goal.ok, 'ingestProjectGoal');

const plan = ingestor.ingestOperatorPlan({ id: 'p1', title: 'Plan A', summary: 'plan summary', phases: ['A', 'B'] });
assert(plan.ok, 'ingestOperatorPlan');

const snap = ingestor.ingestPortfolioSnapshot({ id: 's1', title: 'Snapshot 2026-06', summary: 'snapshot', projectCount: 3, totalCost: 12.5 });
assert(snap.ok, 'ingestPortfolioSnapshot');

const task = ingestor.ingestTask({ id: 't1', title: 'Implement KG', description: 'code', goalId: 'g1', planId: 'p1', type: 'coding', status: 'todo', riskLevel: 'medium' });
assert(task.ok, 'ingestTask');

const incident = ingestor.ingestIncident({ id: 'i1', title: 'Render down', summary: 'deploy failed', severity: 'high', status: 'open' });
assert(incident.ok, 'ingestIncident');

const deploy = ingestor.ingestDeployReport({ id: 'd1', title: 'Deploy v1', summary: 'success', version: 'v1', status: 'ok' });
assert(deploy.ok, 'ingestDeployReport');

const rollback = ingestor.ingestRollbackPlan({ id: 'r1', title: 'Rollback to v0', summary: 'fallback', targetVersion: 'v0' });
assert(rollback.ok, 'ingestRollbackPlan');

const proposal = ingestor.ingestExecutorProposal({ id: 'pr1', title: 'Proposal: send email', summary: 'prop', actionType: 'email.send', status: 'pending_approval' });
assert(proposal.ok, 'ingestExecutorProposal');

const phase = ingestor.ingestPhaseSummary({ id: 'ph1', number: 42, title: 'Phase 42', summary: 'kg + memory' });
assert(phase.ok, 'ingestPhaseSummary');

const manual = ingestor.ingestManualKnowledge({ type: 'memory', title: 'Manual note', summary: 'safe content' });
assert(manual.ok, 'ingestManualKnowledge memory');

const decision = ingestor.ingestManualKnowledge({ type: 'decision', title: 'Use Node 20', summary: 'core runtime' });
assert(decision.ok, 'ingestManualKnowledge decision');

const blocked = ingestor.ingestProjectGoal({ id: 'g2', title: 'G2', summary: 'token: ghp_abcd1234efgh5678ijkl' });
assert(!blocked.ok, 'ingestProjectGoal blocks secret');
assert(blocked.safeSummary && blocked.safeSummary.includes('redacted'), 'blocked has safe summary');

const dup = ingestor.ingestProjectGoal({ id: 'g1', title: 'Build Knowledge Graph', summary: 'Phase 42' });
assert(dup.ok && dup.deduplicated === true, 'ingest dedupes exact');

const all = store.listKnowledgeNodes({});
assert(all.length >= 9, 'store contains all ingested items');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

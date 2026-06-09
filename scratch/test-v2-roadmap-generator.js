'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const roadmap = con.v2RoadmapGenerator.generateV2Roadmap(svc);
  assert(roadmap && typeof roadmap === 'object', 'generateV2Roadmap returns object');
  assert(Array.isArray(roadmap.phases), 'roadmap has phases array');
  assert(roadmap.phases.length >= 10, 'roadmap has at least 10 phases');
  assert(roadmap.timestamp, 'roadmap has timestamp');

  const principles = con.v2RoadmapGenerator.generateV2ArchitecturePrinciples(svc);
  assert(principles && typeof principles === 'object', 'generateV2ArchitecturePrinciples returns object');
  assert(Array.isArray(principles.principles), 'principles has principles array');
  assert(principles.principles.length >= 5, 'at least 5 architecture principles');

  const refactor = con.v2RoadmapGenerator.generateV2RefactorCandidates(svc);
  assert(refactor && typeof refactor === 'object', 'generateV2RefactorCandidates returns object');
  assert(Array.isArray(refactor.candidates), 'refactor has candidates array');
  assert(typeof refactor.totalCandidates === 'number', 'refactor has totalCandidates');

  const risks = con.v2RoadmapGenerator.generateV2RiskRegister(svc);
  assert(risks && typeof risks === 'object', 'generateV2RiskRegister returns object');
  assert(Array.isArray(risks.risks), 'risks has risks array');
  assert(risks.risks.length >= 3, 'at least 3 risks');

  const migrationPlan = con.v2RoadmapGenerator.generateV2MigrationPlan(svc);
  assert(migrationPlan && typeof migrationPlan === 'object', 'generateV2MigrationPlan returns object');
  assert(Array.isArray(migrationPlan.plan), 'migrationPlan has plan array');
  assert(migrationPlan.plan.length >= 5, 'at least 5 migration steps');
  assert(migrationPlan.estimatedDuration, 'migrationPlan has estimatedDuration');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

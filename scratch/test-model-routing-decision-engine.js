'use strict';

const engine = require('../src/model-router/model-routing-decision-engine');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { env: {} };

  // selectModelRoute with public task
  const decision = await engine.selectModelRoute({ text: 'apa itu AI?' }, {}, svc);
  assert(decision, 'selectModelRoute returns decision');
  assert(decision.taskClass, 'decision has taskClass');
  assert(decision.selectedProvider, 'decision has selectedProvider');
  assert(decision.routeType, 'decision has routeType');
  assert(decision.id, 'decision has id');

  // Private task should be blocked or local
  const privateDecision = await engine.selectModelRoute({ text: 'mood saya sedih hari ini' }, {}, svc);
  assert(privateDecision, 'private task returns decision');

  // explainModelRoute
  const explanation = engine.explainModelRoute(decision, svc);
  assert(explanation.includes(decision.routeType), 'explanation contains route type');

  // buildModelRoutingDecision
  const built = engine.buildModelRoutingDecision({ class: 'simple_chat' }, ['provider1'], {}, svc);
  assert(built.task, 'buildModelRoutingDecision has task');
  assert(built.candidates.length === 1, 'has 1 candidate');

  // recordModelRouteDecision
  const recorded = await engine.recordModelRouteDecision(decision, svc);
  assert(recorded, 'recordModelRouteDecision succeeds');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

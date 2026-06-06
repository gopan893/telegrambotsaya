'use strict';

const store = require('../src/operator/project-operator-store');
const engine = require('../src/operator/operator-decision-engine');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-decision-engine');

const r1 = engine.recommendNextOperatorAction('nonexistent');
assert(r1.ok === false, 'recommend nonexistent goal');

const goal = store.createGoal({ title: 'Decision Test' });
store.updateGoal(goal.id, { status: 'idea' });

const r2 = engine.recommendNextOperatorAction(goal.id);
assert(r2.goalId === goal.id, 'recommend returns goalId');
assert(r2.recommendations.length > 0, 'has recommendations');
assert(r2.topRecommendation.action === 'analyze_goal', 'top recommendation analyze');

store.updateGoal(goal.id, { status: 'planned' });
const r3 = engine.recommendNextOperatorAction(goal.id);
assert(r3.topRecommendation.action === 'break_tasks', 'top recommendation break tasks');

const r4 = engine.compareNextActions(goal.id);
assert(r4.recommended !== undefined, 'compare has recommended');

const r5 = engine.decideContinueOrStabilize(goal.id);
assert(r5.decision === 'continue', 'no blockers continue');

const r6 = engine.decideCodexOpenCodeHermesNext(goal.id);
assert(r6.agent === 'codex' || r6.agent === 'hermes', 'recommends agent');

const r7 = engine.buildDecisionSummary(r2);
assert(r7.includes('Decision'), 'summary built');

const r8 = engine.buildDecisionSummary(null);
assert(r8 === 'No decision data.', 'null summary');

const r9 = engine.buildDecisionSummary({ error: 'test error' });
assert(r9.includes('test error'), 'error summary');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

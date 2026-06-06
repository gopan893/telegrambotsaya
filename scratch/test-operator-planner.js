'use strict';

const store = require('../src/operator/project-operator-store');
const planner = require('../src/operator/operator-planner');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-planner');

const goal = store.createGoal({ title: 'Test Project', category: 'coding' });

const r1 = planner.createOperatorPlan('nonexistent');
assert(r1.ok === false, 'plan nonexistent goal fails');

const r2 = planner.createOperatorPlan(goal.id);
assert(r2.ok === true, 'plan created');
assert(r2.plan.goalId === goal.id, 'plan linked to goal');
assert(r2.plan.status === 'draft', 'plan status draft');
assert(r2.plan.phases.length > 0, 'plan has phases');
assert(r2.plan.milestones.length > 0, 'plan has milestones');

const updatedGoal = store.getGoal(goal.id);
assert(updatedGoal.status === 'planned', 'goal status updated to planned');

const r3 = planner.createSprintPlan(goal, { name: 'Sprint 1' });
assert(r3.ok === true, 'sprint plan created');
assert(r3.plan.title === 'Sprint 1', 'sprint plan title');

const r4 = planner.createMilestones(goal);
assert(Array.isArray(r4), 'milestones array');
assert(r4.length > 0, 'milestones non-empty');

const r5 = planner.updateOperatorPlan('nonexistent', {});
assert(r5.ok === false, 'update nonexistent plan fails');

const r6 = planner.updateOperatorPlan(r2.plan.id, { status: 'active' });
assert(r6.ok === true, 'update plan succeeds');
assert(r6.plan.status === 'active', 'plan status updated');

const goal2 = store.createGoal({ title: 'Deploy project', category: 'deployment' });
const r7 = planner.createOperatorPlan(goal2.id);
assert(r7.ok === true, 'deployment plan created');
assert(r7.plan.phases.some(p => p.name.toLowerCase().includes('deploy')), 'deploy phase included');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

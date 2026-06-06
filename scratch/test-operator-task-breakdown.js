'use strict';

const store = require('../src/operator/project-operator-store');
const planner = require('../src/operator/operator-planner');
const breakdown = require('../src/operator/operator-task-breakdown');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-task-breakdown');

const goal = store.createGoal({ title: 'Test Breakdown', category: 'mixed' });
const planR = planner.createOperatorPlan(goal.id);
const planId = planR.plan.id;

const r1 = breakdown.breakGoalIntoTasks('nonexistent');
assert(r1.ok === false, 'break nonexistent goal fails');

const r2 = breakdown.breakPlanIntoTasks(planId);
assert(r2.ok === true, 'tasks created from plan');
assert(r2.tasks.length > 0, 'tasks non-empty');

const r3 = breakdown.breakGoalIntoTasks(goal.id);
assert(r3.ok === true, 'break goal into tasks');

const updatedGoal = store.getGoal(goal.id);
assert(updatedGoal.linkedTasks.length > 0, 'goal linked to tasks');

const r4 = breakdown.detectBlockedTasks({ goalId: goal.id });
assert(Array.isArray(r4), 'detectBlockedTasks returns array');

store.updateTask(r2.tasks[0].id, { status: 'blocked' });
const r5 = breakdown.detectBlockedTasks({ goalId: goal.id });
assert(r5.length > 0, 'detectBlockedTasks found blocked');

const r6 = breakdown.prioritizeOperatorTasks({ goalId: goal.id });
assert(r6.length > 0, 'prioritize returns tasks');

const r7 = breakdown.linkTaskToAgent(r2.tasks[0].id, 'coder');
assert(r7.ok === true, 'link task to agent');
assert(r7.task.assignedAgent === 'coder', 'agent assigned');

const r8 = breakdown.linkTaskToAgent('nonexistent', 'coder');
assert(r8.ok === false, 'link nonexistent task fails');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

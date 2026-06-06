'use strict';

const store = require('../src/operator/project-operator-store');
const tracker = require('../src/operator/operator-progress-tracker');
let passed = 0, failed = 0;
function assert(c, n) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n); } }
console.log('test-operator-progress-tracker');

const goal = store.createGoal({ title: 'Progress Test' });

const r1 = tracker.updateGoalProgress('nonexistent');
assert(r1.ok === false, 'update nonexistent fails');

const r2 = tracker.calculateProgress(goal.id);
assert(r2.percent === 0, 'initial progress 0');
assert(r2.tasksTotal === 0, 'no tasks yet');

const t1 = store.createTask({ goalId: goal.id, title: 'Task 1' });
store.updateGoal(goal.id, { linkedTasks: [t1.id] });
const r3 = tracker.calculateProgress(goal.id);
assert(r3.tasksTotal === 1, 'one task tracked');
assert(r3.tasksDone === 0, 'zero tasks done');

store.updateTask(t1.id, { status: 'done' });
const r4 = tracker.calculateProgress(goal.id);
assert(r4.tasksDone === 1, 'one task done');
assert(r4.percent === 100, '100% progress');

store.updateTask(t1.id, { status: 'blocked' });
const r5 = tracker.detectBlockedProgress(goal.id);
assert(r5.blocked === true, 'blocked detected');

const r6 = tracker.generateProgressSummary(goal.id);
assert(r6.includes(goal.title), 'summary includes title');

const r7 = tracker.detectStaleTasks(goal.id);
assert(Array.isArray(r7), 'stale tasks array');

store.deleteAll();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

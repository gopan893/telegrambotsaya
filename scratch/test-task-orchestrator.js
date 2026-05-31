'use strict';

const assert = require('assert');
const planner = require('../src/planner');
const workspace = require('../src/workspace');

function createServices() {
  const db = {};
  return {
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      async safeRead(key, fallback) {
        return Object.prototype.hasOwnProperty.call(db, key) ? JSON.parse(JSON.stringify(db[key])) : fallback;
      },
      async safeWrite(key, value) {
        db[key] = JSON.parse(JSON.stringify(value));
        return true;
      }
    },
    __db: db
  };
}

(async () => {
  const services = createServices();
  await workspace.store.createWorkspace({
    id: 'ws_task_test',
    name: 'Task Test',
    ownerId: 'owner',
    members: [
      { userId: 'owner', role: 'owner', status: 'active' },
      { userId: 'editor', role: 'editor', status: 'active' }
    ]
  }, services);

  const plan = await planner.plannerEngine.createPlan({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_task_test',
    title: 'Task Orchestration',
    status: 'active'
  }, services);
  assert.strictEqual(plan.ok, true);

  const first = await planner.taskOrchestrator.createTask({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_task_test',
    planId: plan.plan.id,
    title: 'Prepare schema',
    impact: 'high',
    urgency: 'high',
    effort: 'small'
  }, services);
  const second = await planner.taskOrchestrator.createTask({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_task_test',
    planId: plan.plan.id,
    title: 'Build API after schema',
    dependencies: [first.task.id]
  }, services);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(second.ok, true);
  assert.ok(first.task.priorityScore > 0, 'priority score set');

  const updated = await planner.taskOrchestrator.updateTask(first.task.id, { actorId: 'editor', status: 'doing' }, services);
  assert.strictEqual(updated.task.status, 'doing');

  const blocked = await planner.taskOrchestrator.markTaskBlocked(second.task.id, 'Menunggu schema selesai', { ...services, actorId: 'editor' });
  assert.strictEqual(blocked.task.status, 'blocked');

  const done = await planner.taskOrchestrator.markTaskDone(first.task.id, { ...services, actorId: 'editor' });
  assert.strictEqual(done.task.status, 'done');

  const tasks = await planner.taskOrchestrator.listTasks({ actorId: 'editor', userId: 'editor', workspaceId: 'ws_task_test', planId: plan.plan.id }, services);
  const ordered = planner.dependencyDetector.suggestDependencyOrder(tasks);
  assert.ok(ordered.length >= 2, 'dependency order returned');
  const cycles = planner.dependencyDetector.detectCircularDependencies([
    { id: 'a', dependencies: ['b'] },
    { id: 'b', dependencies: ['a'] }
  ]);
  assert.ok(cycles.length >= 1, 'circular dependency detected');

  const archived = await planner.taskOrchestrator.archiveTask(second.task.id, { ...services, actorId: 'editor' });
  assert.strictEqual(archived.task.status, 'archived');
  const allTasks = await planner.plannerStore.loadPlannerData(planner.plannerStore.PLANNER_TASKS_KEY, [], services);
  assert.ok(allTasks.some(task => task.id === second.task.id), 'archive is soft, no hard delete');

  const logs = await planner.plannerStore.loadPlannerData('dashboard_audit_logs', [], services);
  assert.ok(logs.some(log => log.action === 'planner/task_done'), 'audit recorded');

  console.log('test-task-orchestrator: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

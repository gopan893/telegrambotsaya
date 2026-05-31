'use strict';

const assert = require('assert');
const safeActions = require('../src/dashboard/safe-actions');
const auditLog = require('../src/dashboard/audit-log');

function createServices() {
  const data = {
    rel_goals: [{ id: 'goal1', userId: 'u1', title: 'Goal', status: 'active', priority: 'medium', progress: 0 }],
    rel_workflows: [{ id: 'wf1', userId: 'u1', title: 'Workflow', status: 'active' }],
    rel_workflow_steps: [],
    dashboard_audit_logs: []
  };
  const workflowsRepo = {
    async addWorkflowStep(step) {
      const workflow = data.rel_workflows.find(item => item.userId === step.userId && item.id === step.workflowId && !item.deletedAt);
      if (!workflow) return null;
      const next = {
        id: `step${data.rel_workflow_steps.length + 1}`,
        userId: step.userId,
        workflowId: step.workflowId,
        stepNumber: step.stepNumber || data.rel_workflow_steps.length + 1,
        title: step.title,
        status: 'pending'
      };
      data.rel_workflow_steps.push(next);
      return next;
    },
    async completeWorkflowStep(userId, workflowId, stepNumber) {
      const step = data.rel_workflow_steps.find(item => item.userId === userId && item.workflowId === workflowId && Number(item.stepNumber) === Number(stepNumber));
      if (!step) return null;
      step.status = 'done';
      step.completedAt = new Date().toISOString();
      return step;
    }
  };
  const goalsRepo = {
    async getGoalById(userId, goalId) {
      return data.rel_goals.find(item => item.userId === userId && item.id === goalId && !item.deletedAt) || null;
    },
    async updateGoal(userId, goalId, patch) {
      const goal = data.rel_goals.find(item => item.userId === userId && item.id === goalId && !item.deletedAt);
      if (!goal) return null;
      Object.assign(goal, patch, { updatedAt: new Date().toISOString() });
      return goal;
    }
  };
  const storageManager = {
    async safeRead(key, fallback) { return data[key] || fallback; },
    async safeWrite(key, value) { data[key] = value; return true; },
    getRepositories() { return { goals: goalsRepo, workflows: workflowsRepo }; },
    getStore() { return null; }
  };
  return { data, services: { storageManager } };
}

async function main() {
  const { data, services } = createServices();
  const context = { actorId: 'admin' };

  const invalidGoal = await safeActions.handleSafeAction('goal/update', {
    userId: 'u1',
    goalId: 'goal1',
    progress: 150
  }, context, services);
  assert.strictEqual(invalidGoal.ok, false);

  const goalUpdate = await safeActions.handleSafeAction('goal/update', {
    userId: 'u1',
    goalId: 'goal1',
    progress: 40,
    status: 'active'
  }, context, services);
  assert.strictEqual(goalUpdate.ok, true);
  assert.strictEqual(data.rel_goals[0].progress, 40);

  const goalArchive = await safeActions.handleSafeAction('goal/archive', {
    userId: 'u1',
    goalId: 'goal1',
    confirm: true,
    confirmationText: 'ARCHIVE'
  }, context, services);
  assert.strictEqual(goalArchive.ok, true);
  assert.ok(data.rel_goals[0].deletedAt);

  const goalRestore = await safeActions.handleSafeAction('goal/restore', {
    userId: 'u1',
    goalId: 'goal1',
    confirm: true,
    confirmationText: 'RESTORE'
  }, context, services);
  assert.strictEqual(goalRestore.ok, true);
  assert.strictEqual(data.rel_goals[0].deletedAt, null);

  const addStepInvalid = await safeActions.handleSafeAction('workflow/step/add', {
    userId: 'u1',
    workflowId: 'wf1',
    title: ''
  }, context, services);
  assert.strictEqual(addStepInvalid.ok, false);

  const addStep = await safeActions.handleSafeAction('workflow/step/add', {
    userId: 'u1',
    workflowId: 'wf1',
    title: 'Test command'
  }, context, services);
  assert.strictEqual(addStep.ok, true);
  assert.strictEqual(data.rel_workflow_steps.length, 1);

  const done = await safeActions.handleSafeAction('workflow/step/done', {
    userId: 'u1',
    workflowId: 'wf1',
    stepNumber: 1
  }, context, services);
  assert.strictEqual(done.ok, true);
  assert.strictEqual(data.rel_workflow_steps[0].status, 'done');

  const workflowArchive = await safeActions.handleSafeAction('workflow/archive', {
    userId: 'u1',
    workflowId: 'wf1',
    confirm: true,
    confirmationText: 'ARCHIVE'
  }, context, services);
  assert.strictEqual(workflowArchive.ok, true);
  assert.ok(data.rel_workflows[0].deletedAt);

  const workflowRestore = await safeActions.handleSafeAction('workflow/restore', {
    userId: 'u1',
    workflowId: 'wf1',
    confirm: true,
    confirmationText: 'RESTORE'
  }, context, services);
  assert.strictEqual(workflowRestore.ok, true);
  assert.strictEqual(data.rel_workflows[0].deletedAt, null);

  const logs = await auditLog.listAuditLogs({ limit: 20 }, services);
  ['goal/update', 'goal/archive', 'goal/restore', 'workflow/step/add', 'workflow/step/done', 'workflow/archive', 'workflow/restore']
    .forEach(action => assert.ok(logs.some(log => log.action === action), `missing audit ${action}`));

  console.log('test-dashboard-goal-workflow-control: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

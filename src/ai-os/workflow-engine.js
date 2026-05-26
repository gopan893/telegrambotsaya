'use strict';

const guards = require('./guards');
const memoryBus = require('./memory-bus');
const goalManager = require('./goal-manager');

const WORKFLOW_STATUSES = new Set(['active', 'paused', 'completed', 'archived']);

function createWorkflow(userId, input = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const title = guards.sanitizeText(input.title || '', 160);
  if (!title) return { ok: false, reason: 'TITLE_REQUIRED' };

  const ts = guards.nowIso();
  const workflow = {
    id: input.id || guards.stableId('wf', `${userId}:${title}`),
    userId: guards.normalizeUserId(userId),
    title,
    description: guards.sanitizeText(input.description || '', 900),
    status: WORKFLOW_STATUSES.has(input.status) ? input.status : 'active',
    goalId: guards.sanitizeText(input.goalId || '', 80),
    steps: guards.safeArray(input.steps).slice(0, guards.DEFAULT_LIMITS.workflowSteps).map(normalizeStep),
    contextSummary: guards.sanitizeText(input.contextSummary || '', 1200),
    memoryIds: guards.safeArray(input.memoryIds).slice(0, 40),
    createdAt: ts,
    updatedAt: ts,
    lastActivityAt: ts
  };

  guards.preventRunawayWorkflow(workflow);
  state.workflows.push(workflow);
  state.workflows = guards.pruneListByScore(state.workflows, guards.DEFAULT_LIMITS.workflows, scoreWorkflow);
  if (workflow.goalId) goalManager.attachWorkflow(userId, workflow.goalId, workflow.id, botServices);
  memoryBus.publish(userId, {
    type: 'workflow',
    content: `Workflow: ${workflow.title}. ${workflow.description}`,
    tags: ['workflow', workflow.status],
    source: 'workflow-engine',
    confidence: 0.82,
    importance: 0.76
  }, botServices);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workflow };
}

function updateWorkflow(userId, workflowId, patch = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workflow = state.workflows.find((item) => item.id === workflowId);
  if (!workflow) return { ok: false, reason: 'WORKFLOW_NOT_FOUND' };

  if (patch.title !== undefined) {
    const title = guards.sanitizeText(patch.title, 160);
    if (!title) return { ok: false, reason: 'TITLE_REQUIRED' };
    workflow.title = title;
  }
  if (patch.description !== undefined) workflow.description = guards.sanitizeText(patch.description, 900);
  if (patch.status !== undefined) {
    const status = guards.sanitizeText(patch.status, 40).toLowerCase();
    if (!WORKFLOW_STATUSES.has(status)) return { ok: false, reason: 'INVALID_STATUS' };
    workflow.status = status;
  }
  if (patch.contextSummary !== undefined) workflow.contextSummary = guards.sanitizeText(patch.contextSummary, 1200);
  if (patch.goalId !== undefined) workflow.goalId = guards.sanitizeText(patch.goalId, 80);
  if (patch.steps !== undefined) workflow.steps = guards.safeArray(patch.steps).map(normalizeStep).slice(0, guards.DEFAULT_LIMITS.workflowSteps);

  guards.preventRunawayWorkflow(workflow);
  workflow.updatedAt = guards.nowIso();
  workflow.lastActivityAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workflow };
}

function addStep(userId, workflowId, stepText, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workflow = state.workflows.find((item) => item.id === workflowId);
  if (!workflow) return { ok: false, reason: 'WORKFLOW_NOT_FOUND' };
  const title = guards.sanitizeText(stepText, 220);
  if (!title) return { ok: false, reason: 'STEP_REQUIRED' };
  workflow.steps.push(normalizeStep({ title }));
  guards.preventRunawayWorkflow(workflow);
  workflow.updatedAt = guards.nowIso();
  workflow.lastActivityAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workflow, stepNumber: workflow.steps.length };
}

function markStepDone(userId, workflowId, stepNumber, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workflow = state.workflows.find((item) => item.id === workflowId);
  if (!workflow) return { ok: false, reason: 'WORKFLOW_NOT_FOUND' };
  const index = Number(stepNumber) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= workflow.steps.length) return { ok: false, reason: 'STEP_NOT_FOUND' };
  workflow.steps[index].done = true;
  workflow.steps[index].completedAt = guards.nowIso();
  workflow.updatedAt = guards.nowIso();
  workflow.lastActivityAt = guards.nowIso();
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, workflow, step: workflow.steps[index] };
}

function pauseWorkflow(userId, workflowId, botServices) {
  return updateWorkflow(userId, workflowId, { status: 'paused' }, botServices);
}

function resumeWorkflow(userId, workflowId, botServices) {
  return updateWorkflow(userId, workflowId, { status: 'active' }, botServices);
}

function listActiveWorkflows(userId, botServices, limit = 12) {
  const state = guards.ensureAIOSState(userId, botServices);
  return state.workflows
    .filter((workflow) => workflow.status === 'active')
    .sort((a, b) => scoreWorkflow(b) - scoreWorkflow(a))
    .slice(0, limit);
}

function getWorkflowContext(userId, query = '', botServices, limit = 5) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workflows = state.workflows
    .filter((workflow) => workflow.status === 'active')
    .map((workflow) => ({
      workflow,
      score: guards.textRelevance(query, `${workflow.title} ${workflow.description} ${workflow.contextSummary}`) + scoreWorkflow(workflow)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.workflow);

  return workflows.map((workflow) => {
    const done = workflow.steps.filter((step) => step.done).length;
    return `- ${workflow.title} (${done}/${workflow.steps.length} step): ${guards.compactText(workflow.contextSummary || workflow.description, 180)}`;
  }).join('\n') || '-';
}

function attachGoal(userId, workflowId, goalId, botServices) {
  const update = updateWorkflow(userId, workflowId, { goalId }, botServices);
  if (update.ok) goalManager.attachWorkflow(userId, goalId, workflowId, botServices);
  return update;
}

function appendWorkflowMemory(userId, workflowId, text, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const workflow = state.workflows.find((item) => item.id === workflowId);
  if (!workflow) return { ok: false, reason: 'WORKFLOW_NOT_FOUND' };
  const memory = memoryBus.publish(userId, {
    type: 'workflow',
    content: text,
    tags: ['workflow', workflow.id],
    source: 'workflow-engine',
    confidence: 0.74,
    importance: 0.68
  }, botServices);
  if (memory.ok && memory.memory?.id && !workflow.memoryIds.includes(memory.memory.id)) {
    workflow.memoryIds.push(memory.memory.id);
    workflow.memoryIds = workflow.memoryIds.slice(-40);
  }
  workflow.contextSummary = guards.compactText(`${workflow.contextSummary || ''} ${text}`, 1200);
  workflow.updatedAt = guards.nowIso();
  guards.persistAsync(botServices);
  return { ok: true, workflow, memory: memory.memory };
}

function normalizeStep(step) {
  const title = typeof step === 'string' ? step : step.title;
  return {
    id: step.id || guards.stableId('step', title),
    title: guards.sanitizeText(title, 220),
    done: !!step.done,
    createdAt: step.createdAt || guards.nowIso(),
    completedAt: step.completedAt || null
  };
}

function scoreWorkflow(workflow) {
  const active = workflow.status === 'active' ? 0.35 : workflow.status === 'paused' ? 0.1 : 0;
  const steps = guards.safeArray(workflow.steps);
  const done = steps.filter((step) => step.done).length;
  const remainingBoost = steps.length ? (1 - done / steps.length) * 0.25 : 0.16;
  const updated = Date.parse(workflow.lastActivityAt || workflow.updatedAt || workflow.createdAt || 0);
  const recency = updated ? Math.max(0, 0.25 - ((Date.now() - updated) / (60 * 24 * 60 * 60 * 1000))) : 0.05;
  return active + remainingBoost + recency;
}

function resetWorkflows(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.workflows = [];
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  createWorkflow,
  updateWorkflow,
  addStep,
  markStepDone,
  pauseWorkflow,
  resumeWorkflow,
  listActiveWorkflows,
  getWorkflowContext,
  attachGoal,
  appendWorkflowMemory,
  resetWorkflows
};

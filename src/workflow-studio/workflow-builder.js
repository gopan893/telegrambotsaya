'use strict';

const store = require('./workflow-store');
const utils = require('./workflow-utils');
const stepContract = require('./workflow-step-contract');

function createWorkflow(params) {
  if (!params || !params.name) return { ok: false, error: 'Missing workflow name' };
  const workflow = store.createWorkflow({
    name: utils.sanitizeText(params.name, 100),
    description: utils.sanitizeText(params.description || '', 500),
    steps: params.steps || [],
    trigger: params.trigger || { type: 'manual' },
    riskLevel: params.riskLevel || 'low',
    ownerOnly: params.ownerOnly !== false,
    evaluationRequired: params.evaluationRequired !== false,
    dryRunRequired: params.dryRunRequired !== false,
    createdFrom: params.createdFrom || null,
    workspaceId: params.workspaceId || null
  });
  return { ok: true, workflow };
}

function addStep(workflowId, step) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  const normalized = stepContract.normalizeStep(step);
  if (!normalized) return { ok: false, error: 'Invalid step' };
  const steps = [...wf.steps, normalized];
  const updated = store.updateWorkflow(workflowId, { steps });
  return { ok: true, workflow: updated, step: normalized };
}

function removeStep(workflowId, stepId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  const steps = wf.steps.filter(s => s.id !== stepId);
  const updated = store.updateWorkflow(workflowId, { steps });
  return { ok: true, workflow: updated };
}

function updateStep(workflowId, stepId, updates) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  const steps = wf.steps.map(s => s.id === stepId ? { ...s, ...updates } : s);
  const updated = store.updateWorkflow(workflowId, { steps });
  return { ok: true, workflow: updated };
}

function getWorkflow(workflowId) {
  return store.getWorkflow(workflowId);
}

function listWorkflows(filter) {
  return store.listWorkflows(filter);
}

function deleteWorkflow(workflowId) {
  return store.removeWorkflow(workflowId);
}

module.exports = {
  createWorkflow, addStep, removeStep, updateStep,
  getWorkflow, listWorkflows, deleteWorkflow
};

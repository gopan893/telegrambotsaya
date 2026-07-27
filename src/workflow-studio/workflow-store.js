'use strict';

const workflows = new Map();
const runHistory = [];

function createWorkflow(data) {
  const id = data.id || `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const workflow = {
    id,
    workspaceId: data.workspaceId || null,
    name: data.name || 'Untitled Workflow',
    description: data.description || '',
    status: data.status || 'draft',
    trigger: data.trigger || { type: 'manual' },
    steps: Array.isArray(data.steps) ? data.steps : [],
    riskLevel: data.riskLevel || 'low',
    approvalMap: data.approvalMap || {},
    evaluationRequired: data.evaluationRequired !== false,
    dryRunRequired: data.dryRunRequired !== false,
    ownerOnly: data.ownerOnly !== false,
    maxRunsPerDay: data.maxRunsPerDay || 0,
    quietHours: data.quietHours || null,
    createdFrom: data.createdFrom || null,
    proposalIds: Array.isArray(data.proposalIds) ? data.proposalIds : [],
    lastRunAt: null,
    createdAt: now,
    updatedAt: now
  };
  workflows.set(id, workflow);
  return workflow;
}

function getWorkflow(workflowId) {
  return workflows.get(String(workflowId)) || null;
}

function updateWorkflow(workflowId, updates) {
  const existing = workflows.get(String(workflowId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: workflowId, updatedAt: new Date().toISOString() };
  workflows.set(workflowId, updated);
  return updated;
}

function removeWorkflow(workflowId) {
  return workflows.delete(String(workflowId));
}

function listWorkflows(filter = {}) {
  let arr = Array.from(workflows.values());
  if (filter.workspaceId) arr = arr.filter(w => w.workspaceId === filter.workspaceId);
  if (filter.status) arr = arr.filter(w => w.status === filter.status);
  if (filter.riskLevel) arr = arr.filter(w => w.riskLevel === filter.riskLevel);
  if (filter.name) arr = arr.filter(w => w.name.toLowerCase().includes(filter.name.toLowerCase()));
  return arr;
}

function recordRun(workflowId, result) {
  const entry = { workflowId, ...result, timestamp: new Date().toISOString() };
  runHistory.push(entry);
  if (runHistory.length > 2000) runHistory.splice(0, runHistory.length - 2000);
  const wf = workflows.get(String(workflowId));
  if (wf) wf.lastRunAt = entry.timestamp;
}

function getRunHistory(workflowId, limit = 50) {
  if (workflowId) return runHistory.filter(e => e.workflowId === workflowId).slice(-limit);
  return runHistory.slice(-limit);
}

function getWorkflowCount() {
  return workflows.size;
}

function resetStore() {
  workflows.clear();
  runHistory.length = 0;
}

module.exports = {
  createWorkflow, getWorkflow, updateWorkflow, removeWorkflow,
  listWorkflows, recordRun, getRunHistory, getWorkflowCount, resetStore
};

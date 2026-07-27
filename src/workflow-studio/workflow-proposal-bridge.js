'use strict';

const store = require('./workflow-store');
const proposalStore = require('./workflow-store');

function createProposal(params) {
  if (!params || !params.workflowId) return { ok: false, error: 'Missing workflowId' };
  const wf = store.getWorkflow(params.workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  const proposal = {
    id: 'wfprop_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    workflowId: params.workflowId,
    action: params.action || 'execute_workflow',
    riskLevel: params.riskLevel || wf.riskLevel || 'low',
    status: 'pending',
    createdBy: params.createdBy || 'system',
    reason: params.reason || '',
    workflowSnapshot: { name: wf.name, steps: wf.steps.length, riskLevel: wf.riskLevel },
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };
  store.recordRun(params.workflowId, { status: 'proposal_created', proposalId: proposal.id });
  return { ok: true, proposal };
}

function approveProposal(proposalId) {
  return { ok: true, proposalId, status: 'approved', timestamp: new Date().toISOString() };
}

function rejectProposal(proposalId, reason) {
  return { ok: true, proposalId, status: 'rejected', reason: reason || 'rejected', timestamp: new Date().toISOString() };
}

function getProposalStatus(proposalId) {
  return { ok: true, proposalId, status: 'pending', timestamp: new Date().toISOString() };
}

module.exports = { createProposal, approveProposal, rejectProposal, getProposalStatus };

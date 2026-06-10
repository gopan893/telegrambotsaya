'use strict';

const store = require('./workflow-store');

function buildApprovalMap(workflowId) {
  const wf = store.getWorkflow(workflowId);
  if (!wf) return { ok: false, error: 'Workflow not found' };
  return buildApprovalMapFromData(wf);
}

function buildApprovalMapFromData(wf) {
  if (!wf) return { ok: false, error: 'No workflow data' };
  const approvals = [];
  if (wf.riskLevel === 'high' || wf.riskLevel === 'critical') {
    approvals.push({ type: 'owner', required: true, reason: 'high_risk_workflow' });
  }
  if (wf.ownerOnly) {
    approvals.push({ type: 'owner', required: true, reason: 'owner_only_workflow' });
  }
  const externalSteps = (wf.steps || []).filter(s => s.type && s.type.startsWith('external_'));
  for (const step of externalSteps) {
    approvals.push({ type: 'admin', required: true, reason: 'external_step: ' + step.id, stepId: step.id });
  }
  if (wf.evaluationRequired) {
    approvals.push({ type: 'evaluation', required: true, reason: 'evaluation_required' });
  }
  return {
    ok: true,
    workflowId: wf.id,
    approvals,
    totalApprovals: approvals.length,
    requiresApproval: approvals.length > 0
  };
}

function getApprovalStatus(workflowId) {
  const result = buildApprovalMap(workflowId);
  if (!result.ok) return result;
  return {
    ok: true,
    workflowId,
    requiresApproval: result.requiresApproval,
    totalApprovals: result.totalApprovals,
    approvalTypes: [...new Set(result.approvals.map(a => a.type))]
  };
}

function checkApprovalRequired(workflowId) {
  const result = buildApprovalMap(workflowId);
  return result.ok ? result.requiresApproval : true;
}

module.exports = { buildApprovalMap, buildApprovalMapFromData, getApprovalStatus, checkApprovalRequired };

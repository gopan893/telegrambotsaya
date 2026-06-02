'use strict';

function normalizeAgentId(value = '') {
  return String(value || '').trim().toLowerCase();
}

function canAgentRequestProposal(agentId = 'orchestrator') {
  const id = normalizeAgentId(agentId);
  return ['orchestrator', 'planner', 'coder', 'critic', 'security', 'executor', 'ops', 'memory'].includes(id);
}

function canAgentApproveExecution() {
  return false;
}

function canAgentRunExecution() {
  return false;
}

function requiresHumanApproval(actionPlan = {}) {
  return actionPlan.approvalRequired !== false;
}

function buildPolicyDecision(agentId = 'orchestrator', actionPlan = {}) {
  const canRequest = canAgentRequestProposal(agentId);
  return {
    allowedToCreatePlan: canRequest,
    allowedToCreateProposal: canRequest,
    allowedToApprove: false,
    allowedToRun: false,
    approvalRequired: requiresHumanApproval(actionPlan),
    reason: canRequest ? 'agent may request proposal only' : 'agent cannot request proposal'
  };
}

module.exports = {
  buildPolicyDecision,
  canAgentApproveExecution,
  canAgentRequestProposal,
  canAgentRunExecution,
  requiresHumanApproval
};

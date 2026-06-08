'use strict';

const crypto = require('crypto');

const PROPOSALS = [];

function generateId() {
  return crypto.createHash('sha1').update(`sp:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16);
}

function createSecurityRepairPlan(findingOrAudit) {
  return {
    id: generateId(),
    type: 'security_repair',
    findingId: (findingOrAudit && findingOrAudit.id) || null,
    description: 'Security repair plan generated.',
    steps: ['1. Review security finding.', '2. Determine remediation.', '3. Create executor proposal.', '4. Get approval.', '5. Execute remediation.'],
    status: 'draft',
    createdAt: new Date().toISOString()
  };
}

function createSecurityExecutorProposal(plan) {
  const proposal = {
    id: generateId(),
    planId: (plan && plan.id) || null,
    type: 'security_executor_proposal',
    title: 'Security Remediation: ' + ((plan && plan.credentialType) || 'unknown'),
    description: ((plan && plan.credentialType) ? `Rotate ${plan.credentialType}` : 'Security remediation') + ' — requires manual steps only.',
    status: 'pending_approval',
    requiresEvaluationV2: true,
    requiresExecutorApproval: true,
    requiresOwnerApproval: true,
    createdAt: new Date().toISOString(),
    manualSteps: (plan && plan.manualSteps) || []
  };

  PROPOSALS.push(proposal);
  return proposal;
}

function createSecurityImprovementPrompt(plan) {
  return {
    text: `Security improvement: ${((plan && plan.credentialType) || 'general')} rotation/repair needed.`,
    type: 'improvement_prompt',
    planId: (plan && plan.id) || null,
    createdAt: new Date().toISOString()
  };
}

function linkSecurityFindingToProposal(findingId, proposalId) {
  return { findingId, proposalId, linked: true, createdAt: new Date().toISOString() };
}

function listProposals({ status, limit } = {}) {
  let results = [...PROPOSALS];
  if (status) results = results.filter(p => p.status === status);
  results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (limit) results = results.slice(0, limit);
  return results;
}

module.exports = {
  createSecurityRepairPlan,
  createSecurityExecutorProposal,
  createSecurityImprovementPrompt,
  linkSecurityFindingToProposal,
  listProposals
};

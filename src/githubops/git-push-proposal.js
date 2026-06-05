'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

function createPushProposal(pushPlan) {
  if (!pushPlan || !pushPlan.ok) return { ok: false, error: 'Valid push plan required' };

  const plan = pushPlan.plan;
  const proposalId = utils.shortId();
  const proposal = {
    id: proposalId,
    type: 'push',
    pushPlanId: plan.id,
    fileCount: plan.fileCount,
    areas: plan.areas || [],
    targetBranch: plan.targetBranch,
    requiresMainWarning: plan.requiresMainWarning,
    warnings: [...(plan.warnings || [])],
    validation: {
      secretScan: plan.secretScanPassed === true ? 'passed' : plan.secretScanPassed === false ? 'failed' : 'not_run',
      evaluationV2: plan.evaluationPassed === true ? 'passed' : plan.evaluationPassed === false ? 'failed' : 'not_run',
      tests: plan.testsPassed === true ? 'passed' : plan.testsPassed === false ? 'failed' : 'not_run'
    },
    executorApproval: null,
    executorApprovedAt: null,
    executorProposedTo: null,
    status: 'pending_approval',
    gitCommands: plan.gitCommands,
    timestamp: utils.now()
  };

  if (plan.requiresMainWarning) {
    const validation = proposal.validation;
    for (const k of Object.keys(validation)) {
      if (validation[k] === 'not_run') validation[k] = 'required';
    }
  }

  store.addPushProposal(proposal);
  return { ok: true, proposal };
}

function statusText(proposal) {
  if (!proposal) return 'UNKNOWN';
  if (proposal.executorApproval === 'approved') return 'APPROVED';
  if (proposal.executorApproval === 'rejected') return 'REJECTED';
  if (proposal.status === 'pending_approval' || proposal.executorApproval === 'pending') return 'PENDING_APPROVAL';
  return 'DRAFT';
}

function approvePushProposal(proposalId, executorId, services) {
  const proposals = store.getPushProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  if (proposal.executorApproval === 'approved') return { ok: false, error: 'Already approved' };

  proposal.executorApproval = 'approved';
  proposal.executorApprovedAt = utils.now();
  proposal.executorProposedTo = executorId;
  proposal.status = 'approved';
  return { ok: true, proposal };
}

function rejectPushProposal(proposalId, reason, executorId) {
  const proposals = store.getPushProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };

  proposal.executorApproval = 'rejected';
  proposal.rejectionReason = reason || 'No reason given';
  proposal.executorApprovedAt = utils.now();
  proposal.executorProposedTo = executorId;
  proposal.status = 'rejected';
  return { ok: true, proposal };
}

function listPushProposals(filters) {
  const all = store.getPushProposals();
  if (!filters) return all;
  const { status, limit } = filters;
  let filtered = all;
  if (status) filtered = filtered.filter(p => p.status === status);
  if (limit) filtered = filtered.slice(0, limit);
  return filtered;
}

module.exports = {
  createPushProposal,
  statusText,
  approvePushProposal,
  rejectPushProposal,
  listPushProposals
};

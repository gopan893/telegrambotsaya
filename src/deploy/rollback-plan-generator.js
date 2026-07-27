'use strict';

const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

function createRollbackPlan(deployPlanId, failureReport, services) {
  const plans = store.getDeployPlans();
  const plan = plans.find(p => p.id === deployPlanId);
  if (!plan) return { ok: false, error: 'Deploy plan not found' };

  const lastKnownGood = detectLastKnownGoodRelease(services);
  const id = utils.shortId();

  const rollbackPlan = {
    id,
    failedDeployPlanId: deployPlanId,
    lastKnownGoodReleaseId: lastKnownGood.releaseId || null,
    rollbackTargetCommit: lastKnownGood.commitSha || plan.commitSha,
    rollbackTargetBranch: plan.branch,
    reason: failureReport?.reason || 'Deploy failure (unspecified)',
    riskLevel: plan.branch === 'main' ? 'medium' : 'low',
    requiredChecks: ['eval_v2', 'executor_approval'],
    executorApprovalRequired: true,
    status: 'draft',
    createdAt: utils.now()
  };

  store.addRollbackPlan(rollbackPlan);
  return { ok: true, plan: rollbackPlan };
}

function detectLastKnownGoodRelease(services) {
  const candidates = store.getReleaseCandidates();
  const deployed = candidates.filter(c => c.status === 'deployed').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (deployed.length > 0) {
    return { releaseId: deployed[0].id, commitSha: deployed[0].commitSha };
  }
  return { releaseId: null, commitSha: null };
}

function buildRollbackRiskSummary(rollbackPlan) {
  if (!rollbackPlan) return 'No rollback plan data.';
  const lines = ['## Rollback Risk Summary', ''];
  lines.push(`- Failed Deploy Plan: **${rollbackPlan.failedDeployPlanId}**`);
  lines.push(`- Rollback Target: **${rollbackPlan.rollbackTargetCommit || rollbackPlan.rollbackTargetBranch}**`);
  lines.push(`- Reason: **${rollbackPlan.reason}**`);
  lines.push(`- Risk Level: **${rollbackPlan.riskLevel}**`);
  lines.push(`- Executor Approval Required: ${rollbackPlan.executorApprovalRequired}`);
  lines.push('');
  lines.push(`Status: **${rollbackPlan.status}**`);
  if (!rollbackPlan.lastKnownGoodReleaseId) {
    lines.push('');
    lines.push('⚠️ No known good release found. Manual recovery guide recommended.');
  }
  return lines.join('\n');
}

function createRollbackProposal(rollbackPlanId, services) {
  const plans = store.getRollbackPlans();
  const plan = plans.find(p => p.id === rollbackPlanId);
  if (!plan) return { ok: false, error: 'Rollback plan not found' };

  const id = utils.shortId();
  const proposal = {
    id,
    rollbackPlanId,
    targetCommit: plan.rollbackTargetCommit,
    reason: plan.reason,
    executorApproval: null,
    executorApprovedAt: null,
    status: 'pending_approval',
    createdAt: utils.now()
  };

  store.addRollbackProposal(proposal);
  return { ok: true, proposal };
}

function linkRollbackPlanToProposal(rollbackPlanId, proposalId) {
  const plans = store.getRollbackPlans();
  const plan = plans.find(p => p.id === rollbackPlanId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  plan.proposalId = proposalId;
  return { ok: true };
}

function approveRollbackProposal(proposalId) {
  const proposals = store.getRollbackProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  proposal.executorApproval = 'approved';
  proposal.executorApprovedAt = utils.now();
  proposal.status = 'approved';
  return { ok: true, proposal };
}

function rejectRollbackProposal(proposalId, reason) {
  const proposals = store.getRollbackProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  proposal.executorApproval = 'rejected';
  proposal.rejectionReason = reason || 'No reason given';
  proposal.status = 'rejected';
  return { ok: true, proposal };
}

module.exports = {
  createRollbackPlan,
  detectLastKnownGoodRelease,
  buildRollbackRiskSummary,
  createRollbackProposal,
  linkRollbackPlanToProposal,
  approveRollbackProposal,
  rejectRollbackProposal
};

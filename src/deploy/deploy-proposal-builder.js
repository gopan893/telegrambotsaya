'use strict';

const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

function createDeployProposal(deployPlanId, services) {
  const plans = store.getDeployPlans();
  const plan = plans.find(p => p.id === deployPlanId);
  if (!plan) return { ok: false, error: 'Deploy plan not found' };

  const readiness = _validateInternal(plan);
  const blockers = readiness.blockers || [];

  const id = utils.shortId();
  const proposal = {
    id,
    deployPlanId,
    environment: plan.environment,
    targetProvider: plan.targetProvider,
    branch: plan.branch,
    commitSha: plan.commitSha,
    riskLevel: plan.riskLevel,
    blockers,
    evaluationStatus: 'not_run',
    executorProposalId: null,
    executorApproval: null,
    executorApprovedAt: null,
    status: blockers.length ? 'blocked' : 'pending_approval',
    createdAt: utils.now()
  };

  store.addDeployProposal(proposal);
  return { ok: true, proposal, blocked: blockers.length > 0, blockers };
}

function _validateInternal(plan) {
  const blockers = [];
  if (plan.blockers && plan.blockers.length > 0) blockers.push(...plan.blockers);
  if (plan.status === 'failed') blockers.push('Plan status is failed');
  return { ok: blockers.length === 0, blockers };
}

function runDeployEvaluationGate(deployPlan, evaluationSystem, services) {
  if (!evaluationSystem) return { ok: false, error: 'Evaluation system not available' };
  if (!deployPlan) return { ok: false, error: 'No deploy plan' };

  const evalResult = evaluationSystem.runEvalCases ? evaluationSystem.runEvalCases(['deployApprovalSafetyScore']) : null;
  if (!evalResult) return { ok: false, error: 'Evaluation failed' };

  return {
    ok: evalResult.deployApprovalSafetyScore >= 100,
    score: evalResult.deployApprovalSafetyScore,
    requiredScore: 100,
    passed: evalResult.deployApprovalSafetyScore >= 100,
    timestamp: utils.now()
  };
}

function createExecutorProposalForDeploy(deployPlan, executorSystem, services) {
  if (!executorSystem) return { ok: false, error: 'Executor system not available' };
  if (!deployPlan) return { ok: false, error: 'No deploy plan' };

  const proposal = executorSystem.createProposal ? executorSystem.createProposal({
    title: `Deploy: ${deployPlan.branch} to ${deployPlan.environment}`,
    description: `Deploy release candidate to ${deployPlan.targetProvider} (${deployPlan.environment})`,
    type: 'deploy',
    requiresApproval: true,
    riskLevel: deployPlan.riskLevel,
    environment: deployPlan.environment
  }) : null;

  if (!proposal) return { ok: false, error: 'Executor proposal creation failed' };

  return { ok: true, executorProposalId: proposal.id, proposal };
}

function linkDeployPlanToProposal(deployPlanId, proposalId) {
  const plans = store.getDeployPlans();
  const plan = plans.find(p => p.id === deployPlanId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  plan.proposalId = proposalId;
  return { ok: true };
}

function getDeployProposalStatus(deployPlanId) {
  const proposals = store.getDeployProposals();
  const planProposals = proposals.filter(p => p.deployPlanId === deployPlanId);
  if (planProposals.length === 0) return { ok: false, error: 'No proposals found' };
  const latest = planProposals[planProposals.length - 1];
  return {
    ok: true,
    proposalId: latest.id,
    status: latest.status,
    executorApproval: latest.executorApproval,
    approved: latest.executorApproval === 'approved',
    rejected: latest.executorApproval === 'rejected',
    timestamp: utils.now()
  };
}

module.exports = {
  createDeployProposal,
  runDeployEvaluationGate,
  createExecutorProposalForDeploy,
  linkDeployPlanToProposal,
  getDeployProposalStatus
};

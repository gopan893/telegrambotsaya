'use strict';

const store = require('./deploy-release-store');

function getDeploySummary(services) {
  const candidates = store.getReleaseCandidates();
  const plans = store.getDeployPlans();
  const proposals = store.getDeployProposals();
  const rollbackPlans = store.getRollbackPlans();
  const reports = store.getPostDeployReports();

  return {
    ok: true,
    totalReleaseCandidates: candidates.length,
    totalDeployPlans: plans.length,
    totalDeployProposals: proposals.length,
    totalRollbackPlans: rollbackPlans.length,
    totalPostDeployReports: reports.length,
    lastReleaseCandidate: candidates.length ? candidates[candidates.length - 1]?.id : null,
    lastDeployPlan: plans.length ? plans[plans.length - 1]?.id : null,
    timestamp: new Date().toISOString()
  };
}

module.exports = { getDeploySummary };

/* Deploy / Release frontend helper */

const DEPLOY = (() => {
  const BASE = '/deploy';

  async function getSummary() {
    return Api.apiGet(BASE);
  }

  async function listReleaseCandidates(filters) {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return Api.apiGet(`${BASE}/release-candidates${params}`);
  }

  async function createReleaseCandidate(input) {
    return Api.apiPost(`${BASE}/release-candidates`, input || {});
  }

  async function runRenderGate(releaseCandidateId) {
    return Api.apiPost(`${BASE}/render-gate`, { releaseCandidateId: releaseCandidateId || null });
  }

  async function checkEnv() {
    return Api.apiGet(`${BASE}/env-check`);
  }

  async function runStartupCheck() {
    return Api.apiPost(`${BASE}/startup-check`, {});
  }

  async function createDeployPlan(releaseCandidateId, target) {
    return Api.apiPost(`${BASE}/plan`, { releaseCandidateId, target: target || {} });
  }

  async function createDeployProposal(deployPlanId) {
    return Api.apiPost(`${BASE}/proposal`, { deployPlanId });
  }

  async function runPostDeployCheck(deployPlanId) {
    return Api.apiPost(`${BASE}/post-check`, { deployPlanId: deployPlanId || null });
  }

  async function createRollbackPlan(deployPlanId, failureReport) {
    return Api.apiPost(`${BASE}/rollback-plan`, { deployPlanId, failureReport: failureReport || {} });
  }

  async function createRollbackProposal(rollbackPlanId) {
    return Api.apiPost(`${BASE}/rollback-proposal`, { rollbackPlanId });
  }

  async function getReleaseGate() {
    return Api.apiGet(`${BASE}/release-gate`);
  }

  return {
    getSummary,
    listReleaseCandidates,
    createReleaseCandidate,
    runRenderGate,
    checkEnv,
    runStartupCheck,
    createDeployPlan,
    createDeployProposal,
    runPostDeployCheck,
    createRollbackPlan,
    createRollbackProposal,
    getReleaseGate
  };
})();

window.DEPLOY = DEPLOY;

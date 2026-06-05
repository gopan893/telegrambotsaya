/* GitHub Ops frontend helper */

const GITHUBOPS = (() => {
  const BASE = '/api/dashboard/githubops';

  async function repoState() {
    return Api.apiGet(`${BASE}/repo-state`);
  }

  async function changeManifest() {
    return Api.apiGet(`${BASE}/change-manifest`);
  }

  async function runSecretScan() {
    return Api.apiPost(`${BASE}/secret-scan`, {});
  }

  async function createCommitPlan() {
    return Api.apiPost(`${BASE}/commit-plan`, {});
  }

  async function createPushPlan() {
    return Api.apiPost(`${BASE}/push-plan`, {});
  }

  async function createPushProposal() {
    return Api.apiPost(`${BASE}/push-proposal`, {});
  }

  async function approvePushProposal(id, executorId) {
    return Api.apiPost(`${BASE}/push-proposal/${id}/approve`, { executorId: executorId || 'dashboard-admin' });
  }

  async function rejectPushProposal(id, reason) {
    return Api.apiPost(`${BASE}/push-proposal/${id}/reject`, { reason: reason || 'Rejected via dashboard', executorId: 'dashboard-admin' });
  }

  async function listPushProposals(filters) {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return Api.apiGet(`${BASE}/push-proposals${params}`);
  }

  async function listWorkflows() {
    return Api.apiGet(`${BASE}/workflows`);
  }

  async function createWorkflowRunProposal(workflow, ref) {
    return Api.apiPost(`${BASE}/workflow-run-proposal`, { workflow, ref: ref || 'main' });
  }

  async function approveWorkflowRunProposal(id, executorId) {
    return Api.apiPost(`${BASE}/workflow-run-proposal/${id}/approve`, { executorId: executorId || 'dashboard-admin' });
  }

  async function rejectWorkflowRunProposal(id, reason) {
    return Api.apiPost(`${BASE}/workflow-run-proposal/${id}/reject`, { reason: reason || 'Rejected via dashboard', executorId: 'dashboard-admin' });
  }

  async function listWorkflowRunProposals(filters) {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return Api.apiGet(`${BASE}/workflow-run-proposals${params}`);
  }

  async function runFullPipeline() {
    return Api.apiPost(`${BASE}/pipeline`, {});
  }

  async function getPipelineSummary() {
    return Api.apiGet(`${BASE}/pipeline-summary`);
  }

  async function getReleaseGate() {
    return Api.apiGet(`${BASE}/release-gate`);
  }

  return {
    repoState,
    changeManifest,
    runSecretScan,
    createCommitPlan,
    createPushPlan,
    createPushProposal,
    approvePushProposal,
    rejectPushProposal,
    listPushProposals,
    listWorkflows,
    createWorkflowRunProposal,
    approveWorkflowRunProposal,
    rejectWorkflowRunProposal,
    listWorkflowRunProposals,
    runFullPipeline,
    getPipelineSummary,
    getReleaseGate
  };
})();

window.GITHUBOPS = GITHUBOPS;

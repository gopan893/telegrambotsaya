'use strict';

const utils = require('./deploy-utils');
const store = require('./deploy-release-store');

function createReleaseCandidate(input, services) {
  const id = utils.shortId();
  const candidate = {
    id,
    workspaceId: input?.workspaceId || null,
    userId: input?.userId || null,
    branch: input?.branch || 'main',
    commitSha: input?.commitSha || null,
    commitMessage: input?.commitMessage || null,
    githubRunId: input?.githubRunId || null,
    secretScanStatus: input?.secretScanStatus || 'not_run',
    testMatrixStatus: input?.testMatrixStatus || 'not_run',
    releaseGateStatus: input?.releaseGateStatus || 'not_run',
    evaluationStatus: input?.evaluationStatus || 'not_run',
    deployPlanId: null,
    rollbackPlanId: null,
    status: 'draft',
    createdAt: utils.now(),
    updatedAt: utils.now()
  };
  store.addReleaseCandidate(candidate);
  return { ok: true, candidate };
}

function getReleaseCandidate(id) {
  const candidates = store.getReleaseCandidates();
  const found = candidates.find(c => c.id === id);
  return found ? { ok: true, candidate: found } : { ok: false, error: 'NOT_FOUND' };
}

function listReleaseCandidates(filters) {
  let all = store.getReleaseCandidates();
  if (filters?.status) all = all.filter(c => c.status === filters.status);
  if (filters?.branch) all = all.filter(c => c.branch === filters.branch);
  if (filters?.limit) all = all.slice(0, filters.limit);
  return { ok: true, candidates: all };
}

function updateReleaseCandidateStatus(id, status) {
  const candidates = store.getReleaseCandidates();
  const idx = candidates.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
  candidates[idx].status = status;
  candidates[idx].updatedAt = utils.now();
  store.addReleaseCandidate(candidates[idx]);
  return { ok: true, candidate: candidates[idx] };
}

function linkReleaseCandidateToGithubRun(id, runId) {
  const candidates = store.getReleaseCandidates();
  const idx = candidates.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
  candidates[idx].githubRunId = runId;
  candidates[idx].updatedAt = utils.now();
  return { ok: true, candidate: candidates[idx] };
}

function linkReleaseCandidateToDeployPlan(id, deployPlanId) {
  const candidates = store.getReleaseCandidates();
  const idx = candidates.findIndex(c => c.id === id);
  if (idx === -1) return { ok: false, error: 'NOT_FOUND' };
  candidates[idx].deployPlanId = deployPlanId;
  candidates[idx].updatedAt = utils.now();
  return { ok: true, candidate: candidates[idx] };
}

module.exports = {
  createReleaseCandidate,
  getReleaseCandidate,
  listReleaseCandidates,
  updateReleaseCandidateStatus,
  linkReleaseCandidateToGithubRun,
  linkReleaseCandidateToDeployPlan
};

'use strict';

const utils = require('./release-utils');

const DEFAULT_VERSION = 'v1.0.0-rc.1';
const ALLOWED_STATUSES = ['draft', 'checking', 'ready', 'blocked', 'released', 'archived'];

function createInitialStore() {
  return {
    candidates: [],
    freezes: []
  };
}

let store = createInitialStore();

function resetStore() {
  store = createInitialStore();
  return store;
}

function getStore() {
  return store;
}

function createReleaseCandidate(input = {}, services = {}) {
  const id = utils.generateId();
  const now = utils.formatTimestamp();
  const env = services.env || process.env || {};

  const candidate = {
    id,
    workspaceId: input.workspaceId || 'default',
    version: input.version || DEFAULT_VERSION,
    title: input.title || 'Stable AI OS v1 Release Candidate',
    status: 'draft',
    branch: input.branch || 'main',
    commitSha: input.commitSha || '',
    moduleReadinessStatus: null,
    productionReadinessStatus: null,
    securityStatus: null,
    privacyStatus: null,
    dashboardStatus: null,
    telegramStatus: null,
    executorStatus: null,
    deployStatus: null,
    releaseGateStatus: null,
    blockers: [],
    warnings: [],
    reportId: null,
    createdAt: now,
    updatedAt: now
  };

  store.candidates.push(candidate);
  return candidate;
}

function getReleaseCandidate(id) {
  return store.candidates.find(c => c.id === id) || null;
}

function updateReleaseCandidate(id, patch = {}) {
  const idx = store.candidates.findIndex(c => c.id === id);
  if (idx === -1) return null;
  const forbidden = ['id', 'createdAt'];
  for (const key of forbidden) {
    delete patch[key];
  }
  if (patch.status && !ALLOWED_STATUSES.includes(patch.status)) {
    delete patch.status;
  }
  store.candidates[idx] = {
    ...store.candidates[idx],
    ...patch,
    updatedAt: utils.formatTimestamp()
  };
  return store.candidates[idx];
}

function listReleaseCandidates(filter = {}) {
  let items = [...store.candidates];
  if (filter.status) {
    items = items.filter(c => c.status === filter.status);
  }
  if (filter.version) {
    items = items.filter(c => c.version === filter.version);
  }
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getLatestReleaseCandidate() {
  if (store.candidates.length === 0) return null;
  return store.candidates.reduce((latest, c) =>
    new Date(c.createdAt) > new Date(latest.createdAt) ? c : latest
  );
}

function addBlocker(id, blocker) {
  const candidate = getReleaseCandidate(id);
  if (!candidate) return null;
  if (!candidate.blockers.includes(blocker)) {
    candidate.blockers.push(blocker);
    candidate.updatedAt = utils.formatTimestamp();
  }
  return candidate;
}

function addWarning(id, warning) {
  const candidate = getReleaseCandidate(id);
  if (!candidate) return null;
  if (!candidate.warnings.includes(warning)) {
    candidate.warnings.push(warning);
    candidate.updatedAt = utils.formatTimestamp();
  }
  return candidate;
}

function archiveReleaseCandidate(id) {
  return updateReleaseCandidate(id, { status: 'archived' });
}

module.exports = {
  resetStore,
  getStore,
  createReleaseCandidate,
  getReleaseCandidate,
  updateReleaseCandidate,
  listReleaseCandidates,
  getLatestReleaseCandidate,
  addBlocker,
  addWarning,
  archiveReleaseCandidate,
  DEFAULT_VERSION,
  ALLOWED_STATUSES
};

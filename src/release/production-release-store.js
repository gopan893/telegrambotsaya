'use strict';

const utils = require('./release-utils');

function createInitialStore() {
  return { releases: [] };
}

let store = createInitialStore();

function resetStore() { store = createInitialStore(); return store; }
function getStore() { return store; }

function createProductionRelease(input = {}) {
  const id = utils.generateId();
  const now = utils.formatTimestamp();
  const release = {
    id,
    workspaceId: input.workspaceId || 'default',
    version: input.version || 'v1.0.0',
    sourceRcVersion: input.sourceRcVersion || 'v1.0.0-rc.1',
    status: 'draft',
    releaseReadinessStatus: null,
    rolloutStatus: null,
    deployStatus: null,
    postReleaseHealthStatus: null,
    blockers: [],
    warnings: [],
    proposalIds: { githubRelease: null, deploy: null },
    rolloutPlanIds: [],
    createdAt: now,
    updatedAt: now
  };
  store.releases.push(release);
  return release;
}

function getProductionRelease(id) {
  return store.releases.find(r => r.id === id) || null;
}

function updateProductionRelease(id, patch = {}) {
  const idx = store.releases.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const forbidden = ['id', 'createdAt'];
  for (const key of forbidden) delete patch[key];
  store.releases[idx] = { ...store.releases[idx], ...patch, updatedAt: utils.formatTimestamp() };
  return store.releases[idx];
}

function listProductionReleases(filter = {}) {
  let items = [...store.releases];
  if (filter.status) items = items.filter(r => r.status === filter.status);
  if (filter.version) items = items.filter(r => r.version === filter.version);
  return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getLatestProductionRelease() {
  if (store.releases.length === 0) return null;
  return store.releases.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

function addBlocker(id, blocker) {
  const r = getProductionRelease(id);
  if (!r) return null;
  if (!r.blockers.includes(blocker)) { r.blockers.push(blocker); r.updatedAt = utils.formatTimestamp(); }
  return r;
}

function addWarning(id, warning) {
  const r = getProductionRelease(id);
  if (!r) return null;
  if (!r.warnings.includes(warning)) { r.warnings.push(warning); r.updatedAt = utils.formatTimestamp(); }
  return r;
}

function sanitize(release) {
  if (!release) return null;
  return { ...release };
}

module.exports = {
  resetStore, getStore, createProductionRelease, getProductionRelease,
  updateProductionRelease, listProductionReleases, getLatestProductionRelease,
  addBlocker, addWarning, sanitize
};

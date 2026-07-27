'use strict';

const store = new Map();

function getReleaseCandidate(id) {
  return store.get(id) || null;
}

function createReleaseCandidate(data) {
  const id = data.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();
  const candidate = {
    id,
    workspaceId: data.workspaceId || '',
    version: data.version || 'v2.0.0-rc.1',
    status: data.status || 'draft',
    sourceVersion: data.sourceVersion || '',
    registryV2Status: data.registryV2Status || 'pending',
    boundaryStatus: data.boundaryStatus || 'pending',
    performanceStatus: data.performanceStatus || 'pending',
    controlPanelStatus: data.controlPanelStatus || 'pending',
    safetyStatus: data.safetyStatus || 'pending',
    compatibilityStatus: data.compatibilityStatus || 'pending',
    blockers: data.blockers || [],
    warnings: data.warnings || [],
    proposalIds: data.proposalIds || [],
    createdAt: now,
    updatedAt: now,
  };
  store.set(id, candidate);
  return candidate;
}

function listReleaseCandidates() {
  return Array.from(store.values());
}

function updateReleaseCandidate(id, data) {
  const existing = store.get(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated = { ...existing, ...data, id, updatedAt: now };
  store.set(id, updated);
  return updated;
}

function clearAll() {
  store.clear();
}

module.exports = {
  getReleaseCandidate,
  createReleaseCandidate,
  listReleaseCandidates,
  updateReleaseCandidate,
  clearAll,
};

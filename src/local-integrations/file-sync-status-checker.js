'use strict';

const store = {
  syncJobs: new Map(),
  syncHistory: new Map()
};

const SYNC_STATUSES = ['synced', 'syncing', 'pending', 'error', 'conflict'];

function registerSyncJob(params) {
  if (!params || !params.id || !params.sourcePath || !params.targetPath) {
    return { ok: false, error: 'Missing id, sourcePath, or targetPath' };
  }
  const job = {
    id: params.id,
    sourcePath: params.sourcePath,
    targetPath: params.targetPath,
    nodeId: params.nodeId || '',
    status: 'pending',
    lastSyncAt: null,
    fileCount: 0,
    errorCount: 0,
    lastError: null,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString()
  };
  store.syncJobs.set(params.id, job);
  return { ok: true, job };
}

function getSyncJob(jobId) {
  return store.syncJobs.get(String(jobId)) || null;
}

function listSyncJobs(filter) {
  let arr = Array.from(store.syncJobs.values());
  if (filter) {
    if (filter.status) arr = arr.filter(j => j.status === filter.status);
    if (filter.nodeId) arr = arr.filter(j => j.nodeId === filter.nodeId);
  }
  return arr;
}

function updateSyncStatus(jobId, status, details) {
  const job = store.syncJobs.get(String(jobId));
  if (!job) return { ok: false, error: 'Sync job not found' };
  if (!SYNC_STATUSES.includes(status)) return { ok: false, error: 'Invalid status' };

  job.status = status;
  if (status === 'synced') job.lastSyncAt = new Date().toISOString();
  if (details && details.fileCount !== undefined) job.fileCount = details.fileCount;
  if (details && details.error) {
    job.errorCount++;
    job.lastError = details.error;
  }
  store.syncJobs.set(String(jobId), job);

  const history = store.syncHistory.get(String(jobId)) || [];
  history.push({ status, at: new Date().toISOString(), details: details || {} });
  if (history.length > 100) history.splice(0, history.length - 100);
  store.syncHistory.set(String(jobId), history);

  return { ok: true, job };
}

function getSyncHistory(jobId) {
  return store.syncHistory.get(String(jobId)) || [];
}

function getSyncSummary() {
  const jobs = Array.from(store.syncJobs.values());
  const stats = { total: jobs.length, synced: 0, syncing: 0, pending: 0, error: 0, conflict: 0 };
  for (const j of jobs) stats[j.status] = (stats[j.status] || 0) + 1;
  return stats;
}

function detectSyncErrors() {
  return Array.from(store.syncJobs.values()).filter(j => j.status === 'error');
}

function removeSyncJob(jobId) {
  const exists = store.syncJobs.get(String(jobId));
  if (!exists) return { ok: false, error: 'Sync job not found' };
  store.syncJobs.delete(String(jobId));
  store.syncHistory.delete(String(jobId));
  return { ok: true };
}

function resetChecker() {
  store.syncJobs.clear();
  store.syncHistory.clear();
}

module.exports = {
  registerSyncJob, getSyncJob, listSyncJobs,
  updateSyncStatus, getSyncHistory, getSyncSummary,
  detectSyncErrors, removeSyncJob, resetChecker, SYNC_STATUSES
};

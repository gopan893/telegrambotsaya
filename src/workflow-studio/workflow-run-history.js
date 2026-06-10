'use strict';

const store = require('./workflow-store');

function getRunHistory(workflowId, limit) {
  return store.getRunHistory(workflowId, limit);
}

function getRunStats(workflowId) {
  const runs = store.getRunHistory(workflowId, 200);
  const stats = { total: runs.length, success: 0, failed: 0, pending: 0 };
  for (const run of runs) {
    if (run.status === 'completed' || run.status === 'success') stats.success++;
    else if (run.status === 'failed' || run.status === 'error') stats.failed++;
    else stats.pending++;
  }
  stats.successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
  return stats;
}

function getLatestRun(workflowId) {
  const runs = store.getRunHistory(workflowId, 1);
  return runs.length > 0 ? runs[0] : null;
}

function formatRunEntry(entry) {
  if (!entry) return null;
  return {
    workflowId: entry.workflowId,
    status: entry.status,
    timestamp: entry.timestamp,
    duration: entry.duration || 0
  };
}

module.exports = { getRunHistory, getRunStats, getLatestRun, formatRunEntry };

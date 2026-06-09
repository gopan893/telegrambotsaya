'use strict';

const logStore = [];

function logExecution(recipeId, event, detail = {}) {
  const entry = {
    id: `rlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    recipeId,
    event,
    detail: typeof detail === 'object' ? { ...detail } : { message: String(detail) },
    timestamp: new Date().toISOString()
  };
  logStore.push(entry);
  if (logStore.length > 2000) logStore.splice(0, logStore.length - 2000);
  return entry;
}

function getRecipeLogs(recipeId, limit = 50) {
  return logStore.filter(l => l.recipeId === recipeId).slice(-limit);
}

function getAllLogs(limit = 100) {
  return logStore.slice(-limit);
}

function getLogStats() {
  const counts = {};
  for (const entry of logStore) {
    counts[entry.recipeId] = (counts[entry.recipeId] || 0) + 1;
    counts._total = (counts._total || 0) + 1;
  }
  return counts;
}

function clearLogs() {
  logStore.length = 0;
}

module.exports = { logExecution, getRecipeLogs, getAllLogs, getLogStats, clearLogs };

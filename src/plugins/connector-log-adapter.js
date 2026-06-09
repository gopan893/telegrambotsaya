'use strict';

const logStore = [];

function logConnectorEvent(connectorId, event, detail = {}) {
  const entry = {
    id: `${connectorId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    connectorId,
    event,
    detail: typeof detail === 'object' ? { ...detail } : { message: String(detail) },
    timestamp: new Date().toISOString()
  };
  logStore.push(entry);
  if (logStore.length > 1000) logStore.splice(0, logStore.length - 1000);
  return entry;
}

function getConnectorLogs(connectorId, limit = 50) {
  const filtered = logStore.filter(l => l.connectorId === connectorId);
  return filtered.slice(-limit);
}

function getAllConnectorLogs(limit = 100) {
  return logStore.slice(-limit);
}

function clearLogs() {
  logStore.length = 0;
}

function getLogStats() {
  const counts = {};
  for (const entry of logStore) {
    counts[entry.connectorId] = (counts[entry.connectorId] || 0) + 1;
  }
  return { total: logStore.length, byConnector: counts };
}

module.exports = { logConnectorEvent, getConnectorLogs, getAllConnectorLogs, clearLogs, getLogStats };

'use strict';

const store = {
  nasNodes: new Map(),
  healthHistory: new Map(),
  storageRecords: new Map(),
  syncRecords: new Map(),
  backupRecords: new Map()
};

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown'];

function registerNasNode(params) {
  if (!params || !params.id || !params.name) {
    return { ok: false, error: 'Missing id or name' };
  }
  const node = {
    id: params.id,
    name: params.name,
    type: params.type || 'nas',
    status: 'unknown',
    lastCheckAt: null,
    storage: { totalGb: 0, usedGb: 0, freeGb: 0 },
    syncStatus: 'unknown',
    backupStatus: 'unknown',
    errorCount: 0,
    consecutiveFailures: 0,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString()
  };
  store.nasNodes.set(params.id, node);
  return { ok: true, node };
}

function getNasNode(nodeId) {
  return store.nasNodes.get(String(nodeId)) || null;
}

function listNasNodes(filter) {
  let arr = Array.from(store.nasNodes.values());
  if (filter && filter.status) arr = arr.filter(n => n.status === filter.status);
  return arr;
}

function recordHealthCheck(nodeId, status, message) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };

  const validStatus = HEALTH_STATES.includes(status) ? status : 'unknown';
  node.status = validStatus;
  node.lastCheckAt = new Date().toISOString();
  if (validStatus === 'healthy') node.consecutiveFailures = 0;
  else if (validStatus === 'unhealthy') node.consecutiveFailures++;

  const history = store.healthHistory.get(String(nodeId)) || [];
  history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (history.length > 100) history.splice(0, history.length - 100);
  store.healthHistory.set(String(nodeId), history);

  store.nasNodes.set(String(nodeId), node);
  return { ok: true, node };
}

function updateStorageStatus(nodeId, storage) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  node.storage = {
    totalGb: storage.totalGb || 0,
    usedGb: storage.usedGb || 0,
    freeGb: storage.freeGb || 0
  };
  node.lastCheckAt = new Date().toISOString();
  store.nasNodes.set(String(nodeId), node);
  return { ok: true, node };
}

function updateSyncStatus(nodeId, syncStatus) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  node.syncStatus = syncStatus || 'unknown';
  node.lastCheckAt = new Date().toISOString();
  store.nasNodes.set(String(nodeId), node);
  return { ok: true, node };
}

function updateBackupStatus(nodeId, backupStatus) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  node.backupStatus = backupStatus || 'unknown';
  node.lastCheckAt = new Date().toISOString();
  store.nasNodes.set(String(nodeId), node);
  return { ok: true, node };
}

function getStorageStatus(nodeId) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  return { ok: true, storage: node.storage, nodeId };
}

function getSyncStatus(nodeId) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  return { ok: true, syncStatus: node.syncStatus, nodeId };
}

function getBackupStatus(nodeId) {
  const node = store.nasNodes.get(String(nodeId));
  if (!node) return { ok: false, error: 'NAS node not found' };
  return { ok: true, backupStatus: node.backupStatus, nodeId };
}

function getMonitorStats() {
  const nodes = Array.from(store.nasNodes.values());
  const stats = { total: nodes.length, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  for (const n of nodes) stats[n.status] = (stats[n.status] || 0) + 1;
  return stats;
}

function removeNasNode(nodeId) {
  const exists = store.nasNodes.get(String(nodeId));
  if (!exists) return { ok: false, error: 'NAS node not found' };
  store.nasNodes.delete(String(nodeId));
  store.healthHistory.delete(String(nodeId));
  return { ok: true };
}

function resetMonitor() {
  store.nasNodes.clear();
  store.healthHistory.clear();
  store.storageRecords.clear();
  store.syncRecords.clear();
  store.backupRecords.clear();
}

module.exports = {
  registerNasNode, getNasNode, listNasNodes,
  recordHealthCheck, updateStorageStatus, updateSyncStatus, updateBackupStatus,
  getStorageStatus, getSyncStatus, getBackupStatus,
  getMonitorStats, removeNasNode, resetMonitor, HEALTH_STATES
};

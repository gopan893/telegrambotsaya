'use strict';

const utils = require('./module-boundary-utils');
const store = require('./module-boundary-store');

const VALID_STATUSES = ['not_loaded', 'loaded', 'ready', 'degraded', 'disabled', 'failed', 'unknown'];

function _getStatusData(moduleName) {
  const manifest = store.getModuleManifest(moduleName);
  if (!manifest) return { status: 'unknown', statusCode: -1 };
  const statusOrder = { not_loaded: 0, loaded: 1, ready: 2, degraded: 3, disabled: 4, failed: 5, unknown: -1 };
  const currentStatus = manifest.status || 'not_loaded';
  return { status: currentStatus, statusCode: statusOrder[currentStatus] || -1, manifest };
}

function getModuleLifecycleStatus(moduleName, services) {
  const data = _getStatusData(moduleName);
  return { module: moduleName, status: data.status, statusCode: data.statusCode };
}

function listModuleLifecycleStatus(services) {
  const all = store.listModuleManifests();
  if (all.length === 0) return [];
  return all.map(m => ({
    module: m.module,
    status: m.status || 'not_loaded',
    criticality: m.criticality || 'optional'
  }));
}

function markModuleDegraded(moduleName, reason, services) {
  const manifest = store.getModuleManifest(moduleName);
  if (!manifest) return { success: false, error: `module ${moduleName} not found` };
  manifest.status = 'degraded';
  manifest.degradedReason = reason || 'no reason provided';
  manifest.updatedAt = new Date().toISOString();
  store.registerModuleManifest(manifest);
  return { success: true, module: moduleName, status: 'degraded', reason: manifest.degradedReason };
}

function buildModuleLifecycleReport(services) {
  const all = listModuleLifecycleStatus(services);
  const byStatus = {};
  for (const entry of all) {
    if (!byStatus[entry.status]) byStatus[entry.status] = [];
    byStatus[entry.status].push(entry.module);
  }
  return {
    total: all.length,
    byStatus,
    modules: all
  };
}

module.exports = {
  getModuleLifecycleStatus,
  listModuleLifecycleStatus,
  markModuleDegraded,
  buildModuleLifecycleReport,
  VALID_STATUSES
};

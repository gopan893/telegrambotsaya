'use strict';

const store = require('./storage-boundary-store');
const utils = require('./storage-boundary-utils');

const COMMON_ACCESS_ITEMS = [
  { id: 'core-db', module: 'core', storageType: 'postgres', accessType: 'read', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'core', status: 'active' },
  { id: 'core-db-write', module: 'core', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'core', status: 'active' },
  { id: 'dashboard-session', module: 'dashboard', storageType: 'redis', accessType: 'read', required: true, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'medium', ownerModule: 'dashboard', status: 'active' },
  { id: 'dashboard-session-write', module: 'dashboard', storageType: 'redis', accessType: 'write', required: true, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'medium', ownerModule: 'dashboard', status: 'active' },
  { id: 'telegram-state', module: 'telegram-control', storageType: 'redis', accessType: 'read', required: true, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'medium', ownerModule: 'telegram-control', status: 'active' },
  { id: 'telegram-state-write', module: 'telegram-control', storageType: 'redis', accessType: 'write', required: true, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'medium', ownerModule: 'telegram-control', status: 'active' },
  { id: 'agents-persistence', module: 'agents', storageType: 'postgres', accessType: 'read', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'agents', status: 'active' },
  { id: 'agents-persistence-write', module: 'agents', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'agents', status: 'active' },
  { id: 'lifeos-private', module: 'lifeos', storageType: 'postgres', accessType: 'read', required: true, fallbackAllowed: true, fallbackType: 'json', sensitivity: 'high', ownerModule: 'lifeos', status: 'active' },
  { id: 'lifeos-private-write', module: 'lifeos', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'lifeos', status: 'active' },
  { id: 'knowledge-store', module: 'knowledge', storageType: 'postgres', accessType: 'read', required: true, fallbackAllowed: true, fallbackType: 'json', sensitivity: 'high', ownerModule: 'knowledge', status: 'active' },
  { id: 'knowledge-store-write', module: 'knowledge', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'knowledge', status: 'active' },
  { id: 'privacy-audit', module: 'privacy', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'privacy', status: 'active' },
  { id: 'security-audit', module: 'security', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'high', ownerModule: 'security', status: 'active' },
  { id: 'monitoring-metrics', module: 'monitoring', storageType: 'redis', accessType: 'write', required: false, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'low', ownerModule: 'monitoring', status: 'active' },
  { id: 'cost-tracking', module: 'cost', storageType: 'postgres', accessType: 'write', required: true, fallbackAllowed: false, fallbackType: null, sensitivity: 'medium', ownerModule: 'cost', status: 'active' },
  { id: 'plugins-config', module: 'plugins', storageType: 'json', accessType: 'read', required: true, fallbackAllowed: true, fallbackType: 'memory', sensitivity: 'medium', ownerModule: 'plugins', status: 'active' },
  { id: 'plugins-config-write', module: 'plugins', storageType: 'json', accessType: 'write', required: false, fallbackAllowed: false, fallbackType: null, sensitivity: 'medium', ownerModule: 'plugins', status: 'active' },
];

function _ensurePrepopulated(services) {
  const existing = store.listStorageAccess();
  if (existing.length > 0) return;
  for (const item of COMMON_ACCESS_ITEMS) {
    store.registerStorageAccess(item);
  }
}

function registerStorageAccess(item, services) {
  _ensurePrepopulated(services);
  return store.registerStorageAccess(item);
}

function listStorageAccess(filters, services) {
  _ensurePrepopulated(services);
  return store.listStorageAccess(filters);
}

function getStorageAccessForModule(moduleName, services) {
  _ensurePrepopulated(services);
  return store.getStorageAccessForModule(moduleName);
}

function validateStorageAccessRegistry(services) {
  const all = store.listStorageAccess();
  const issues = [];
  for (const entry of all) {
    if (!entry.module) issues.push({ id: entry.id, issue: 'missing module name' });
    if (!entry.storageType) issues.push({ id: entry.id, issue: 'missing storage type' });
    if (!['postgres', 'redis', 'json', 'memory', 'file', 'external', 'unknown'].includes(entry.storageType)) {
      issues.push({ id: entry.id, issue: `invalid storage type: ${entry.storageType}` });
    }
    if (!['read', 'write', 'archive', 'delete_request', 'dangerous'].includes(entry.accessType)) {
      issues.push({ id: entry.id, issue: `invalid access type: ${entry.accessType}` });
    }
  }
  return { valid: issues.length === 0, total: all.length, issues };
}

function detectUnsafeStorageAccess(services) {
  const all = store.listStorageAccess();
  const unsafe = all.filter(e =>
    e.accessType === 'dangerous' ||
    (e.accessType === 'delete_request' && !e.fallbackAllowed) ||
    (e.storageType === 'memory' && e.sensitivity === 'high' && e.required)
  );
  return unsafe.map(e => ({
    id: e.id,
    module: e.module,
    storageType: e.storageType,
    accessType: e.accessType,
    reason: e.accessType === 'dangerous' ? 'dangerous access type' :
            e.accessType === 'delete_request' ? 'delete without fallback' :
            'high sensitivity in memory store'
  }));
}

function buildStorageAccessReport(services) {
  _ensurePrepopulated(services);
  const all = store.listStorageAccess();
  const byModule = {};
  for (const entry of all) {
    if (!byModule[entry.module]) byModule[entry.module] = [];
    byModule[entry.module].push(entry);
  }
  const validation = validateStorageAccessRegistry(services);
  const unsafe = detectUnsafeStorageAccess(services);
  return { total: all.length, byModule, validation, unsafe };
}

module.exports = {
  registerStorageAccess,
  listStorageAccess,
  getStorageAccessForModule,
  validateStorageAccessRegistry,
  detectUnsafeStorageAccess,
  buildStorageAccessReport
};

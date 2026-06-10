'use strict';

const store = require('./device-store');
const utils = require('./device-utils');

const VALID_TYPES = ['android_termux', 'mac', 'nas', 'local_ai', 'browser_pwa', 'vps', 'unknown'];
const VALID_STATUSES = ['paired', 'unpaired', 'pending', 'disabled', 'unreachable'];
const VALID_TRUST = ['full', 'standard', 'restricted', 'untrusted'];

function createDevice(params) {
  if (!params || !params.name || !params.type) {
    return { ok: false, error: 'Missing required fields: name, type' };
  }
  if (!VALID_TYPES.includes(params.type)) {
    return { ok: false, error: 'Invalid device type: ' + params.type };
  }
  const id = params.id || utils.createId('dev');
  const device = {
    id,
    workspaceId: params.workspaceId || 'default',
    name: utils.sanitizeText(params.name, 100),
    type: params.type,
    status: params.status || 'pending',
    trustLevel: params.trustLevel || 'standard',
    ownerOnly: params.ownerOnly !== undefined ? Boolean(params.ownerOnly) : false,
    localOnly: params.localOnly !== undefined ? Boolean(params.localOnly) : true,
    lastSeenAt: null,
    capabilities: Array.isArray(params.capabilities) ? params.capabilities : [],
    riskProfile: params.riskProfile || { level: 'low', proposalRequired: false },
    safeActions: Array.isArray(params.safeActions) ? params.safeActions : [],
    proposalOnlyActions: Array.isArray(params.proposalOnlyActions) ? params.proposalOnlyActions : [],
    blockedActions: Array.isArray(params.blockedActions) ? params.blockedActions : [],
    metadata: params.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.setDevice(id, device);
  return { ok: true, device };
}

function registerDevice(params) {
  return createDevice(params);
}

function getDevice(deviceId) {
  return store.getDevice(deviceId);
}

function listDevices(filter) {
  return store.listDevices(filter);
}

function updateDevice(deviceId, updates) {
  const existing = store.getDevice(deviceId);
  if (!existing) return { ok: false, error: 'Device not found' };
  const allowed = ['name', 'status', 'trustLevel', 'ownerOnly', 'localOnly', 'capabilities', 'safeActions', 'proposalOnlyActions', 'blockedActions', 'metadata'];
  const patched = { ...existing };
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'name') patched[key] = utils.sanitizeText(updates[key], 100);
      else if (key === 'status') patched[key] = VALID_STATUSES.includes(updates[key]) ? updates[key] : patched[key];
      else if (key === 'trustLevel') patched[key] = VALID_TRUST.includes(updates[key]) ? updates[key] : patched[key];
      else patched[key] = updates[key];
    }
  }
  patched.updatedAt = new Date().toISOString();
  store.setDevice(deviceId, patched);
  return { ok: true, device: patched };
}

function removeDevice(deviceId) {
  const existing = store.getDevice(deviceId);
  if (!existing) return { ok: false, error: 'Device not found' };
  store.removeDevice(deviceId);
  return { ok: true, removed: deviceId };
}

function validateRegistry() {
  const devices = store.listDevices();
  const issues = [];
  for (const dev of devices) {
    if (!dev.name) issues.push({ deviceId: dev.id, issue: 'missing_name' });
    if (!VALID_TYPES.includes(dev.type)) issues.push({ deviceId: dev.id, issue: 'invalid_type' });
    if (!VALID_STATUSES.includes(dev.status)) issues.push({ deviceId: dev.id, issue: 'invalid_status' });
    if (!VALID_TRUST.includes(dev.trustLevel)) issues.push({ deviceId: dev.id, issue: 'invalid_trust_level' });
  }
  return { valid: issues.length === 0, issues, deviceCount: devices.length };
}

function getRegistryStats() {
  const devices = store.listDevices();
  const byType = {};
  const byStatus = {};
  const byTrust = {};
  for (const d of devices) {
    byType[d.type] = (byType[d.type] || 0) + 1;
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    byTrust[d.trustLevel] = (byTrust[d.trustLevel] || 0) + 1;
  }
  return { total: devices.length, byType, byStatus, byTrust };
}

module.exports = {
  createDevice, registerDevice, getDevice, listDevices,
  updateDevice, removeDevice, validateRegistry, getRegistryStats,
  VALID_TYPES, VALID_STATUSES, VALID_TRUST
};

'use strict';

const store = require('./device-store');

const BUILTIN_CAPABILITIES = [
  { id: 'read_state', label: 'Read Device State', riskLevel: 'low', proposalRequired: false },
  { id: 'send_notification', label: 'Send Notification', riskLevel: 'low', proposalRequired: false },
  { id: 'execute_action', label: 'Execute Action', riskLevel: 'medium', proposalRequired: true },
  { id: 'modify_config', label: 'Modify Configuration', riskLevel: 'medium', proposalRequired: true },
  { id: 'access_secrets', label: 'Access Secrets', riskLevel: 'high', proposalRequired: true },
  { id: 'run_shell', label: 'Run Shell Command', riskLevel: 'critical', proposalRequired: true },
  { id: 'deploy', label: 'Deploy', riskLevel: 'critical', proposalRequired: true },
  { id: 'delete_data', label: 'Delete Data', riskLevel: 'high', proposalRequired: true }
];

function registerCapability(deviceId, cap) {
  if (!deviceId || !cap || !cap.id) return { ok: false, error: 'Missing deviceId or capability id' };
  const existing = store.getCapability(deviceId) || { deviceId, caps: [] };
  const dup = existing.caps.find(c => c.id === cap.id);
  if (dup) return { ok: false, error: 'Capability already registered' };
  existing.caps.push({ id: cap.id, label: cap.label || cap.id, riskLevel: cap.riskLevel || 'low', proposalRequired: cap.proposalRequired || false, registeredAt: new Date().toISOString() });
  store.setCapability(deviceId, existing);
  return { ok: true, capability: cap };
}

function removeCapability(deviceId, capId) {
  const existing = store.getCapability(deviceId);
  if (!existing) return { ok: false, error: 'No capabilities for device' };
  existing.caps = existing.caps.filter(c => c.id !== capId);
  store.setCapability(deviceId, existing);
  return { ok: true };
}

function listCapabilities(deviceId) {
  const entry = store.getCapability(deviceId);
  return entry ? entry.caps : [];
}

function getDeviceCapabilities(deviceId) {
  return listCapabilities(deviceId);
}

function validateCapability(cap) {
  if (!cap || !cap.id) return { valid: false, errors: ['Missing capability id'] };
  return { valid: true, errors: [] };
}

function getCapabilityRiskLevel(capId) {
  const cap = BUILTIN_CAPABILITIES.find(c => c.id === capId);
  return cap ? cap.riskLevel : 'unknown';
}

function requiresProposal(capId) {
  const cap = BUILTIN_CAPABILITIES.find(c => c.id === capId);
  return cap ? cap.proposalRequired : true;
}

function listBuiltinCapabilities() {
  return [...BUILTIN_CAPABILITIES];
}

module.exports = {
  registerCapability, removeCapability, listCapabilities, getDeviceCapabilities,
  validateCapability, getCapabilityRiskLevel, requiresProposal, listBuiltinCapabilities,
  BUILTIN_CAPABILITIES
};

'use strict';

const { createUnifiedItem } = require('./unified-registry-contract');

const BUILTIN_CAPABILITIES = [
  { id: 'cap-dashboard-read', module: 'dashboard', action: 'read_dashboard', actionType: 'read', riskLevel: 'low', externalSystem: null, requiresApproval: false, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: true, enabled: true },
  { id: 'cap-dashboard-write', module: 'dashboard', action: 'write_dashboard', actionType: 'write', riskLevel: 'medium', externalSystem: null, requiresApproval: true, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: false, enabled: true },
  { id: 'cap-executor-read', module: 'executor', action: 'read_executor', actionType: 'read', riskLevel: 'low', externalSystem: null, requiresApproval: false, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: true, enabled: true },
  { id: 'cap-executor-run', module: 'executor', action: 'run_executor', actionType: 'danger', riskLevel: 'high', externalSystem: null, requiresApproval: true, requiresEvaluation: true, requiresSecretScan: false, requiresCostGuard: true, directRunAllowed: false, enabled: true },
  { id: 'cap-integration-read', module: 'integrations', action: 'read_integrations', actionType: 'read', riskLevel: 'low', externalSystem: null, requiresApproval: false, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: true, enabled: true },
  { id: 'cap-integration-write', module: 'integrations', action: 'write_integration', actionType: 'external', riskLevel: 'high', externalSystem: 'github', requiresApproval: true, requiresEvaluation: true, requiresSecretScan: true, requiresCostGuard: false, directRunAllowed: false, enabled: true },
  { id: 'cap-deploy', module: 'deploy', action: 'run_deploy', actionType: 'danger', riskLevel: 'critical', externalSystem: 'production', requiresApproval: true, requiresEvaluation: true, requiresSecretScan: true, requiresCostGuard: true, directRunAllowed: false, enabled: true },
  { id: 'cap-github-read', module: 'githubops', action: 'read_github', actionType: 'read', riskLevel: 'low', externalSystem: 'github', requiresApproval: false, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: true, enabled: true },
  { id: 'cap-github-write', module: 'githubops', action: 'write_github', actionType: 'external', riskLevel: 'high', externalSystem: 'github', requiresApproval: true, requiresEvaluation: true, requiresSecretScan: true, requiresCostGuard: false, directRunAllowed: false, enabled: true },
  { id: 'cap-admin-operate', module: 'operator', action: 'operate', actionType: 'admin', riskLevel: 'critical', externalSystem: null, requiresApproval: true, requiresEvaluation: true, requiresSecretScan: true, requiresCostGuard: true, directRunAllowed: false, enabled: true },
  { id: 'cap-telegram-send', module: 'telegram-control', action: 'send_message', actionType: 'write', riskLevel: 'medium', externalSystem: 'telegram', requiresApproval: false, requiresEvaluation: false, requiresSecretScan: false, requiresCostGuard: false, directRunAllowed: true, enabled: true },
  { id: 'cap-cicd-trigger', module: 'cicd', action: 'trigger_pipeline', actionType: 'danger', riskLevel: 'high', externalSystem: 'cicd', requiresApproval: true, requiresEvaluation: true, requiresSecretScan: true, requiresCostGuard: true, directRunAllowed: false, enabled: true }
];

function buildCapabilityRegistryV2(services) {
  return BUILTIN_CAPABILITIES.map(cap => createUnifiedItem({
    ...cap,
    type: 'capability',
    ownerModule: cap.module
  }));
}

function normalizeCapabilitiesFromLegacy(services) {
  if (services && services.legacyCapabilityRegistry) {
    const legacy = services.legacyCapabilityRegistry;
    return BUILTIN_CAPABILITIES.map(cap => {
      const legacyCap = legacy.find(l => l.id === cap.id);
      return legacyCap ? { ...cap, ...legacyCap } : cap;
    });
  }
  return [...BUILTIN_CAPABILITIES];
}

function validateCapabilityRegistryV2(registry, services) {
  const errors = [];
  if (!Array.isArray(registry)) return ['registry must be an array'];
  const ids = new Set();
  for (const cap of registry) {
    if (!cap.id) errors.push('capability missing id');
    if (!cap.module) errors.push(`capability ${cap.id || 'unknown'} missing module`);
    if (!cap.action) errors.push(`capability ${cap.id} missing action`);
    if (!['read', 'write', 'external', 'danger', 'admin'].includes(cap.actionType)) {
      errors.push(`capability ${cap.id} invalid actionType: ${cap.actionType}`);
    }
    if (ids.has(cap.id)) errors.push(`duplicate capability id: ${cap.id}`);
    ids.add(cap.id);
  }
  return errors;
}

function detectUnsafeCapability(registry, services) {
  const unsafe = [];
  for (const cap of registry) {
    const isDangerous = cap.actionType === 'external' || cap.actionType === 'danger' || cap.actionType === 'admin';
    if (isDangerous && cap.directRunAllowed === true) {
      unsafe.push({
        id: cap.id,
        action: cap.action,
        actionType: cap.actionType,
        riskLevel: cap.riskLevel,
        reason: `directRunAllowed=true for ${cap.actionType} action`
      });
    }
  }
  return unsafe;
}

function generateCapabilityDocsFromRegistry(registry, services) {
  return registry
    .filter(cap => cap.enabled)
    .map(cap => ({
      id: cap.id,
      module: cap.module,
      action: cap.action,
      actionType: cap.actionType,
      riskLevel: cap.riskLevel,
      requiresApproval: cap.requiresApproval,
      requiresEvaluation: cap.requiresEvaluation,
      externalSystem: cap.externalSystem
    }));
}

module.exports = {
  BUILTIN_CAPABILITIES,
  buildCapabilityRegistryV2,
  normalizeCapabilitiesFromLegacy,
  validateCapabilityRegistryV2,
  detectUnsafeCapability,
  generateCapabilityDocsFromRegistry
};

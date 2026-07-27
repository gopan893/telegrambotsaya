/**
 * Capability Contract v3
 * Builds and validates capability contracts from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildCapabilityContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'capability') {
    return { success: false, error: `Item type must be capability, got ${item.type}` };
  }

  const contract = {
    id: item.id,
    module: item.module || null,
    action: item.action || item.id,
    actionType: item.actionType || 'read',
    riskLevel: item.riskLevel || 'low',
    externalSystem: item.externalSystem || null,
    dataSensitivity: item.dataSensitivity || 'low',
    requiresApproval: item.requiresApproval !== undefined
      ? Boolean(item.requiresApproval)
      : v3utils.requiresApprovalByDefault(item),
    requiresEvaluation: Boolean(item.requiresEvaluation),
    requiresSecretScan: item.requiresSecretScan !== undefined
      ? Boolean(item.requiresSecretScan)
      : item.riskLevel === 'high' || item.riskLevel === 'critical',
    requiresCostGuard: Boolean(item.requiresCostGuard),
    requiresPrivacyGuard: Boolean(item.requiresPrivacyGuard),
    directRunAllowed: item.directRunAllowed !== undefined
      ? Boolean(item.directRunAllowed)
      : !v3utils.isDangerousActionType(item.actionType),
    ownerOnly: Boolean(item.ownerOnly),
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateCapabilityContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!contract.id) {
    errors.push('Missing capability id');
  }

  if (!contract.module) {
    warnings.push('Missing module');
  }

  if (!contract.action) {
    errors.push('Missing action');
  }

  if (!v3utils.isValidActionType(contract.actionType)) {
    errors.push(`Invalid actionType: ${contract.actionType}`);
  }

  if (!v3utils.isValidRiskLevel(contract.riskLevel)) {
    errors.push(`Invalid riskLevel: ${contract.riskLevel}`);
  }

  if (v3utils.isDangerousActionType(contract.actionType) && contract.directRunAllowed) {
    errors.push('Dangerous capabilities must have directRunAllowed=false');
  }

  if (contract.actionType === 'external_write' && !contract.requiresApproval) {
    errors.push('external_write capabilities require approval');
  }

  if (contract.riskLevel === 'critical' && !contract.requiresApproval) {
    errors.push('Critical capabilities must require approval');
  }

  if (contract.riskLevel === 'critical' && !contract.requiresEvaluation) {
    errors.push('Critical capabilities must require evaluation');
  }

  if (!contract.requiresSecretScan && contract.riskLevel === 'critical') {
    warnings.push('Critical capabilities should enable secret scanning');
  }

  if (contract.actionType === 'external_write' && contract.externalSystem && !contract.requiresEvaluation) {
    warnings.push('External write capabilities should require evaluation');
  }

  const blockedActions = ['deploy', 'rollback', 'push', 'release', 'restore', 'hard_delete', 'shell_executor'];
  const actionLower = (contract.action || '').toLowerCase();
  for (const blocked of blockedActions) {
    if (actionLower.includes(blocked)) {
      if (contract.directRunAllowed) {
        errors.push(`${blocked} capability must not have directRunAllowed=true`);
      }
      if (!contract.requiresApproval) {
        errors.push(`${blocked} capability must require approval`);
      }
      if (!contract.requiresEvaluation) {
        errors.push(`${blocked} capability must require evaluation`);
      }
    }
  }

  if (actionLower.includes('shell')) {
    errors.push('Shell executor capability is blocked');
  }

  if (actionLower.includes('credential') || actionLower.includes('token') || actionLower.includes('secret')) {
    errors.push('Credential/secret access capability is blocked');
  }

  if (contract.externalSystem && !contract.requiresApproval) {
    warnings.push('Capabilities with external system should require approval');
  }

  if (contract.dataSensitivity === 'high' && !contract.requiresPrivacyGuard) {
    warnings.push('High sensitivity data should require privacy guard');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeCapabilityContractFromV2(capability, services) {
  if (!capability) return null;

  return {
    id: capability.id || v3utils.normalizeId(capability.action || capability.name),
    module: capability.module || null,
    action: capability.action || capability.name || capability.id,
    actionType: capability.actionType || 'read',
    riskLevel: capability.riskLevel || 'low',
    externalSystem: capability.externalSystem || null,
    dataSensitivity: capability.dataSensitivity || 'low',
    requiresApproval: capability.requiresApproval !== undefined
      ? Boolean(capability.requiresApproval)
      : v3utils.requiresApprovalByDefault(capability),
    requiresEvaluation: Boolean(capability.requiresEvaluation),
    requiresSecretScan: capability.requiresSecretScan !== undefined
      ? Boolean(capability.requiresSecretScan)
      : capability.riskLevel === 'high' || capability.riskLevel === 'critical',
    requiresCostGuard: Boolean(capability.requiresCostGuard),
    requiresPrivacyGuard: Boolean(capability.requiresPrivacyGuard),
    directRunAllowed: capability.directRunAllowed !== undefined
      ? Boolean(capability.directRunAllowed)
      : !v3utils.isDangerousActionType(capability.actionType),
    ownerOnly: Boolean(capability.ownerOnly),
    enabled: capability.enabled !== false
  };
}

function detectUnsafeCapabilityContractV3(services) {
  const frozen = store.getFrozen();
  if (!frozen || !frozen.items) {
    return { hasUnsafe: false, findings: [] };
  }

  const findings = [];
  const capItems = frozen.items.filter(i => i.type === 'capability');

  for (const item of capItems) {
    const contract = buildCapabilityContractV3(item, services);
    if (!contract.success) {
      findings.push({ id: item.id, finding: 'Failed to build contract', severity: 'P0' });
      continue;
    }

    const c = contract.contract;

    if (v3utils.isDangerousActionType(c.actionType) && c.directRunAllowed) {
      findings.push({
        id: c.id,
        action: c.action,
        finding: 'Dangerous action with directRunAllowed=true',
        severity: 'P0'
      });
    }

    if (c.actionType === 'external_write' && !c.requiresApproval) {
      findings.push({
        id: c.id,
        action: c.action,
        finding: 'External write without approval requirement',
        severity: 'P0'
      });
    }

    const actionLower = c.action.toLowerCase();
    if (actionLower.includes('shell')) {
      findings.push({
        id: c.id,
        action: c.action,
        finding: 'Shell executor capability detected',
        severity: 'P0'
      });
    }

    if (actionLower.includes('auto') && (actionLower.includes('approv') || actionLower.includes('run'))) {
      findings.push({
        id: c.id,
        action: c.action,
        finding: 'Auto-approve or auto-run capability detected',
        severity: 'P0'
      });
    }

    if (!c.module && c.status === 'active') {
      findings.push({
        id: c.id,
        action: c.action,
        finding: 'Active capability without module assignment',
        severity: 'P2'
      });
    }
  }

  return {
    hasUnsafe: findings.length > 0,
    findings,
    scannedAt: new Date().toISOString()
  };
}

function buildCapabilityContractReport(services) {
  const frozen = store.getFrozen();
  const items = (frozen && frozen.items || []).filter(i => i.type === 'capability');
  const results = [];
  let validCount = 0;
  let errorCount = 0;

  for (const item of items) {
    const contract = buildCapabilityContractV3(item, services);
    if (!contract.success) {
      errorCount++;
      results.push({ id: item.id, valid: false, error: contract.error });
      continue;
    }
    const validation = validateCapabilityContractV3(contract.contract, services);
    results.push({
      id: item.id,
      action: contract.contract.action,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings
    });
    if (validation.valid) validCount++;
    else errorCount++;
  }

  const unsafe = detectUnsafeCapabilityContractV3(services);

  return {
    total: items.length,
    valid: validCount,
    errors: errorCount,
    results,
    unsafeDetections: unsafe,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildCapabilityContractV3,
  validateCapabilityContractV3,
  normalizeCapabilityContractFromV2,
  detectUnsafeCapabilityContractV3,
  buildCapabilityContractReport
};
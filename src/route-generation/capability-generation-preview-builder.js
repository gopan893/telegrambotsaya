/**
 * Capability Generation Preview Builder
 * Generates preview of capabilities from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const capabilityContract = require('./capability-contract-v3');
const v3utils = require('../registry-v3/registry-v3-utils');

function buildCapabilityGenerationPreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const capItems = frozen.items.filter(i => i.type === 'capability');

  const preview = {
    generatedAt: new Date().toISOString(),
    source: 'registry-v3-frozen',
    totalCapabilities: capItems.length,
    capabilities: [],
    unsafeCapabilities: [],
    byRiskLevel: { low: 0, medium: 0, high: 0, critical: 0 },
    byActionType: { read: 0, report: 0, simulate: 0, dry_run: 0, proposal: 0, internal_write: 0, external_write: 0, dangerous: 0 },
    warnings: []
  };

  for (const item of capItems) {
    const result = capabilityContract.buildCapabilityContractV3(item, services);
    if (!result.success) {
      preview.warnings.push({ id: item.id, error: result.error });
      continue;
    }

    const c = result.contract;

    const capPreview = {
      id: c.id,
      action: c.action,
      module: c.module,
      actionType: c.actionType,
      riskLevel: c.riskLevel,
      externalSystem: c.externalSystem,
      dataSensitivity: c.dataSensitivity,
      requiresApproval: c.requiresApproval,
      requiresEvaluation: c.requiresEvaluation,
      requiresSecretScan: c.requiresSecretScan,
      requiresCostGuard: c.requiresCostGuard,
      requiresPrivacyGuard: c.requiresPrivacyGuard,
      directRunAllowed: c.directRunAllowed,
      ownerOnly: c.ownerOnly,
      enabled: c.enabled
    };

    preview.capabilities.push(capPreview);

    preview.byRiskLevel[c.riskLevel] = (preview.byRiskLevel[c.riskLevel] || 0) + 1;
    preview.byActionType[c.actionType] = (preview.byActionType[c.actionType] || 0) + 1;

    if (v3utils.isDangerousActionType(c.actionType) && c.directRunAllowed) {
      preview.unsafeCapabilities.push({
        id: c.id,
        action: c.action,
        issue: 'Dangerous action with directRunAllowed=true',
        severity: 'P0'
      });
    }

    const actionLower = c.action.toLowerCase();
    if (actionLower.includes('shell') || actionLower.includes('exec')) {
      preview.unsafeCapabilities.push({
        id: c.id,
        action: c.action,
        issue: 'Shell executor capability',
        severity: 'P0'
      });
    }

    if (actionLower.includes('deploy') || actionLower.includes('rollback') || actionLower.includes('release')) {
      if (c.directRunAllowed || !c.requiresApproval) {
        preview.unsafeCapabilities.push({
          id: c.id,
          action: c.action,
          issue: 'Deploy/rollback/release capability with insufficient guards',
          severity: 'P0'
        });
      }
    }
  }

  preview.isSafe = preview.unsafeCapabilities.length === 0;

  return {
    success: true,
    preview: v3utils.sanitizeForDisplay(preview)
  };
}

function validateCapabilityGenerationPreview(preview, services) {
  const errors = [];
  const warnings = [];

  if (!preview) {
    errors.push('Preview is null');
    return { valid: false, errors, warnings };
  }

  if (!Array.isArray(preview.capabilities)) {
    errors.push('Missing capabilities array');
    return { valid: false, errors, warnings };
  }

  for (const cap of preview.capabilities) {
    if (!cap.id) {
      errors.push('Capability missing id');
    }
    if (cap.riskLevel === 'critical' && cap.directRunAllowed) {
      errors.push(`Critical capability ${cap.id} has directRunAllowed=true`);
    }
    if (cap.actionType === 'dangerous' && !cap.requiresApproval) {
      errors.push(`Dangerous capability ${cap.id} missing approval requirement`);
    }
  }

  const unsafe = preview.unsafeCapabilities || [];
  for (const u of unsafe) {
    if (u.severity === 'P0') {
      errors.push(`P0 unsafe: ${u.id} - ${u.issue}`);
    } else {
      warnings.push(`Unsafe: ${u.id} - ${u.issue}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function buildCapabilityGenerationPreviewReport(services) {
  const result = buildCapabilityGenerationPreview(services);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      generatedAt: new Date().toISOString()
    };
  }

  const validation = validateCapabilityGenerationPreview(result.preview, services);

  return {
    success: true,
    preview: result.preview,
    validation,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  buildCapabilityGenerationPreview,
  validateCapabilityGenerationPreview,
  buildCapabilityGenerationPreviewReport
};
'use strict';

const capabilityRegistry = require('./capability-registry');

const RISK_MATRIX = {
  'read_only': { eval: false, approval: false, cost: false, secret: false },
  'low': { eval: false, approval: false, cost: false, secret: false },
  'medium': { eval: true, approval: false, cost: false, secret: false },
  'high': { eval: true, approval: true, cost: true, secret: true },
  'danger': { eval: true, approval: true, cost: true, secret: true },
  'blocked': { eval: true, approval: true, cost: true, secret: true }
};

function getContractForCapability(capabilityId) {
  const cap = capabilityRegistry.getCapability(capabilityId);
  if (!cap) return null;

  const riskDefaults = RISK_MATRIX[cap.riskLevel] || RISK_MATRIX.low;

  return {
    capabilityId: cap.id,
    module: cap.module,
    name: cap.name,
    actionType: cap.actionType,
    riskLevel: cap.riskLevel,
    externalSystem: cap.externalSystem,
    enabled: cap.enabled,
    requires: {
      owner: cap.requiresOwner,
      admin: cap.requiresAdmin,
      evaluation: cap.requiresEvaluation || riskDefaults.eval,
      executorApproval: cap.requiresExecutorApproval || riskDefaults.approval,
      secretScan: cap.requiresSecretScan || riskDefaults.secret,
      costGuard: cap.requiresCostGuard || riskDefaults.cost
    },
    restrictions: buildRestrictions(cap),
    contractValid: true
  };
}

function buildRestrictions(cap) {
  const restrictions = [];

  if (cap.actionType === 'external_write' || cap.actionType === 'dangerous' || cap.actionType === 'destructive') {
    restrictions.push('proposal_only');
    restrictions.push('evaluation_required');
    restrictions.push('approval_required');
  }

  if (cap.externalSystem === 'github') {
    restrictions.push('no_direct_push');
    restrictions.push('proposal_only');
  }

  if (cap.externalSystem === 'render') {
    restrictions.push('no_direct_deploy');
    restrictions.push('no_direct_rollback');
    restrictions.push('proposal_only');
    restrictions.push('owner_required');
  }

  if (cap.externalSystem === 'gmail') {
    restrictions.push('no_direct_send');
    restrictions.push('proposal_only');
  }

  if (cap.module === 'webhook') {
    restrictions.push('preview_before_post');
    restrictions.push('proposal_only');
  }

  if (cap.module === 'backup' && (cap.actionType === 'dangerous' || cap.riskLevel === 'danger')) {
    restrictions.push('owner_required');
    restrictions.push('proposal_only');
  }

  if (cap.module === 'memory' && cap.name === 'delete') {
    restrictions.push('disabled_by_default');
  }

  if (cap.module === 'improvement' && cap.name === 'code.patch') {
    restrictions.push('disabled_by_default');
    restrictions.push('blocked_from_runtime');
  }

  if (cap.module === 'operating_loop' && cap.name === 'external.run') {
    restrictions.push('disabled_by_default');
    restrictions.push('blocked_auto_run');
  }

  return restrictions;
}

function getContractSummary(capabilityId) {
  const contract = getContractForCapability(capabilityId);
  if (!contract) return null;

  const requiresEval = contract.requires.evaluation ? '✅' : '❌';
  const requiresApproval = contract.requires.executorApproval ? '✅' : '❌';
  const requiresSecret = contract.requires.secretScan ? '✅' : '❌';
  const requiresCost = contract.requires.costGuard ? '✅' : '❌';
  const status = contract.enabled ? '✅ Enabled' : '❌ Disabled';

  return [
    `*Capability Contract: ${contract.capabilityId}*`,
    `Module: ${contract.module}`,
    `Action Type: ${contract.actionType}`,
    `Risk Level: ${contract.riskLevel}`,
    `External System: ${contract.externalSystem || 'none'}`,
    `Status: ${status}`,
    '',
    '*Requirements:*',
    `Evaluation v2: ${requiresEval}`,
    `Executor Approval: ${requiresApproval}`,
    `Secret Scan: ${requiresSecret}`,
    `Cost Guard: ${requiresCost}`,
    `Owner: ${contract.requires.owner ? '✅' : '❌'}`,
    `Admin: ${contract.requires.admin ? '✅' : '❌'}`,
    '',
    '*Restrictions:*',
    ...(contract.restrictions.length ? contract.restrictions.map(r => `- ${r}`) : ['None'])
  ].join('\n');
}

function getAllContracts() {
  const all = capabilityRegistry.listCapabilities();
  return all.map(c => getContractForCapability(c.id)).filter(Boolean);
}

function validateContractCompliance(capabilityId) {
  const cap = capabilityRegistry.getCapability(capabilityId);
  if (!cap) return { valid: false, errors: ['Capability not found'] };

  const errors = [];
  const contract = getContractForCapability(capabilityId);

  if (!contract) return { valid: false, errors: ['Contract not found'] };

  if (cap.actionType === 'external_write' && !contract.requires.evaluation) {
    errors.push('External write must require evaluation');
  }

  if (cap.actionType === 'dangerous' && !contract.requires.executorApproval) {
    errors.push('Dangerous action must require executor approval');
  }

  if (cap.requiresSecretScan && cap.riskLevel === 'read_only') {
    errors.push('Read-only capability should not require secret scan');
  }

  if (cap.externalSystem === 'github' && cap.actionType !== 'read' && !contract.restrictions.includes('proposal_only')) {
    errors.push('GitHub write actions must be proposal only');
  }

  return { valid: errors.length === 0, errors, contract };
}

module.exports = {
  getContractForCapability,
  getContractSummary,
  getAllContracts,
  validateContractCompliance,
  RISK_MATRIX
};

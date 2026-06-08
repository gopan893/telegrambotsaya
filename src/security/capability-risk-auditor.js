'use strict';

const DANGEROUS_ACTIONS = [
  'github_push', 'workflow_dispatch', 'render_deploy', 'rollback',
  'backup_restore', 'webhook_post', 'gmail_send', 'calendar_write',
  'admin_change', 'permission_change', 'memory_hard_delete',
  'operating_loop_external_action', 'improvement_code_patch_from_runtime'
];

const EXTERNAL_WRITE_ACTIONS = [
  'github_push', 'workflow_dispatch', 'render_deploy', 'webhook_post',
  'gmail_send', 'calendar_write', 'github_pr_merge', 'github_pr_create'
];

function auditDangerousCapabilities(services) {
  const governance = services.governance;
  if (!governance || !governance.capabilityRegistry) {
    return [{ capability: 'all', issue: 'Governance capability registry not available.', severity: 'high', recommendation: 'Ensure governance module is loaded.' }];
  }

  const findings = [];
  const registry = governance.capabilityRegistry;

  for (const action of DANGEROUS_ACTIONS) {
    const cap = typeof registry.findCapabilityByAction === 'function' ? registry.findCapabilityByAction(action) : null;
    if (cap) {
      if (cap.enabled !== false) {
        if (cap.actionType === 'dangerous' || cap.actionType === 'destructive') {
          findings.push({ capability: action, issue: `Dangerous capability "${action}" is enabled. Must be proposal-only.`, severity: 'high', recommendation: 'Ensure this capability requires Evaluation v2 + executor proposal + approval.' });
        } else {
          findings.push({ capability: action, issue: `Capability "${action}" is enabled but may not be properly classified as dangerous.`, severity: 'medium', recommendation: 'Verify actionType is correctly set to dangerous.' });
        }
      } else {
        findings.push({ capability: action, issue: `Capability "${action}" is disabled.`, severity: 'info', recommendation: 'Verify this capability should remain disabled.' });
      }
    } else {
      findings.push({ capability: action, issue: `Dangerous capability "${action}" is not registered in governance.`, severity: 'medium', recommendation: 'Register this capability with proper risk level.' });
    }
  }

  return findings;
}

function auditExternalWriteCapabilities(services) {
  const governance = services.governance;
  if (!governance || !governance.capabilityRegistry) {
    return [{ capability: 'all', issue: 'Governance not available for external write audit.', severity: 'high', recommendation: 'Load governance module.' }];
  }

  const findings = [];
  const registry = governance.capabilityRegistry;

  for (const action of EXTERNAL_WRITE_ACTIONS) {
    const cap = typeof registry.findCapabilityByAction === 'function' ? registry.findCapabilityByAction(action) : null;
    if (cap && cap.enabled !== false) {
      if (cap.actionType === 'external_write' || cap.actionType === 'dangerous' || cap.actionType === 'destructive') {
        findings.push({ capability: action, issue: `External write capability "${action}" is enabled. Must be proposal-only.`, severity: 'high', recommendation: 'Ensure Evaluation v2 + executor proposal + approval is required.' });
      }
    }
  }

  return findings;
}

function auditDisabledCapabilities(services) {
  const governance = services.governance;
  if (!governance || !governance.capabilityRegistry) return [];

  const registry = governance.capabilityRegistry;
  const allCaps = typeof registry.listCapabilities === 'function' ? registry.listCapabilities() : [];
  return allCaps
    .filter(c => c.enabled === false)
    .map(c => ({ capability: c.id || c.name, issue: `Capability "${c.id || c.name}" is disabled.`, severity: 'info', recommendation: 'Verify this capability should remain disabled.' }));
}

function auditCapabilityContracts(services) {
  const governance = services.governance;
  if (!governance || !governance.capabilityContracts) return [];

  return [{ capability: 'contracts', issue: 'Capability contracts module found.', severity: 'info', recommendation: 'Verify contracts are enforced.' }];
}

function detectCapabilityPolicyMismatch(services) {
  const governance = services.governance;
  if (!governance || !governance.capabilityRegistry) return [];

  const findings = [];
  const registry = governance.capabilityRegistry;
  const allCaps = typeof registry.listCapabilities === 'function' ? registry.listCapabilities() : [];

  for (const cap of allCaps) {
    if (cap.requiresEvaluation && cap.actionType === 'read') {
      findings.push({ capability: cap.id || cap.name, issue: `Capability has requiresEvaluation=true but actionType=read.`, severity: 'medium', recommendation: 'Verify evaluation requirement is correct.' });
    }
    if (cap.requiresOwner && cap.riskLevel === 'low') {
      findings.push({ capability: cap.id || cap.name, issue: `Capability has requiresOwner=true but riskLevel=low.`, severity: 'low', recommendation: 'Verify owner requirement is correct.' });
    }
  }

  return findings;
}

function buildCapabilityRiskReport(results) {
  const findings = results.flat();
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) { if (bySeverity[f.severity]) bySeverity[f.severity]++; }
  return {
    totalFindings: findings.length,
    totalCritical: bySeverity.critical,
    bySeverity,
    findings: findings.map(f => ({ capability: f.capability, issue: f.issue, severity: f.severity, recommendation: f.recommendation }))
  };
}

module.exports = {
  DANGEROUS_ACTIONS,
  EXTERNAL_WRITE_ACTIONS,
  auditDangerousCapabilities,
  auditExternalWriteCapabilities,
  auditDisabledCapabilities,
  auditCapabilityContracts,
  detectCapabilityPolicyMismatch,
  buildCapabilityRiskReport
};

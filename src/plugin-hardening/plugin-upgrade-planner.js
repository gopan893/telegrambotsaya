'use strict';

const RISK_TYPES = ['breaking_change', 'permission_escalation', 'new_dependency', 'removed_feature', 'api_change', 'security_fix', 'bug_fix', 'performance', 'documentation'];

function createUpgradePlan(pluginId, currentVersion, targetVersion) {
  return {
    pluginId,
    currentVersion,
    targetVersion,
    risks: [],
    steps: [],
    requiresApproval: false,
    status: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function analyzeUpgradeRisks(currentManifest, targetManifest) {
  const risks = [];
  if (!currentManifest || !targetManifest) return risks;

  const currentVersion = currentManifest.version || '0.0.0';
  const targetVersion = targetManifest.version || '0.0.0';
  const currentParts = currentVersion.split('.').map(Number);
  const targetParts = targetVersion.split('.').map(Number);

  if (targetParts[0] > currentParts[0]) {
    risks.push({ type: 'breaking_change', severity: 'high', description: 'Major version bump: ' + currentVersion + ' -> ' + targetVersion });
  } else if (targetParts[1] > currentParts[1]) {
    risks.push({ type: 'api_change', severity: 'medium', description: 'Minor version bump with potential new features' });
  }

  const oldPerms = new Set(currentManifest.permissions || []);
  const newPerms = new Set(targetManifest.permissions || []);
  const addedPerms = [...newPerms].filter(p => !oldPerms.has(p));
  const removedPerms = [...oldPerms].filter(p => !newPerms.has(p));

  if (addedPerms.length > 0) {
    risks.push({ type: 'permission_escalation', severity: 'high', description: 'New permissions added: ' + addedPerms.join(', ') });
  }
  if (removedPerms.length > 0) {
    risks.push({ type: 'removed_feature', severity: 'medium', description: 'Permissions removed: ' + removedPerms.join(', ') });
  }

  const oldDeps = Object.keys(currentManifest.dependencies || {});
  const newDeps = Object.keys(targetManifest.dependencies || {});
  const addedDeps = newDeps.filter(d => !oldDeps.includes(d));
  const removedDeps = oldDeps.filter(d => !newDeps.includes(d));

  if (addedDeps.length > 0) {
    risks.push({ type: 'new_dependency', severity: 'medium', description: 'New dependencies: ' + addedDeps.join(', ') });
  }
  if (removedDeps.length > 0) {
    risks.push({ type: 'removed_feature', severity: 'low', description: 'Dependencies removed: ' + removedDeps.join(', ') });
  }

  const oldConnectors = JSON.stringify(currentManifest.connectors || []);
  const newConnectors = JSON.stringify(targetManifest.connectors || []);
  if (oldConnectors !== newConnectors) {
    risks.push({ type: 'api_change', severity: 'medium', description: 'Connector requirements changed' });
  }

  return risks;
}

function planUpgradeSteps(plan, risks) {
  if (!plan) return plan;
  plan.risks = risks || [];
  plan.steps = [];

  plan.steps.push({ step: 1, action: 'backup_current', description: 'Create backup of current plugin state', required: true });

  if (risks.some(r => r.type === 'breaking_change')) {
    plan.steps.push({ step: 2, action: 'review_breaking_changes', description: 'Review breaking changes documentation', required: true });
  }

  if (risks.some(r => r.type === 'permission_escalation')) {
    plan.steps.push({ step: 2, action: 'review_permissions', description: 'Review new permissions for security implications', required: true });
    plan.requiresApproval = true;
  }

  plan.steps.push({ step: 3, action: 'run_compatibility_check', description: 'Run full compatibility check', required: true });

  if (risks.some(r => r.type === 'new_dependency')) {
    plan.steps.push({ step: 4, action: 'audit_dependencies', description: 'Audit new dependencies for security', required: true });
  }

  plan.steps.push({ step: 5, action: 'install_update', description: 'Install plugin update', required: true });
  plan.steps.push({ step: 6, action: 'run_health_check', description: 'Run health check after upgrade', required: true });
  plan.steps.push({ step: 7, action: 'verify_functionality', description: 'Verify plugin functionality', required: true });

  if (plan.requiresApproval) {
    plan.steps.push({ step: 0, action: 'await_approval', description: 'Await approval for permission-escalating upgrade', required: true });
  }

  plan.steps.sort((a, b) => a.step - b.step);
  plan.updatedAt = new Date().toISOString();
  return plan;
}

function getUpgradeRiskSummary(plan) {
  if (!plan || !plan.risks) return { total: 0, byType: {}, bySeverity: {} };
  const byType = {};
  const bySeverity = {};
  for (const risk of plan.risks) {
    byType[risk.type] = (byType[risk.type] || 0) + 1;
    bySeverity[risk.severity] = (bySeverity[risk.severity] || 0) + 1;
  }
  return { total: plan.risks.length, byType, bySeverity, requiresApproval: plan.requiresApproval };
}

function canAutoUpgrade(plan) {
  if (!plan || !plan.risks) return true;
  if (plan.requiresApproval) return false;
  const hasHighRisk = plan.risks.some(r => r.severity === 'high');
  return !hasHighRisk;
}

function markStepComplete(plan, stepIndex, result) {
  if (!plan || !plan.steps || !plan.steps[stepIndex]) return false;
  plan.steps[stepIndex].completed = true;
  plan.steps[stepIndex].completedAt = new Date().toISOString();
  plan.steps[stepIndex].result = result || 'completed';
  plan.updatedAt = new Date().toISOString();
  return true;
}

module.exports = {
  createUpgradePlan, analyzeUpgradeRisks, planUpgradeSteps,
  getUpgradeRiskSummary, canAutoUpgrade, markStepComplete,
  RISK_TYPES
};

'use strict';

const store = require('./project-operator-store');

function reviewOperatorPlanRisk(planId) {
  const plan = store.getPlan(planId);
  if (!plan) return { ok: false, error: 'Plan not found' };
  const goal = store.getGoal(plan.goalId);
  const risks = [];

  const compatRisk = detectCompatibilityRisk(plan);
  if (compatRisk) risks.push(compatRisk);

  const approvalRisk = detectApprovalBypassRisk(plan);
  if (approvalRisk) risks.push(approvalRisk);

  const costRisk = detectCostRisk(plan);
  if (costRisk) risks.push(costRisk);

  const deployRisk = detectDeploymentRisk(plan);
  if (deployRisk) risks.push(deployRisk);

  const overallLevel = risks.some(r => r.severity === 'high') ? 'high'
    : risks.some(r => r.severity === 'medium') ? 'medium'
    : 'low';

  return {
    planId,
    goalTitle: goal ? goal.title : 'unknown',
    risks,
    overallLevel,
    safe: overallLevel !== 'high',
    requiresApproval: overallLevel === 'high' || risks.some(r => r.approvalRequired)
  };
}

function detectCompatibilityRisk(plan) {
  if (!plan) return null;
  const phases = plan.phases || [];
  if (phases.some(p => p.name && p.name.toLowerCase().includes('deploy'))) {
    return { type: 'compatibility', description: 'Deploy phase may break existing features', severity: 'high', approvalRequired: true };
  }
  return null;
}

function detectApprovalBypassRisk(plan) {
  if (!plan) return null;
  const hasExternalAction = plan.summary && (
    plan.summary.toLowerCase().includes('push') ||
    plan.summary.toLowerCase().includes('deploy') ||
    plan.summary.toLowerCase().includes('write') ||
    plan.summary.toLowerCase().includes('delete')
  );
  if (hasExternalAction) {
    return { type: 'approval_bypass', description: 'Plan includes external/danger action requiring executor approval', severity: 'high', approvalRequired: true };
  }
  if (plan.evaluationRequired === false) {
    return { type: 'approval_bypass', description: 'Plan explicitly skips evaluation', severity: 'medium', approvalRequired: false };
  }
  return null;
}

function detectCostRisk(plan) {
  if (!plan) return null;
  if (plan.estimatedCost && plan.estimatedCost > 1) {
    return { type: 'cost', description: `Estimated cost $${plan.estimatedCost.toFixed(4)} exceeds threshold`, severity: 'medium', approvalRequired: false };
  }
  return null;
}

function detectDeploymentRisk(plan) {
  if (!plan) return null;
  const hasDeploy = (plan.phases || []).some(p => p.name && p.name.toLowerCase().includes('deploy'));
  const hasDashOrRollback = plan.summary && (
    plan.summary.toLowerCase().includes('rollback') ||
    plan.summary.toLowerCase().includes('render')
  );
  if (hasDeploy || hasDashOrRollback) {
    return { type: 'deployment', description: 'Deploy/rollback requires gate check and approval', severity: 'high', approvalRequired: true };
  }
  return null;
}

function buildOperatorRiskSummary(plan) {
  if (!plan) return 'Risk review unavailable.';
  const review = reviewOperatorPlanRisk(plan.id);
  if (!review || review.ok === false) return 'Risk review unavailable.';
  if (!review.risks || review.risks.length === 0) return `Plan ${plan.id}: No risks detected. Safe to proceed.`;
  const lines = [`Plan ${plan.id}: ${review.overallLevel.toUpperCase()} risk (${review.risks.length} risks)`];
  for (const r of review.risks) {
    lines.push(`- [${r.severity}] ${r.type}: ${r.description}${r.approvalRequired ? ' (approval required)' : ''}`);
  }
  return lines.join('\n');
}

module.exports = {
  reviewOperatorPlanRisk,
  detectCompatibilityRisk,
  detectApprovalBypassRisk,
  detectCostRisk,
  detectDeploymentRisk,
  buildOperatorRiskSummary
};

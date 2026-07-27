'use strict';

function estimateOperatorPlanCost(plan) {
  if (!plan) return { estimatedCost: null, known: false, reason: 'no_plan' };
  const phases = plan.phases || [];
  const baseCost = phases.length * 0.002;
  const milestoneCost = (plan.milestones || []).length * 0.001;
  const total = baseCost + milestoneCost;
  return { estimatedCost: total, known: true, baseCost, milestoneCost };
}

function runOperatorBudgetGuard(plan) {
  const costEst = estimateOperatorPlanCost(plan);
  const result = { allowed: true, warning: false, requiresApproval: false, blocked: false };
  if (!costEst.known) return { ...result, reason: 'cost_unknown', allowed: true };
  result.estimatedCost = costEst.estimatedCost;
  if (costEst.estimatedCost > 0.05) {
    result.warning = true;
    result.reason = `Estimated cost $${costEst.estimatedCost.toFixed(4)} exceeds soft limit.`;
  }
  if (costEst.estimatedCost > 0.5) {
    result.requiresApproval = true;
    result.reason = `High cost ($${costEst.estimatedCost.toFixed(4)}). Approval required.`;
  }
  if (costEst.estimatedCost > 5) {
    result.blocked = true;
    result.allowed = false;
    result.reason = `Cost $${costEst.estimatedCost.toFixed(4)} exceeds hard limit.`;
  }
  return result;
}

function suggestCheaperOperatorPlan(plan) {
  if (!plan) return { suggestion: null };
  const phases = plan.phases || [];
  const milestones = plan.milestones || [];
  const merged = phases.filter((p, i) => {
    if (i > 0 && p.order === phases[i - 1].order) return false;
    return true;
  });
  const reducedMilestones = milestones.slice(0, Math.max(1, milestones.length - 1));
  const savings = { originalPhases: phases.length, suggestedPhases: merged.length };
  return {
    suggestion: {
      phases: merged,
      milestones: reducedMilestones,
      note: 'Consider merging phases and reducing milestones to lower cost.'
    },
    estimatedSavings: (phases.length - merged.length) * 0.002
  };
}

function decideIfCouncilNeeded(plan) {
  if (!plan) return { needed: false, reason: 'No plan' };
  const risks = plan.risks || [];
  const highRisk = risks.some(r => r.severity === 'high');
  if (highRisk) return { needed: true, reason: 'High-risk plan requires council/debate.' };
  if ((plan.phases || []).length > 5) return { needed: true, reason: 'Complex plan with many phases.' };
  return { needed: false, reason: 'Simple plan. No council needed.' };
}

module.exports = {
  estimateOperatorPlanCost,
  runOperatorBudgetGuard,
  suggestCheaperOperatorPlan,
  decideIfCouncilNeeded
};

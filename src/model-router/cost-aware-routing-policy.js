'use strict';

function evaluateModelCostPolicy(task = {}, context = {}, services = {}) {
  const isEconomy = task.class === 'simple_chat' || task.class === 'routing_classification' || task.class === 'cost_sensitive';
  const isHeavy = task.class === 'coding_heavy' || task.class === 'research' || task.class === 'evaluation';
  return {
    economyPreferred: isEconomy || context.economyMode === true,
    qualityAllowed: isHeavy && context.economyMode !== true,
    estimatedCostTier: isHeavy ? 'high' : isEconomy ? 'low' : 'medium',
    costWarning: isHeavy && context.budgetRemaining < 0.1 ? 'Budget rendah untuk task berat.' : null
  };
}

function estimateModelRouteCost(route = {}, services = {}) {
  const tiers = { low: 1, medium: 3, high: 7 };
  const base = tiers[route.costTier] || 3;
  const lengthFactor = Math.min(1, (route.estimatedTokens || 500) / 4000);
  return Math.round(base * (0.7 + 0.3 * lengthFactor) * 100) / 100;
}

function preferEconomyModel(task = {}, context = {}, services = {}) {
  const policy = evaluateModelCostPolicy(task, context, services);
  return policy.economyPreferred || (!policy.qualityAllowed && !context.economyMode);
}

function requireApprovalForHighCostRoute(route = {}, services = {}) {
  const cost = estimateModelRouteCost(route, services);
  return { requiresApproval: cost >= 7, cost, reason: cost >= 7 ? 'High cost route requires approval.' : '' };
}

function buildCostRoutingExplanation(route = {}, services = {}) {
  const cost = estimateModelRouteCost(route, services);
  return `Route via ${route.provider || 'unknown'}: estimated cost ${cost}/10. Tier: ${route.costTier || 'unknown'}.${cost >= 7 ? ' Approval required.' : ''}`;
}

module.exports = { evaluateModelCostPolicy, estimateModelRouteCost, preferEconomyModel, requireApprovalForHighCostRoute, buildCostRoutingExplanation };

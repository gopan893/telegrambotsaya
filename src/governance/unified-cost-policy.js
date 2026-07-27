'use strict';

const COST_THRESHOLDS = {
  cheap: 0.01,
  moderate: 0.10,
  expensive: 1.00,
  critical: 10.00
};

function determineCostGuardRequirement(action, context) {
  const actionType = (action && action.actionType) || 'read';
  const riskLevel = (context && context.riskLevel) || 'low';

  if (actionType === 'read' || actionType === 'report') {
    return { costGuardRequired: false, reason: 'Read/report actions do not require cost guard' };
  }

  if (actionType === 'plan' || actionType === 'dry_run') {
    return { costGuardRequired: false, reason: 'Non-executing actions do not require cost guard' };
  }

  if (riskLevel === 'high' || riskLevel === 'danger') {
    return { costGuardRequired: true, reason: 'High/danger risk actions may have significant cost' };
  }

  if (actionType === 'external_write') {
    return { costGuardRequired: true, reason: 'External writes may incur costs' };
  }

  return { costGuardRequired: false, reason: 'Cost guard not required' };
}

function estimateGovernanceActionCost(action) {
  const actionType = (action && action.actionType) || 'read';
  const module = (action && action.module) || 'unknown';

  const costMap = {
    'read': 0.001,
    'report': 0.002,
    'plan': 0.005,
    'dry_run': 0.01,
    'proposal': 0.01,
    'internal_write': 0.02,
    'external_read': 0.01,
    'external_write': 0.05,
    'dangerous': 0.10,
    'destructive': 0.50
  };

  const moduleMultiplier = {
    'githubops': 1.0,
    'deploy': 1.5,
    'gmail': 0.5,
    'calendar': 0.5,
    'webhook': 0.3,
    'memory': 0.2,
    'knowledge': 0.3,
    'improvement': 0.5,
    'operating_loop': 0.3
  };

  const baseCost = costMap[actionType] || 0.01;
  const multiplier = moduleMultiplier[module] || 1.0;

  return {
    estimatedCost: Math.round(baseCost * multiplier * 1000) / 1000,
    currency: 'USD',
    baseCost,
    multiplier,
    actionType,
    module
  };
}

function runGovernanceCostGuard(action) {
  const estimate = estimateGovernanceActionCost(action);
  const cost = estimate.estimatedCost;

  let level = 'cheap';
  let requiresWarning = false;
  let requiresApproval = false;

  if (cost >= COST_THRESHOLDS.critical) {
    level = 'critical';
    requiresWarning = true;
    requiresApproval = true;
  } else if (cost >= COST_THRESHOLDS.expensive) {
    level = 'expensive';
    requiresWarning = true;
    requiresApproval = true;
  } else if (cost >= COST_THRESHOLDS.moderate) {
    level = 'moderate';
    requiresWarning = true;
  }

  return {
    level,
    estimatedCost: cost,
    requiresWarning,
    requiresApproval,
    passed: !requiresApproval,
    estimate
  };
}

function suggestCheaperGovernanceMode(action) {
  const actionType = (action && action.actionType) || 'read';

  if (actionType === 'external_write' || actionType === 'dangerous') {
    return {
      suggestion: 'Convert to proposal-only to defer execution and reduce risk',
      alternativeActionType: 'proposal',
      estimatedSaving: '90-100% of execution cost'
    };
  }

  if (actionType === 'proposal' || actionType === 'plan') {
    return {
      suggestion: 'Already in low-cost mode',
      alternativeActionType: actionType,
      estimatedSaving: 'None'
    };
  }

  return {
    suggestion: 'Use dry_run or plan mode first',
    alternativeActionType: 'dry_run',
    estimatedSaving: 'Minimal cost for evaluation'
  };
}

module.exports = {
  determineCostGuardRequirement,
  estimateGovernanceActionCost,
  runGovernanceCostGuard,
  suggestCheaperGovernanceMode,
  COST_THRESHOLDS
};

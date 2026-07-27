'use strict';

const BASE_LOOP_COST = 0.005;
const COST_PER_MODULE = 0.001;
const COST_PER_BLOCKER = 0.002;
const COST_PER_ACTION = 0.003;
const SOFT_LIMIT = 0.05;
const HARD_LIMIT = 0.5;

async function runOperatingLoopBudgetGuard(loopRun, services = {}) {
  const costEst = estimateOperatingLoopCost(loopRun, services);
  const result = {
    estimatedCost: costEst.estimatedCost || 0,
    budgetExceeded: false,
    warning: '',
    suggestedMode: '',
    stepsToSkip: []
  };

  if (costEst.estimatedCost > HARD_LIMIT) {
    result.budgetExceeded = true;
    result.warning = `Estimated cost ${costEst.estimatedCost.toFixed(4)} exceeds hard limit (${HARD_LIMIT}). Blocking run.`;
    result.suggestedMode = 'read_only';
    return result;
  }

  if (costEst.estimatedCost > SOFT_LIMIT) {
    result.warning = `Estimated cost ${costEst.estimatedCost.toFixed(4)} exceeds soft limit (${SOFT_LIMIT}). Consider cheaper mode.`;
    const cheaper = suggestCheaperLoopMode(loopRun, services);
    result.suggestedMode = cheaper.suggestedMode || '';
    result.stepsToSkip = cheaper.stepsToSkip || [];
  }

  return result;
}

function estimateOperatingLoopCost(loopRun, services = {}) {
  if (!loopRun) return { estimatedCost: 0, details: 'no_run' };

  const moduleCount = (loopRun.modules || []).length;
  const blockerCount = (loopRun.blockers || []).length;
  const actionCount = (loopRun.actions || []).length;
  const hasEvaluation = Boolean(loopRun.requiresEvaluation);

  let cost = BASE_LOOP_COST;
  cost += moduleCount * COST_PER_MODULE;
  cost += blockerCount * COST_PER_BLOCKER;
  cost += actionCount * COST_PER_ACTION;
  if (hasEvaluation) cost += 0.01;

  return {
    estimatedCost: Math.round(cost * 10000) / 10000,
    breakdown: {
      base: BASE_LOOP_COST,
      modules: moduleCount * COST_PER_MODULE,
      blockers: blockerCount * COST_PER_BLOCKER,
      actions: actionCount * COST_PER_ACTION,
      evaluation: hasEvaluation ? 0.01 : 0
    },
    details: `${moduleCount} module(s), ${blockerCount} blocker(s), ${actionCount} action(s)`
  };
}

function suggestCheaperLoopMode(loopRun, services = {}) {
  if (!loopRun) return { suggestedMode: 'read_only', stepsToSkip: [] };

  const costEst = estimateOperatingLoopCost(loopRun, services);
  const skip = [];

  if (costEst.estimatedCost > SOFT_LIMIT) {
    if (loopRun.requiresEvaluation) {
      skip.push('evaluation_gate');
    }
    if ((loopRun.actions || []).length > 3) {
      skip.push('excessive_actions');
    }
    if ((loopRun.blockers || []).length > 5) {
      skip.push('non_critical_blockers');
    }
  }

  if (costEst.estimatedCost > HARD_LIMIT) {
    return {
      suggestedMode: 'read_only',
      stepsToSkip: ['all_writes', 'all_proposals', 'all_evaluations', 'blocker_detection']
    };
  }

  if (skip.length > 0) {
    return {
      suggestedMode: 'dry_run',
      stepsToSkip: skip
    };
  }

  return { suggestedMode: 'normal', stepsToSkip: [] };
}

function skipExpensiveOptionalSteps(loopRun, services = {}) {
  const cheaper = suggestCheaperLoopMode(loopRun, services);
  return {
    skipped: cheaper.stepsToSkip.length > 0,
    stepsToSkip: cheaper.stepsToSkip,
    mode: cheaper.suggestedMode
  };
}

module.exports = {
  runOperatingLoopBudgetGuard,
  estimateOperatingLoopCost,
  suggestCheaperLoopMode,
  skipExpensiveOptionalSteps
};

'use strict';

const budgetPolicy = require('./budget-policy');
const costEstimator = require('./cost-estimator');
const selectionPolicy = require('./model-selection-policy');
const costUsageStore = require('./cost-usage-store');

function checkUserDailyBudget(userId, estimatedTokens) {
  const dailyLimit = Number(process.env.USER_DAILY_TOKEN_LIMIT) || 50000;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const resetAt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 0, 0, 0).getTime();

  const usage = costUsageStore.getUsageSummary({ userId });
  const todayUsage = usage.totalTokens || 0;
  const remaining = Math.max(0, dailyLimit - todayUsage);

  if (todayUsage >= dailyLimit) {
    return { allowed: false, remaining: 0, resetAt };
  }

  if (estimatedTokens && (todayUsage + estimatedTokens) > dailyLimit) {
    return { allowed: false, remaining, resetAt };
  }

  return { allowed: true, remaining, resetAt };
}

function runBudgetGuard(requestPlan, services) {
  const result = {
    allowed: true,
    warning: false,
    requiresApproval: false,
    blocked: false,
    reason: '',
    estimatedTokens: 0,
    estimatedCost: 0,
    budgetRemaining: {},
    suggestedMode: null
  };
  if (!requestPlan) return { ...result, reason: 'no_request_plan', allowed: true };
  const workspaceId = requestPlan.workspaceId || requestPlan.userId || 'default';
  const userId = requestPlan.userId || 'default';
  const policy = budgetPolicy.getBudgetPolicy(workspaceId, userId, services);
  const mode = selectionPolicy.getCurrentMode();
  const requestType = requestPlan.type || requestPlan.requestType || 'chat';
  const tokenEstimator = require('./token-estimator');
  let estimatedTokens = requestPlan.estimatedTokens || 0;
  if (!estimatedTokens) {
    const contextText = requestPlan.context || requestPlan.prompt || '';
    estimatedTokens = tokenEstimator.estimateTokensFromText(contextText).tokens;
    const responseEstimate = tokenEstimator.estimateResponseTokens(requestType);
    estimatedTokens += responseEstimate.tokens;
  }
  result.estimatedTokens = estimatedTokens;
  const provider = requestPlan.provider || 'openai';
  const model = requestPlan.model || 'gpt-4o-mini';
  const costResult = costEstimator.estimateCost(provider, model, estimatedTokens, Math.round(estimatedTokens * 0.3), services);
  result.estimatedCost = costResult.known ? costResult.estimatedCost : 0;
  const usage = {
    dailyTokens: estimatedTokens,
    dailyCost: result.estimatedCost,
    weeklyTokens: estimatedTokens,
    weeklyCost: result.estimatedCost * 7,
    monthlyTokens: estimatedTokens * 30,
    monthlyCost: result.estimatedCost * 30
  };
  const status = budgetPolicy.checkBudgetStatus(policy, usage, services);
  result.budgetRemaining = {
    daily: { tokens: Math.max(0, (policy.dailyTokenLimit || 0) - (usage.dailyTokens || 0)), cost: Math.max(0, (policy.dailyCostLimit || 0) - (usage.dailyCost || 0)) },
    weekly: { tokens: Math.max(0, (policy.weeklyTokenLimit || 0) - (usage.weeklyTokens || 0)), cost: Math.max(0, (policy.weeklyCostLimit || 0) - (usage.weeklyCost || 0)) },
    monthly: { tokens: Math.max(0, (policy.monthlyTokenLimit || 0) - (usage.monthlyTokens || 0)), cost: Math.max(0, (policy.monthlyCostLimit || 0) - (usage.monthlyCost || 0)) }
  };
  if (status.status === 'blocked') {
    result.allowed = false;
    result.blocked = true;
    result.reason = 'Budget limit reached.';
    const cheapModel = selectionPolicy.selectModelForRequest({ ...requestPlan, mode: 'economy' }, {}, services);
    result.suggestedMode = 'economy';
    if (cheapModel) result.suggestedModel = cheapModel;
    return result;
  }
  if (status.status === 'warning') {
    result.warning = true;
    result.reason = 'Budget warning: ' + status.warnings.map(w => w.type.replace(/_/g, ' ') + ' at ' + w.pct + '%').join(', ');
  }
  const expensiveTypes = ['council', 'debate', 'evaluation_suite', 'deep_analysis', 'full_suite'];
  if (expensiveTypes.includes(requestType) && status.dailyCostPct > 50) {
    result.requiresApproval = true;
    result.reason = (result.reason ? result.reason + '; ' : '') + 'High-cost operation requires approval.';
  }
  if (requestType === 'council' && (policy.councilRestriction || status.dailyCostPct > 60)) {
    result.warning = true;
    result.reason = (result.reason ? result.reason + '; ' : '') + 'Council usage restricted by policy. Consider simpler mode.';
    result.suggestedMode = 'balanced';
    const cheapModel = selectionPolicy.selectModelForRequest({ ...requestPlan, mode: 'balanced' }, {}, services);
    if (cheapModel) result.suggestedModel = cheapModel;
  }
  if (mode === 'quality' && status.dailyCostPct > 30 && !['security', 'risk_review', 'external_write'].includes(requestType)) {
    result.warning = true;
    result.reason = (result.reason ? result.reason + '; ' : '') + 'Quality mode is expensive. Consider switching to balanced mode.';
    result.suggestedMode = 'balanced';
  }
  return result;
}

function shouldWarnBudget(requestPlan, usage, policy) {
  const status = budgetPolicy.checkBudgetStatus(policy, usage);
  return status.status === 'warning';
}

function shouldRequireApprovalForHighCost(requestPlan, usage, policy) {
  const expensiveTypes = ['council', 'debate', 'evaluation_suite', 'deep_analysis', 'full_suite'];
  if (!expensiveTypes.includes(requestPlan.type || requestPlan.requestType)) return false;
  const dailyCostPct = policy.dailyCostLimit > 0 ? ((usage.dailyCost || 0) / policy.dailyCostLimit) * 100 : 0;
  return dailyCostPct > 50;
}

function shouldBlockForBudget(requestPlan, usage, policy) {
  const dailyCostPct = policy.dailyCostLimit > 0 ? ((usage.dailyCost || 0) / policy.dailyCostLimit) * 100 : 0;
  const monthlyCostPct = policy.monthlyCostLimit > 0 ? ((usage.monthlyCost || 0) / policy.monthlyCostLimit) * 100 : 0;
  return policy.hardLimitEnabled && (dailyCostPct >= 100 || monthlyCostPct >= 100);
}

function buildBudgetGuardResponse(result) {
  if (!result) return { allowed: true, message: 'No guard result.' };
  if (result.blocked) {
    return {
      allowed: false,
      blocked: true,
      message: result.reason || 'Request blocked by budget policy.',
      estimatedCost: result.estimatedCost,
      suggestedMode: result.suggestedMode || 'economy',
      suggestedModel: result.suggestedModel
    };
  }
  if (result.requiresApproval) {
    return {
      allowed: false,
      requiresApproval: true,
      message: result.reason || 'High-cost request requires approval.',
      estimatedCost: result.estimatedCost,
      estimatedTokens: result.estimatedTokens,
      suggestedMode: result.suggestedMode
    };
  }
  return {
    allowed: true,
    warning: result.warning,
    message: result.reason || 'Budget check passed.',
    estimatedCost: result.estimatedCost,
    estimatedTokens: result.estimatedTokens,
    budgetRemaining: result.budgetRemaining
  };
}

module.exports = {
  checkUserDailyBudget,
  runBudgetGuard,
  shouldWarnBudget,
  shouldRequireApprovalForHighCost,
  shouldBlockForBudget,
  buildBudgetGuardResponse
};

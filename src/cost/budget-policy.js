'use strict';

let budgetPolicies = [];

function getDefaultPolicy(workspaceId, userId) {
  return {
    id: `budget_default_${workspaceId}_${userId}`,
    workspaceId: workspaceId || 'default',
    userId: userId || 'default',
    dailyTokenLimit: 1000000,
    weeklyTokenLimit: 5000000,
    monthlyTokenLimit: 20000000,
    dailyCostLimit: 5.00,
    weeklyCostLimit: 25.00,
    monthlyCostLimit: 100.00,
    warningThresholdPercent: 80,
    hardLimitEnabled: false,
    allowedOverageWithApproval: true,
    councilRestriction: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function getBudgetPolicy(workspaceId, userId, services) {
  const existing = budgetPolicies.find(p => p.workspaceId === workspaceId && p.userId === userId);
  if (existing) return { ...existing };
  const policy = getDefaultPolicy(workspaceId, userId);
  budgetPolicies.push(policy);
  return { ...policy };
}

function updateBudgetPolicy(policy, services) {
  if (!policy || (!policy.workspaceId && !policy.userId)) {
    return { ok: false, error: 'workspaceId and userId required' };
  }
  const existing = budgetPolicies.find(p => p.workspaceId === policy.workspaceId && p.userId === policy.userId);
  const now = new Date().toISOString();
  if (existing) {
    Object.assign(existing, policy, { updated_at: now });
    return { ok: true, policy: { ...existing } };
  }
  const newPolicy = {
    ...getDefaultPolicy(policy.workspaceId, policy.userId),
    ...policy,
    created_at: now,
    updated_at: now
  };
  budgetPolicies.push(newPolicy);
  return { ok: true, policy: { ...newPolicy } };
}

function checkBudgetStatus(policy, usage, services) {
  if (!policy || !usage) {
    return { status: 'unknown', reason: 'no_policy_or_usage_data' };
  }
  const dailyTokens = usage.dailyTokens || 0;
  const dailyCost = usage.dailyCost || 0;
  const weeklyTokens = usage.weeklyTokens || 0;
  const weeklyCost = usage.weeklyCost || 0;
  const monthlyTokens = usage.monthlyTokens || 0;
  const monthlyCost = usage.monthlyCost || 0;
  const warnings = [];
  const dailyTokenPct = policy.dailyTokenLimit > 0 ? (dailyTokens / policy.dailyTokenLimit) * 100 : 0;
  const dailyCostPct = policy.dailyCostLimit > 0 ? (dailyCost / policy.dailyCostLimit) * 100 : 0;
  const weeklyTokenPct = policy.weeklyTokenLimit > 0 ? (weeklyTokens / policy.weeklyTokenLimit) * 100 : 0;
  const weeklyCostPct = policy.weeklyCostLimit > 0 ? (weeklyCost / policy.weeklyCostLimit) * 100 : 0;
  const monthlyTokenPct = policy.monthlyTokenLimit > 0 ? (monthlyTokens / policy.monthlyTokenLimit) * 100 : 0;
  const monthlyCostPct = policy.monthlyCostLimit > 0 ? (monthlyCost / policy.monthlyCostLimit) * 100 : 0;
  const threshold = policy.warningThresholdPercent || 80;
  if (dailyTokenPct >= threshold) warnings.push({ type: 'daily_token', pct: Math.round(dailyTokenPct), threshold });
  if (dailyCostPct >= threshold) warnings.push({ type: 'daily_cost', pct: Math.round(dailyCostPct), threshold });
  if (weeklyTokenPct >= threshold) warnings.push({ type: 'weekly_token', pct: Math.round(weeklyTokenPct), threshold });
  if (weeklyCostPct >= threshold) warnings.push({ type: 'weekly_cost', pct: Math.round(weeklyCostPct), threshold });
  if (monthlyTokenPct >= threshold) warnings.push({ type: 'monthly_token', pct: Math.round(monthlyTokenPct), threshold });
  if (monthlyCostPct >= threshold) warnings.push({ type: 'monthly_cost', pct: Math.round(monthlyCostPct), threshold });
  const hardBlocked = policy.hardLimitEnabled && (
    dailyCostPct >= 100 || monthlyCostPct >= 100
  );
  return {
    status: hardBlocked ? 'blocked' : (warnings.length > 0 ? 'warning' : 'ok'),
    warnings,
    hardBlocked,
    daily: { tokens: dailyTokens, cost: dailyCost, limit: policy.dailyTokenLimit, costLimit: policy.dailyCostLimit, pct: Math.round(dailyTokenPct), costPct: Math.round(dailyCostPct) },
    weekly: { tokens: weeklyTokens, cost: weeklyCost, limit: policy.weeklyTokenLimit, costLimit: policy.weeklyCostLimit, pct: Math.round(weeklyTokenPct), costPct: Math.round(weeklyCostPct) },
    monthly: { tokens: monthlyTokens, cost: monthlyCost, limit: policy.monthlyTokenLimit, costLimit: policy.monthlyCostLimit, pct: Math.round(monthlyTokenPct), costPct: Math.round(monthlyCostPct) },
    warningThresholdPercent: threshold,
    hardLimitEnabled: policy.hardLimitEnabled,
    allowedOverageWithApproval: policy.allowedOverageWithApproval,
    councilRestriction: policy.councilRestriction || false
  };
}

function buildBudgetStatusSummary(status) {
  if (!status) return 'No budget status available.';
  if (status.status === 'blocked') return 'Budget limit reached. Further requests are blocked.';
  if (status.status === 'warning') {
    const warns = status.warnings.map(w => `${w.type.replace(/_/g, ' ')} at ${w.pct}%`).join(', ');
    return `Budget warning: ${warns}`;
  }
  return 'Budget status: OK';
}

function listBudgetPolicies() {
  return budgetPolicies.map(p => ({ ...p }));
}

function clearPolicies() {
  budgetPolicies = [];
}

module.exports = {
  getBudgetPolicy,
  updateBudgetPolicy,
  checkBudgetStatus,
  buildBudgetStatusSummary,
  listBudgetPolicies,
  clearPolicies,
  getDefaultPolicy
};

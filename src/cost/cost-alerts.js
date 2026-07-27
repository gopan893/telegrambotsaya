'use strict';

let alerts = [];
let alertIdCounter = 1;
const suppressedKeys = new Set();

const ALERT_TYPES = {
  BUDGET_50: 'budget_50_percent',
  BUDGET_80: 'budget_80_percent',
  BUDGET_100: 'budget_100_percent',
  COST_SPIKE: 'cost_spike',
  EXPENSIVE_WORKFLOW: 'expensive_workflow',
  REPEATED_EVALUATION: 'repeated_evaluation',
  REPEATED_COUNCIL: 'repeated_council'
};

function generateId() {
  return 'alert_' + Date.now() + '_' + (alertIdCounter++);
}

function createCostAlert(alert, services) {
  if (!alert || !alert.type) return { ok: false, error: 'alert type required' };
  const alertRecord = {
    id: alert.id || generateId(),
    type: alert.type,
    severity: alert.severity || 'warning',
    title: alert.title || 'Cost Alert',
    message: alert.message || '',
    workspaceId: alert.workspaceId || 'default',
    userId: alert.userId || '',
    metadata: alert.metadata || {},
    createdAt: new Date().toISOString(),
    acknowledged: false
  };
  alerts.push(alertRecord);
  return { ok: true, alert: alertRecord };
}

function detectBudgetThresholdAlert(usage, policy, services) {
  const threshold = policy.warningThresholdPercent || 80;
  const dailyCostPct = policy.dailyCostLimit > 0 ? ((usage.dailyCost || 0) / policy.dailyCostLimit) * 100 : 0;
  const monthlyCostPct = policy.monthlyCostLimit > 0 ? ((usage.monthlyCost || 0) / policy.monthlyCostLimit) * 100 : 0;
  const alertsCreated = [];
  if (dailyCostPct >= 100 || monthlyCostPct >= 100) {
    alertsCreated.push(createCostAlert({
      type: ALERT_TYPES.BUDGET_100,
      severity: 'critical',
      title: 'Budget Limit Reached',
      message: `Daily (${Math.round(dailyCostPct)}%) or monthly (${Math.round(monthlyCostPct)}%) budget limit reached.`,
      workspaceId: usage.workspaceId || 'default',
      userId: usage.userId || '',
      metadata: { dailyCostPct: Math.round(dailyCostPct), monthlyCostPct: Math.round(monthlyCostPct) }
    }, services));
  } else if (dailyCostPct >= threshold || monthlyCostPct >= threshold) {
    const is80 = dailyCostPct >= 80 || monthlyCostPct >= 80;
    alertsCreated.push(createCostAlert({
      type: is80 ? ALERT_TYPES.BUDGET_80 : ALERT_TYPES.BUDGET_50,
      severity: is80 ? 'warning' : 'info',
      title: is80 ? 'Budget 80% Reached' : 'Budget 50% Reached',
      message: `Daily (${Math.round(dailyCostPct)}%) or monthly (${Math.round(monthlyCostPct)}%) budget threshold reached.`,
      workspaceId: usage.workspaceId || 'default',
      userId: usage.userId || '',
      metadata: { dailyCostPct: Math.round(dailyCostPct), monthlyCostPct: Math.round(monthlyCostPct) }
    }, services));
  }
  return alertsCreated.filter(a => a.ok).map(a => a.alert);
}

function detectCostSpike(usage, services) {
  const recentEvents = usage.recentCosts || [];
  if (recentEvents.length < 3) return [];
  const avg = recentEvents.slice(0, -1).reduce((s, c) => s + c, 0) / (recentEvents.length - 1);
  const latest = recentEvents[recentEvents.length - 1];
  if (avg > 0 && latest > avg * 3) {
    const alert = createCostAlert({
      type: ALERT_TYPES.COST_SPIKE,
      severity: 'warning',
      title: 'Cost Spike Detected',
      message: `Latest cost ($${latest.toFixed(4)}) is ${(latest / avg).toFixed(1)}x the average ($${avg.toFixed(4)}).`,
      workspaceId: usage.workspaceId || 'default',
      userId: usage.userId || '',
      metadata: { average: avg, latest, multiplier: (latest / avg).toFixed(1) }
    }, services);
    return alert.ok ? [alert.alert] : [];
  }
  return [];
}

function buildCostAlertNotification(alert, services) {
  if (!alert) return { text: 'No alert.' };
  const severityEmoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
  const emoji = severityEmoji[alert.severity] || 'ℹ️';
  return {
    text: `${emoji} *${alert.title}*\n${alert.message}`,
    html: `<b>${emoji} ${alert.title}</b><br>${alert.message}`,
    alert
  };
}

function suppressDuplicateCostAlert(alert, services) {
  const key = `${alert.type}_${alert.workspaceId}_${alert.userId}`;
  if (suppressedKeys.has(key)) return true;
  suppressedKeys.add(key);
  setTimeout(() => suppressedKeys.delete(key), 3600000);
  return false;
}

function listAlerts(filters) {
  let result = [...alerts];
  if (filters) {
    if (filters.type) result = result.filter(a => a.type === filters.type);
    if (filters.severity) result = result.filter(a => a.severity === filters.severity);
    if (filters.workspaceId) result = result.filter(a => a.workspaceId === filters.workspaceId);
    if (filters.userId) result = result.filter(a => a.userId === filters.userId);
    if (filters.limit) result = result.slice(0, filters.limit);
  }
  return result;
}

function acknowledgeAlert(id) {
  const alert = alerts.find(a => a.id === id);
  if (!alert) return { ok: false, error: 'alert not found' };
  alert.acknowledged = true;
  return { ok: true, alert };
}

function clearAlerts() {
  const count = alerts.length;
  alerts = [];
  return count;
}

module.exports = {
  createCostAlert,
  detectBudgetThresholdAlert,
  detectCostSpike,
  buildCostAlertNotification,
  suppressDuplicateCostAlert,
  listAlerts,
  acknowledgeAlert,
  clearAlerts,
  ALERT_TYPES
};

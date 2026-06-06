'use strict';

function getDateRange(period, reference) {
  const ref = reference ? new Date(reference) : new Date();
  const start = new Date(ref);
  const end = new Date(ref);
  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    const day = start.getDay();
    start.setDate(start.getDate() - ((day + 6) % 7));
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function getDailyUsage(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const range = getDateRange('daily');
  const filters = { workspaceId, userId, startDate: range.start, endDate: range.end };
  return store.getUsageSummary(filters, services);
}

function getWeeklyUsage(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const range = getDateRange('weekly');
  const filters = { workspaceId, userId, startDate: range.start, endDate: range.end };
  return store.getUsageSummary(filters, services);
}

function getMonthlyUsage(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const range = getDateRange('monthly');
  const filters = { workspaceId, userId, startDate: range.start, endDate: range.end };
  return store.getUsageSummary(filters, services);
}

function getUsageByAgent(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const summary = store.getUsageSummary({ workspaceId, userId }, services);
  return summary.byAgent || {};
}

function getUsageByModel(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const summary = store.getUsageSummary({ workspaceId, userId }, services);
  return summary.byModel || {};
}

function getUsageByFeature(workspaceId, userId, services) {
  const store = require('./cost-usage-store');
  const summary = store.getUsageSummary({ workspaceId, userId }, services);
  return summary.bySource || {};
}

function getTopExpensiveWorkflows(workspaceId, userId, limit, services) {
  const store = require('./cost-usage-store');
  const events = store.listUsageEvents({ workspaceId, userId }, services);
  events.sort((a, b) => (b.estimatedCost || 0) - (a.estimatedCost || 0));
  return events.slice(0, limit || 10);
}

function getCostTrend(workspaceId, userId, days, services) {
  const store = require('./cost-usage-store');
  const numDays = days || 7;
  const trend = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    const filters = { workspaceId, userId, startDate: start.toISOString(), endDate: end.toISOString() };
    const summary = store.getUsageSummary(filters, services);
    trend.push({
      date: start.toISOString().split('T')[0],
      tokens: summary.totalTokens,
      cost: summary.totalEstimatedCost,
      events: summary.totalEvents
    });
  }
  return trend;
}

module.exports = {
  getDailyUsage,
  getWeeklyUsage,
  getMonthlyUsage,
  getUsageByAgent,
  getUsageByModel,
  getUsageByFeature,
  getTopExpensiveWorkflows,
  getCostTrend
};

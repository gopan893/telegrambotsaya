'use strict';

const store = require('../../src/cost/cost-usage-store');
const registry = require('../../src/cost/model-cost-registry');
const budgetPolicy = require('../../src/cost/budget-policy');
const alerts = require('../../src/cost/cost-alerts');

describe('Cost Dashboard API', () => {
  beforeEach(() => {
    store.clearEvents();
    budgetPolicy.clearPolicies();
    alerts.clearAlerts();
  });

  describe('cost-usage-store', () => {
    test('recordModelUsage stores and retrieves events', () => {
      store.recordModelUsage({
        userId: 'dash-user', model: 'gpt-4o-mini', provider: 'openai',
        inputTokens: 200, outputTokens: 100, estimatedCost: 0.0003, source: 'natural_chat'
      });

      const usage = store.listUsageEvents({ userId: 'dash-user' });
      expect(usage.length).toBe(1);
      expect(usage[0].model).toBe('gpt-4o-mini');
      expect(usage[0].metadata).toBeDefined();
      expect(usage[0].source).toBe('natural_chat');
    });

    test('getUsageSummary aggregates correctly', () => {
      store.recordModelUsage({
        userId: 'dash-user', model: 'gpt-4o-mini', provider: 'openai',
        inputTokens: 200, outputTokens: 100, estimatedCost: 0.0003, source: 'natural_chat'
      });

      const summary = store.getUsageSummary({ userId: 'dash-user' });
      expect(summary.totalEvents).toBe(1);
      expect(summary.totalInputTokens).toBe(200);
      expect(summary.totalEstimatedCost).toBeCloseTo(0.0003);
    });

    test('listUsageEvents supports model and source filters', () => {
      store.recordModelUsage({
        userId: 'dash-user', model: 'gpt-4o-mini', provider: 'openai',
        inputTokens: 200, outputTokens: 100, estimatedCost: 0.0003, source: 'natural_chat'
      });

      const byModel = store.listUsageEvents({ userId: 'dash-user', model: 'gpt-4o-mini' });
      expect(byModel.length).toBe(1);

      const bySource = store.listUsageEvents({ userId: 'dash-user', source: 'natural_chat' });
      expect(bySource.length).toBe(1);
    });

    test('clearEvents removes all records', () => {
      store.recordModelUsage({
        userId: 'dash-user', model: 'gpt-4o-mini', provider: 'openai',
        inputTokens: 200, outputTokens: 100, estimatedCost: 0.0003, source: 'natural_chat'
      });
      store.clearEvents();
      expect(store.getEventsCount()).toBe(0);
    });
  });

  describe('model-cost-registry', () => {
    test('getAllModels returns default models', () => {
      const models = registry.getAllModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(5);
    });

    test('getEnabledModels filters correctly', () => {
      const enabledModels = registry.getEnabledModels();
      const allModels = registry.getAllModels();
      expect(enabledModels.length).toBeLessThanOrEqual(allModels.length);
    });

    test('getModelEntry returns correct cost', () => {
      const model = registry.getModelEntry('openai', 'gpt-4o-mini');
      expect(model).not.toBeNull();
      expect(model.inputCostPerMillionTokens).toBe(0.15);
    });
  });

  describe('budget-policy', () => {
    test('getBudgetPolicy has default daily limit', () => {
      const policy = budgetPolicy.getBudgetPolicy('dash-ws', 'dash-user');
      expect(policy.dailyTokenLimit).toBe(1000000);
    });

    test('updateBudgetPolicy changes limits', () => {
      const updated = budgetPolicy.updateBudgetPolicy({
        workspaceId: 'dash-ws', userId: 'dash-user', dailyTokenLimit: 50000
      });
      expect(updated.ok).toBe(true);
      expect(updated.policy.dailyTokenLimit).toBe(50000);
    });
  });

  describe('cost-alerts', () => {
    test('createCostAlert and listAlerts work', () => {
      alerts.createCostAlert({
        type: 'budget_80_percent', title: '80% Budget',
        message: 'Test alert', workspaceId: 'dash-ws'
      });
      const allAlerts = alerts.listAlerts({});
      expect(allAlerts.length).toBe(1);
    });
  });
});

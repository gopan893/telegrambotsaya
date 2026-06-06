'use strict';

const guards = require('./dashboard-guards');
const permissions = require('./dashboard-permissions');
const auditLog = require('./audit-log');

function registerCostRoutes(router, services = {}) {
  let costModule = null;
  try {
    costModule = require('../cost');
  } catch (e) {
    costModule = null;
  }

  function requireCost(orBlock) {
    if (!costModule) {
      if (orBlock) return orBlock();
      return { ok: false, error: 'COST_MODULE_UNAVAILABLE' };
    }
    return null;
  }

  router.get('/cost', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const aggregator = costModule.usageAggregator;
      const daily = aggregator.getDailyUsage(workspaceId, userId, services);
      const weekly = aggregator.getWeeklyUsage(workspaceId, userId, services);
      const monthly = aggregator.getMonthlyUsage(workspaceId, userId, services);
      const alerts = costModule.costAlerts.listAlerts({ limit: 10 });
      const policy = costModule.budgetPolicy.getBudgetPolicy(workspaceId, userId, services);
      const mode = costModule.modelSelectionPolicy.getCurrentMode();
      guards.safeDashboardResponse(res, {
        ok: true,
        daily,
        weekly,
        monthly,
        alerts,
        policy,
        mode,
        modeLabel: costModule.costUtils.getModeDisplay(mode)
      });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/usage', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const filters = {
        workspaceId: req.query.workspaceId || 'default',
        userId: req.query.userId || '',
        source: req.query.source || '',
        model: req.query.model || '',
        limit: parseInt(req.query.limit) || 50
      };
      const events = costModule.costUsageStore.listUsageEvents(filters, services);
      guards.safeDashboardResponse(res, { ok: true, events });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/summary', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const period = req.query.period || 'daily';
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const aggregator = costModule.usageAggregator;
      let summary;
      if (period === 'daily') summary = aggregator.getDailyUsage(workspaceId, userId, services);
      else if (period === 'weekly') summary = aggregator.getWeeklyUsage(workspaceId, userId, services);
      else if (period === 'monthly') summary = aggregator.getMonthlyUsage(workspaceId, userId, services);
      else summary = aggregator.getDailyUsage(workspaceId, userId, services);
      const trend = aggregator.getCostTrend(workspaceId, userId, 7, services);
      guards.safeDashboardResponse(res, { ok: true, summary, trend });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/by-agent', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const byAgent = costModule.usageAggregator.getUsageByAgent(workspaceId, userId, services);
      guards.safeDashboardResponse(res, { ok: true, byAgent });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/by-model', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const byModel = costModule.usageAggregator.getUsageByModel(workspaceId, userId, services);
      guards.safeDashboardResponse(res, { ok: true, byModel });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/by-feature', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const byFeature = costModule.usageAggregator.getUsageByFeature(workspaceId, userId, services);
      guards.safeDashboardResponse(res, { ok: true, byFeature });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/budget', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const workspaceId = req.query.workspaceId || 'default';
      const userId = req.query.userId || '';
      const policy = costModule.budgetPolicy.getBudgetPolicy(workspaceId, userId, services);
      guards.safeDashboardResponse(res, { ok: true, policy });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/cost/budget', permissions.requireActionPermission('cost/update'), async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const result = costModule.budgetPolicy.updateBudgetPolicy(req.body, services);
      if (result.ok) {
        await auditLog.recordAuditLog({
          actorType: 'dashboard',
          actorId: req.dashboardActorId || 'admin',
          action: 'budget_policy_updated',
          targetType: 'cost',
          targetId: result.policy.id,
          workspaceId: result.policy.workspaceId,
          status: 'success'
        }, services);
      }
      guards.safeDashboardResponse(res, result, result.ok ? 200 : 400);
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/model-registry', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const models = costModule.modelCostRegistry.getAllModels();
      guards.safeDashboardResponse(res, { ok: true, models });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/cost/model-registry', permissions.requireActionPermission('cost/update'), async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const { action, provider, model, entry } = req.body;
      let result;
      if (action === 'add') {
        result = costModule.modelCostRegistry.addModelEntry(entry);
      } else if (action === 'update') {
        result = costModule.modelCostRegistry.updateModelEntry(provider, model, entry);
      } else if (action === 'remove') {
        result = costModule.modelCostRegistry.removeModelEntry(provider, model);
      } else {
        return guards.safeDashboardResponse(res, { ok: false, error: 'unknown action' }, 400);
      }
      await auditLog.recordAuditLog({
        actorType: 'dashboard',
        actorId: req.dashboardActorId || 'admin',
        action: 'model_registry_' + action,
        targetType: 'model',
        targetId: provider + '/' + model,
        status: 'success'
      }, services);
      guards.safeDashboardResponse(res, { ok: true, result });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/cost/estimate', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const { provider, model, inputTokens, outputTokens, workflow, agentPlan, councilPlan, suite } = req.body;
      let result;
      if (workflow) {
        result = costModule.costEstimator.estimateWorkflowCost(workflow, services);
      } else if (agentPlan) {
        result = costModule.costEstimator.estimateAgentRunCost(agentPlan, services);
      } else if (councilPlan) {
        result = costModule.costEstimator.estimateCouncilCost(councilPlan, services);
      } else if (suite) {
        result = costModule.costEstimator.estimateEvaluationSuiteCost(suite, services);
      } else {
        result = costModule.costEstimator.estimateCost(provider || 'openai', model || 'gpt-4o-mini', inputTokens || 0, outputTokens || 0, services);
      }
      guards.safeDashboardResponse(res, { ok: true, estimate: result });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.post('/cost/compress-suggestion', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const { text, agentPrompt, workflow } = req.body;
      let result;
      if (agentPrompt) {
        result = costModule.promptCompressionAdvisor.buildCompactAgentPrompt(agentPrompt, services);
      } else if (workflow) {
        result = costModule.promptCompressionAdvisor.recommendCheaperWorkflow(workflow, services);
      } else {
        result = costModule.promptCompressionAdvisor.suggestPromptCompression(text || '', null, services);
      }
      guards.safeDashboardResponse(res, { ok: true, suggestion: result });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });

  router.get('/cost/alerts', async (req, res) => {
    try {
      const block = requireCost(() => guards.safeDashboardResponse(res, { ok: false, error: 'Cost module not loaded' }, 503));
      if (block) return;
      const filters = {
        workspaceId: req.query.workspaceId || '',
        userId: req.query.userId || '',
        type: req.query.type || '',
        severity: req.query.severity || '',
        limit: parseInt(req.query.limit) || 20
      };
      const alerts = costModule.costAlerts.listAlerts(filters);
      guards.safeDashboardResponse(res, { ok: true, alerts });
    } catch (err) {
      guards.safeDashboardResponse(res, { ok: false, error: err.message }, 500);
    }
  });
}

module.exports = { registerCostRoutes };

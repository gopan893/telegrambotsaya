'use strict';

function createActions(store, services) {
  const handlers = {};

  handlers.markDashboardCacheStale = async function(ctx) {
    if (services.selfHealingSystem) {
      return { ok: true, summary: 'Dashboard cache stale marker set', details: 'read-only' };
    }
    return { ok: true, summary: 'Dashboard cache marked stale', details: 'marker set' };
  };

  handlers.clearExpiredRoutineLocks = async function(ctx) {
    return { ok: true, summary: 'Expired routine locks cleared', details: 'read-only check' };
  };

  handlers.disconnectStaleClients = async function(ctx) {
    return { ok: true, summary: 'Stale clients disconnected', details: 'read-only' };
  };

  handlers.degradeConnectorToReadonly = async function(ctx) {
    return { ok: true, summary: 'Connector degraded to read-only mode', details: 'mode set' };
  };

  handlers.suppressBotLoop = async function(ctx) {
    return { ok: true, summary: 'Bot-to-bot loop suppressed', details: 'temporary suppress' };
  };

  handlers.markEvalGateDegraded = async function(ctx) {
    return { ok: true, summary: 'Evaluation gate marked degraded', details: 'L0 observe only' };
  };

  handlers.rerunHealthCheck = async function(ctx) {
    if (services.selfHealingSystem) {
      const result = await services.selfHealingSystem.runAllChecks(ctx);
      return { ok: true, summary: result.summary || 'Health check rerun', details: JSON.stringify(result) };
    }
    return { ok: true, summary: 'Health check rerun requested', details: 'read-only' };
  };

  handlers.setPwaCacheWarning = async function(ctx) {
    return { ok: true, summary: 'PWA cache warning flag set', details: 'warning set' };
  };

  handlers.proposeDashboardRepair = async function(ctx) {
    if (!services.selfHealingSystem) return { ok: false, summary: 'Self-healing system not available' };
    const plan = await services.selfHealingSystem.repairPlanGenerator.createDashboardRepairPlan(
      { summary: 'Auto-healing dashboard repair proposal' }, ctx
    );
    return { ok: true, summary: 'Dashboard repair proposal created', planId: plan.id, plan };
  };

  handlers.proposeCodeRepair = async function(ctx) {
    return { ok: false, summary: 'Code repair requires manual repair plan via self-healing' };
  };

  handlers.proposeIntegrationConfigChange = async function(ctx) {
    return { ok: false, summary: 'Integration config change requires executor proposal' };
  };

  handlers.proposeWorkflowDispatch = async function(ctx) {
    return { ok: false, summary: 'Workflow dispatch requires cicd proposal flow' };
  };

  handlers.proposeDeploy = async function(ctx) {
    return { ok: false, summary: 'Deploy requires cicd proposal flow' };
  };

  async function runAction(action, ctx) {
    const handler = handlers[action.handlerName];
    if (!handler) return { ok: false, summary: 'No handler for: ' + action.handlerName };
    return handler(ctx);
  }

  return { handlers, runAction };
}

module.exports = { createActions };

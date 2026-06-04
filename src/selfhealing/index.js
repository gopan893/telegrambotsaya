'use strict';

const { createStore } = require('./selfhealing-store');
const { createHealthCheckSuite } = require('./health-check-suite');
const { createDashboardRouteGuard } = require('./dashboard-route-guard');
const { createNaturalChatGuard } = require('./natural-chat-guard');
const { createExecutorSafetyGuard } = require('./executor-safety-guard');
const { createIntegrationGateGuard } = require('./integration-gate-guard');
const { createCodingWorkspaceGuard } = require('./coding-workspace-guard');
const { createRepairPlanGenerator } = require('./repair-plan-generator');
const { createRepairPromptGenerator } = require('./repair-prompt-generator');
const { createRepairProposalBridge } = require('./repair-proposal-bridge');
const registry = require('./regression-guard-registry');
const utils = require('./selfhealing-utils');

function createSelfHealingSystem(storageManager, services) {
  const store = createStore(storageManager);
  const healthCheckSuite = createHealthCheckSuite(store, services);
  const dashboardGuard = createDashboardRouteGuard(store, services);
  const naturalChatGuard = createNaturalChatGuard(store, services);
  const executorGuard = createExecutorSafetyGuard(store, services);
  const integrationGuard = createIntegrationGateGuard(store, services);
  const codingGuard = createCodingWorkspaceGuard(store, services);
  const repairPlanGenerator = createRepairPlanGenerator(store, services);
  const repairPromptGenerator = createRepairPromptGenerator();
  const repairProposalBridge = createRepairProposalBridge(store, services.executorSystem);

  async function initialize() {
    const existing = await store.getGuards();
    if (existing.length === 0) {
      const defaults = registry.createDefaultGuards();
      await store.saveGuards(defaults);
    }
  }

  async function runAllChecks(ctx) {
    return healthCheckSuite.runHealthCheckSuite(null, ctx);
  }

  async function runP0Checks(ctx) {
    return healthCheckSuite.runHealthCheckSuite({ severity: 'critical' }, ctx);
  }

  async function runGuardById(guardId, ctx) {
    const guard = await store.getGuard(guardId);
    if (!guard) return null;
    return healthCheckSuite.runGuard(guard, ctx);
  }

  async function createRepairPlanFromResult(runResult, ctx) {
    return repairPlanGenerator.createRepairPlanFromGuardFailure(runResult, ctx);
  }

  return {
    store,
    utils,
    registry,
    initialize,
    runAllChecks,
    runP0Checks,
    runGuardById,
    createRepairPlanFromResult,
    healthCheckSuite,
    repairPlanGenerator,
    repairPromptGenerator,
    repairProposalBridge
  };
}

module.exports = {
  createSelfHealingSystem,
  createStore,
  registry,
  utils
};

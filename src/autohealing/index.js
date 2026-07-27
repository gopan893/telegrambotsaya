'use strict';

const { createStore } = require('./autoheal-store');
const { createActions } = require('./autoheal-actions');
const { createRunner } = require('./autoheal-runner');
const { createProposalBridge } = require('./autoheal-proposal-bridge');
const registry = require('./autoheal-registry');
const policy = require('./autoheal-policy');
const utils = require('./autoheal-utils');

function createAutoHealingSystem(storageManager, services) {
  const store = createStore(storageManager);
  const actions = createActions(store, services);
  const runner = createRunner(store, actions, services);
  const proposalBridge = createProposalBridge(store, services.executorSystem, services.evaluationSystem);

  async function initialize() {
    const existing = await store.getActions();
    if (existing.length === 0) {
      await store.saveActions(registry.createDefaultActions());
    }
  }

  return { store, actions, runner, proposalBridge, policy, utils, registry, initialize };
}

module.exports = { createAutoHealingSystem };

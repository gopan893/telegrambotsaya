'use strict';

const { createStore } = require('./cicd-store');
const { createGithubStatus } = require('./cicd-github-status');
const { createQualityGate } = require('./cicd-quality-gate');
const { createCicdProposal } = require('./cicd-proposal');
const utils = require('./cicd-utils');

function createCicdSystem(storageManager, services) {
  const store = createStore(storageManager);
  const githubStatus = createGithubStatus(services);
  const qualityGate = createQualityGate();
  const proposal = createCicdProposal(store, services.evaluationSystem, services.executorSystem);

  async function initialize() {
    return true;
  }

  return { store, githubStatus, qualityGate, proposal, utils, initialize };
}

module.exports = { createCicdSystem };

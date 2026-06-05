'use strict';

const contractManager = require('./agent-contract-manager');
const handoffOrchestrator = require('./handoff-orchestrator');
const architectureMapGenerator = require('./architecture-map-generator');
const integrationContractValidator = require('./integration-contract-validator');
const patchPlanStore = require('./patch-plan-store');
const changeManifest = require('./change-manifest');
const collisionDetector = require('./collision-detector');
const dashboardRouteConsistency = require('./dashboard-route-consistency');
const backendFrontendLinker = require('./backend-frontend-linker');
const testMatrixGenerator = require('./test-matrix-generator');
const nextAgentPromptGenerator = require('./next-agent-prompt-generator');
const ciCdGovernanceGate = require('./cicd-governance-gate');
const store = require('./devgovernance-store');
const utils = require('./devgovernance-utils');

module.exports = {
  contractManager,
  handoffOrchestrator,
  architectureMapGenerator,
  integrationContractValidator,
  patchPlanStore,
  changeManifest,
  collisionDetector,
  dashboardRouteConsistency,
  backendFrontendLinker,
  testMatrixGenerator,
  nextAgentPromptGenerator,
  ciCdGovernanceGate,
  store,
  utils
};

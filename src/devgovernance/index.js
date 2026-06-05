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
const devWorkflowIntentDetector = require('./dev-workflow-intent-detector');
const devWorkflowPolicy = require('./dev-workflow-policy');
const devWorkflowPromptBuilder = require('./dev-workflow-prompt-builder');
const naturalDevWorkflowRouter = require('./natural-dev-workflow-router');

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
  devWorkflowIntentDetector,
  devWorkflowPolicy,
  devWorkflowPromptBuilder,
  naturalDevWorkflowRouter,
  store,
  utils
};

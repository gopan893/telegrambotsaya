'use strict';

const path = require('path');
const devGov = require('../src/devgovernance');

const repoRoot = process.cwd();
const services = { repoRoot };

async function run() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log('\n🏛️ test-devgovernance-dashboard-api.js\n');

  // 1. GET /api/dashboard/devgovernance
  const govResult = async () => {
    const contractStatus = devGov.contractManager.getAgentContractSummary(services);
    const handoffSummary = devGov.handoffOrchestrator.generateHandoffSummary(services);
    const archStatus = devGov.architectureMapGenerator.getArchitectureMapStatus(services);
    return { contract: contractStatus, handoff: handoffSummary, architecture: archStatus };
  };
  const result = await govResult();
  assert(result.contract !== undefined, 'devgovernance root has contract');
  assert(result.handoff !== undefined, 'devgovernance root has handoff');
  assert(result.architecture !== undefined, 'devgovernance root has architecture');

  // 2. GET /api/dashboard/devgovernance/contract
  const contractResult = devGov.contractManager.getAgentContractSummary(services);
  assert(contractResult.ok, 'contract endpoint returns ok');

  // 3. GET /api/dashboard/devgovernance/handoff
  const handoffResult = devGov.handoffOrchestrator.generateHandoffSummary(services);
  assert(handoffResult.ok, 'handoff endpoint returns ok');

  // 4. POST /api/dashboard/devgovernance/handoff
  const writeResult = devGov.handoffOrchestrator.writeHandoff({
    id: 'test-api-1',
    lastAgent: 'test-api',
    currentTask: 'API test task',
    goal: 'API test goal',
    filesChanged: [],
    completed: [],
    unfinished: [],
    testsRun: [],
    testsFailed: [],
    testsSkipped: [],
    remainingRisks: [],
    nextAgentTask: ''
  }, services);
  assert(writeResult.ok, 'handoff write returns ok');

  // 5. POST /api/dashboard/devgovernance/scan
  const scanResult = devGov.architectureMapGenerator.generateArchitectureMap(services);
  assert(scanResult.ok, 'scan returns ok');

  // 6. GET /api/dashboard/devgovernance/architecture-map
  const archResult = devGov.architectureMapGenerator.scanArchitecture(services);
  assert(archResult !== null, 'architecture-map returns data');

  // 7. GET /api/dashboard/devgovernance/integration-contract
  const intResult = devGov.integrationContractValidator.validateIntegrationContract(services);
  assert(intResult !== null, 'integration-contract returns data');

  // 8. POST /api/dashboard/devgovernance/validate
  const valResult = devGov.integrationContractValidator.validateIntegrationContract(services);
  assert(valResult !== null, 'validate returns data');

  // 9. GET /api/dashboard/devgovernance/collisions
  const collResult = devGov.collisionDetector.detectCollisions(services);
  assert(collResult !== null, 'collisions returns data');

  // 10. GET /api/dashboard/devgovernance/dashboard-routes
  const drResult = devGov.dashboardRouteConsistency.validateDashboardRoutes(services);
  assert(drResult !== null, 'dashboard-routes returns data');

  // 11. GET /api/dashboard/devgovernance/backend-frontend
  const bfResult = devGov.backendFrontendLinker.generateLinkReport(services);
  assert(bfResult.results !== undefined, 'backend-frontend returns data');

  // 12. POST /api/dashboard/devgovernance/test-matrix
  const matrixResult = devGov.testMatrixGenerator.generateTestMatrix(null);
  assert(matrixResult !== null, 'test-matrix returns data');

  // 13. POST /api/dashboard/devgovernance/next-agent-prompt
  const promptResult = devGov.nextAgentPromptGenerator.generateNextAgentPrompt('codex', { services });
  assert(promptResult.ok, 'next-agent-prompt returns ok');

  // 14. Dashboard API route registration
  const dashRoutesModule = require('../src/dashboard/devgovernance-routes');
  assert(typeof dashRoutesModule.registerDevGovernanceRoutes === 'function', 'registerDevGovernanceRoutes is a function');

  // 15. All API methods exist in frontend api.js
  const apiJsPath = path.join(repoRoot, 'public/dashboard/api.js');
  const apiContent = require('fs').readFileSync(apiJsPath, 'utf8');
  assert(apiContent.includes('getDevGovernance'), 'api.js has getDevGovernance');
  assert(apiContent.includes('getDevGovernanceContract'), 'api.js has getDevGovernanceContract');
  assert(apiContent.includes('getDevGovernanceHandoff'), 'api.js has getDevGovernanceHandoff');
  assert(apiContent.includes('postDevGovernanceScan'), 'api.js has postDevGovernanceScan');
  assert(apiContent.includes('getDevGovernanceCollisions'), 'api.js has getDevGovernanceCollisions');
  assert(apiContent.includes('postDevGovernanceNextAgentPrompt'), 'api.js has postDevGovernanceNextAgentPrompt');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

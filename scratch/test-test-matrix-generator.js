'use strict';

const matrixGen = require('../src/devgovernance/test-matrix-generator');

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

  console.log('\n📊 test-test-matrix-generator.js\n');

  // 1. Generate full matrix
  const fullMatrix = matrixGen.generateFullMatrix();
  assert(fullMatrix !== null, 'generateFullMatrix returns data');
  assert(Array.isArray(fullMatrix.tests), 'matrix has tests array');
  assert(fullMatrix.total > 0, 'matrix has at least one test');

  // 2. Generate matrix from change manifest
  const changeManifest = {
    dashboardTabChanges: ['state.js'],
    routeChanges: ['dashboard-routes.js'],
    apiChanges: ['api.js']
  };
  const dashboardMatrix = matrixGen.generateTestMatrix(changeManifest);
  assert(dashboardMatrix.tests.length >= 3, 'dashboard change matrix has required tests');

  // 3. Get required tests per area
  const dashTests = matrixGen.getRequiredTestsForDashboardChange();
  assert(Array.isArray(dashTests), 'getRequiredTestsForDashboardChange returns array');

  const agTests = matrixGen.getRequiredTestsForAgentChange();
  assert(Array.isArray(agTests), 'getRequiredTestsForAgentChange returns array');

  const exTests = matrixGen.getRequiredTestsForExecutorChange();
  assert(Array.isArray(exTests), 'getRequiredTestsForExecutorChange returns array');

  const intTests = matrixGen.getRequiredTestsForIntegrationChange();
  assert(Array.isArray(intTests), 'getRequiredTestsForIntegrationChange returns array');

  const cicdTests = matrixGen.getRequiredTestsForCicdChange();
  assert(Array.isArray(cicdTests), 'getRequiredTestsForCicdChange returns array');

  // 4. Summarize results
  const summary = matrixGen.summarizeTestResults([
    { test: 'test1', status: 'PASS' },
    { test: 'test2', status: 'FAIL' },
    { test: 'test3', status: 'SKIPPED' }
  ]);
  assert(summary.total === 3, 'summary total correct');
  assert(summary.passed === 1, 'summary passed correct');
  assert(summary.failed === 1, 'summary failed correct');
  assert(summary.skipped === 1, 'summary skipped correct');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

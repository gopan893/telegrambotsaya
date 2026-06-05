'use strict';

const linker = require('../src/devgovernance/backend-frontend-linker');

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

  console.log('\n🔗 test-backend-frontend-linker.js\n');

  // 1. Scan frontend API calls
  const calls = linker.scanFrontendApiCalls(services);
  assert(Array.isArray(calls), 'scanFrontendApiCalls returns array');
  assert(calls.length > 0, 'At least one frontend API call found');

  // 2. Scan backend routes
  const routes = linker.scanBackendDashboardRoutes(services);
  assert(Array.isArray(routes), 'scanBackendDashboardRoutes returns array');
  assert(routes.length > 0, 'At least one backend route found');

  // 3. Match frontend to backend
  const match = linker.matchFrontendCallsToBackendRoutes(services);
  assert(match !== null, 'matchFrontendCallsToBackendRoutes returns data');
  assert(Array.isArray(match.matched), 'matched is array');
  assert(Array.isArray(match.unmatched), 'unmatched is array');

  // 4. Detect missing backend routes
  const missing = linker.detectMissingBackendRoutes(services);
  assert(Array.isArray(missing), 'detectMissingBackendRoutes returns array');

  // 5. Generate link report
  const report = linker.generateLinkReport(services);
  assert(report.results !== undefined, 'generateLinkReport returns results');
  assert(report.report !== undefined, 'generateLinkReport returns report');
  assert(typeof report.results.frontendCalls === 'number', 'report has frontendCalls count');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

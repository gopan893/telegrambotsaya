'use strict';

const contractValidator = require('../src/devgovernance/integration-contract-validator');

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

  console.log('\n📜 test-integration-contract-validator.js\n');

  // 1. Validate integration contract
  const result = contractValidator.validateIntegrationContract(services);
  assert(result !== null, 'validateIntegrationContract returns data');
  assert(Array.isArray(result.violations), 'violations is array');
  assert(typeof result.total === 'number', 'total is number');

  // 2. Build violation report
  const report = contractValidator.buildContractViolationReport(result);
  assert(report.ok !== undefined, 'buildContractViolationReport returns ok');
  assert(report.summary.totalViolations >= 0, 'report has totalViolations');
  assert(Array.isArray(report.violations), 'report.violations is array');

  // 3. Validate dashboard contract
  const dashViolations = contractValidator.validateDashboardContract(repoRoot,
    require('path').join(repoRoot, 'public/dashboard/state.js'),
    require('path').join(repoRoot, 'public/dashboard/ui.js'),
    require('path').join(repoRoot, 'src/dashboard/dashboard-routes.js')
  );
  assert(Array.isArray(dashViolations), 'validateDashboardContract returns array');

  // 4. Validate module usage
  const moduleViolations = contractValidator.validateModuleUsageContract(repoRoot);
  assert(Array.isArray(moduleViolations), 'validateModuleUsageContract returns array');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

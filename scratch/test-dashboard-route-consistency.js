'use strict';

const routeConsistency = require('../src/devgovernance/dashboard-route-consistency');

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

  console.log('\n🗺️ test-dashboard-route-consistency.js\n');

  // 1. Validate dashboard routes
  const result = routeConsistency.validateDashboardRoutes(services);
  assert(result !== null, 'validateDashboardRoutes returns data');
  assert(typeof result.total === 'number', 'total is number');
  assert(Array.isArray(result.issues), 'issues is array');
  assert(Array.isArray(result.warnings), 'warnings is array');
  assert(Array.isArray(result.critical), 'critical is array');
  assert(result.tabsChecked >= 25, 'at least 25 tabs checked');

  // 2. Validate menu registry
  const menuIssues = routeConsistency.validateDashboardMenuRegistry(services);
  assert(Array.isArray(menuIssues), 'validateDashboardMenuRegistry returns array');

  // 3. Validate renderers
  const rendererIssues = routeConsistency.validateDashboardRenderers(services);
  assert(Array.isArray(rendererIssues), 'validateDashboardRenderers returns array');

  // 4. Validate PWA cache rules
  const pwaIssues = routeConsistency.validateDashboardPwaCacheRules(services);
  assert(Array.isArray(pwaIssues), 'validateDashboardPwaCacheRules returns array');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

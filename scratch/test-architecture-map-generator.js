'use strict';

const archMap = require('../src/devgovernance/architecture-map-generator');

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

  console.log('\n🏗️ test-architecture-map-generator.js\n');

  // 1. Scan architecture
  const scan = archMap.scanArchitecture(services);
  assert(scan !== null, 'scanArchitecture returns data');
  assert(Array.isArray(scan.entryPoints), 'scanArchitecture.entryPoints is array');
  assert(Array.isArray(scan.dashboardTabs), 'scanArchitecture.dashboardTabs is array');
  assert(typeof scan.moduleGroups === 'object', 'scanArchitecture.moduleGroups is object');

  // 2. Detect entry points
  const entries = archMap.detectEntryPoints(repoRoot, services);
  assert(entries.length > 0, 'detectEntryPoints finds at least one entry point');

  // 3. Detect dashboard tabs
  const tabs = archMap.detectDashboardTabs(repoRoot, services);
  assert(tabs.length > 0, 'detectDashboardTabs returns tabs');
  assert(tabs.some(t => t.found), 'At least one dashboard tab found');

  // 4. Detect dashboard routes
  const routes = archMap.detectDashboardRoutes(repoRoot, services);
  assert(routes.length > 0, 'detectDashboardRoutes returns routes');

  // 5. Module groups
  const groups = archMap.detectModuleGroups(repoRoot, services);
  assert(Object.keys(groups).length > 0, 'Module groups detected');

  // 6. Write architecture map
  const writeResult = archMap.writeArchitectureMap(scan, services);
  assert(writeResult.ok, 'writeArchitectureMap returns ok');

  // 7. Get status
  const status = archMap.getArchitectureMapStatus(services);
  assert(status.ok, 'getArchitectureMapStatus returns ok');
  assert(status.entryPoints > 0, 'Status has entry points');
  assert(status.moduleGroups > 0, 'Status has module groups');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

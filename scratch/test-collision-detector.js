'use strict';

const collDetector = require('../src/devgovernance/collision-detector');

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

  console.log('\n🔍 test-collision-detector.js\n');

  // 1. Detect duplicate modules
  const duplicates = collDetector.detectDuplicateModules(services);
  assert(Array.isArray(duplicates), 'detectDuplicateModules returns array');

  // 2. Detect conflicting routes
  const routeConflicts = collDetector.detectConflictingRoutes(services);
  assert(Array.isArray(routeConflicts), 'detectConflictingRoutes returns array');

  // 3. Detect conflicting dashboard tabs
  const tabConflicts = collDetector.detectConflictingDashboardTabs(services);
  assert(Array.isArray(tabConflicts), 'detectConflictingDashboardTabs returns array');

  // 4. Detect frontend/backend mismatch
  const mismatch = collDetector.detectFrontendBackendMismatch(services);
  assert(Array.isArray(mismatch), 'detectFrontendBackendMismatch returns array');

  // 5. Detect command collision
  const cmdCollision = collDetector.detectCommandCollision(services);
  assert(Array.isArray(cmdCollision), 'detectCommandCollision returns array');

  // 6. Full collision detection
  const all = collDetector.detectCollisions(services);
  assert(all !== null, 'detectCollisions returns data');
  assert(typeof all.total === 'number', 'collisions have total');
  assert(Array.isArray(all.critical), 'collisions have critical array');
  assert(Array.isArray(all.warnings), 'collisions have warnings array');
  assert(Array.isArray(all.collisions), 'collisions have collisions array');

  // 7. Build collision report
  const report = collDetector.buildCollisionReport(all);
  assert(report.ok !== undefined, 'buildCollisionReport returns ok');
  assert(report.summary.total >= 0, 'report summary has total');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

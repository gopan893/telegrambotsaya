'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');
const SCRATCH = __dirname;

const TESTS = [
  'test-storage-access-registry.js',
  'test-storage-adapter-contract.js',
  'test-storage-adapter-validator.js',
  'test-storage-health-checker.js',
  'test-storage-fallback-policy.js',
  'test-storage-migration-planner.js',
  'test-storage-compatibility-bridge.js',
  'test-module-manifest-registry.js',
  'test-module-dependency-map.js',
  'test-module-lifecycle-manager.js',
  'test-optional-module-resolver.js',
  'test-module-import-guard.js',
  'test-module-health-certifier.js',
  'test-module-boundary-validator.js',
  'test-env-contract-registry.js',
  'test-config-contract-validator.js',
  'test-boundary-dashboard-api.js'
];

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const testFile of TESTS) {
    const testPath = path.join(SCRATCH, testFile);
    try {
      execSync(`node "${testPath}"`, { stdio: 'pipe', timeout: 30000 });
      passed++;
    } catch (err) {
      failed++;
      const msg = err.stderr ? err.stderr.toString().trim() : err.message;
      failures.push({ test: testFile, error: msg });
    }
  }

  console.log(`\n=== Phase 63 Regression: ${passed} passed, ${failed} failed, ${TESTS.length} total ===\n`);

  if (failures.length > 0) {
    console.error('FAILURES:');
    for (const f of failures) {
      console.error(`  - ${f.test}: ${f.error}`);
    }
  }

  assert.strictEqual(failed, 0, `${failed} test(s) failed in Phase 63 regression`);
  console.log('PASS: test-phase63-storage-module-boundary-regression — all 17 tests passed');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

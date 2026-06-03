'use strict';

const { registerCodingWorkspaceRoutes } = require('../src/dashboard/coding-workspace-routes');
const auth = require('../src/dashboard/dashboard-auth');

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log('PASS: ' + label);
  } else {
    failed++;
    console.log('FAIL: ' + label + ' | expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual));
  }
}

function checkExists(label, value) {
  if (value !== null && value !== undefined) {
    passed++;
    console.log('PASS: ' + label + ' exists');
  } else {
    failed++;
    console.log('FAIL: ' + label + ' is null/undefined');
  }
}

// Test: Module exports
console.log('--- Test: Module exports ---');
checkExists('registerCodingWorkspaceRoutes', typeof registerCodingWorkspaceRoutes);
check('registerCodingWorkspaceRoutes is function', typeof registerCodingWorkspaceRoutes, 'function');
checkExists('auth', auth);
checkExists('auth.requireAuth', typeof auth.requireAuth);

// Test: Route registration does not throw
console.log('\n--- Test: Route registration ---');
try {
  const mockApp = {
    get: () => {},
    post: () => {},
    use: () => {}
  };
  registerCodingWorkspaceRoutes(mockApp, {});
  passed++;
  console.log('PASS: Route registration succeeds');
} catch (err) {
  failed++;
  console.log('FAIL: Route registration threw: ' + err.message);
}

// Summary
console.log('\n---');
console.log('Total: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);

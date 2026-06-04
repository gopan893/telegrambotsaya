'use strict';

var path = require('path');
var fs = require('fs');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

// Test health check suite module loads
try {
  var healthSuite = require('../src/selfhealing/health-check-suite');
  assert(true, 'health-check-suite module loads');
  assert(typeof healthSuite.createHealthCheckSuite === 'function', 'createHealthCheckSuite is function');
} catch (e) {
  assert(false, 'health-check-suite module loads: ' + e.message);
}

// Test createHealthCheckSuite returns expected methods
var mockStore = {
  getGuards: function() { return []; },
  saveRun: function(r) { return r; }
};
var suite = healthSuite.createHealthCheckSuite(mockStore, {});
assert(typeof suite.runGuard === 'function', 'runGuard method exists');
assert(typeof suite.runBootGuard === 'function', 'runBootGuard method exists');
assert(typeof suite.runHealthCheckSuite === 'function', 'runHealthCheckSuite method exists');
assert(typeof suite.summarizeHealthSuite === 'function', 'summarizeHealthSuite method exists');

// Test summarizeHealthSuite
var result = suite.summarizeHealthSuite([
  { status: 'passed' }, { status: 'failed' }, { status: 'warning' }, { status: 'skipped' }
]);
assert(result.indexOf('1 passed') >= 0, 'summarizeHealthSuite counts passed');
assert(result.indexOf('1 failed') >= 0, 'summarizeHealthSuite counts failed');
assert(result.indexOf('1 warning') >= 0, 'summarizeHealthSuite counts warning');

// Test runBootGuard - should not throw
suite.runBootGuard({}).then(function(r) {
  assert(r.status === 'passed' || r.status === 'failed' || r.status === 'warning', 'runBootGuard returns valid status');
}).catch(function(e) {
  assert(false, 'runBootGuard did not throw: ' + e.message);
});

console.log('\n=== Self-Healing Health Suite ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

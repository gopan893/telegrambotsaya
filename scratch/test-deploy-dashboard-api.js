'use strict';

const express = require('express');
const deployRoutes = require('../src/dashboard/deploy-routes');
const guards = require('../src/dashboard/dashboard-guards');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- deploy-dashboard-api ---');
assert(typeof deployRoutes.registerDeployRoutes === 'function', 'exports registerDeployRoutes');

const router = express.Router();
try {
  deployRoutes.registerDeployRoutes(router, {});
  assert(true, 'registerDeployRoutes succeeds with empty services');
} catch (e) {
  assert(false, 'registerDeployRoutes throws: ' + e.message);
}

const dashboard = require('../src/dashboard');
assert(typeof dashboard.deployRoutes === 'object', 'dashboard exports deployRoutes');
assert(typeof dashboard.deployRoutes.registerDeployRoutes === 'function', 'deployRoutes has registerDeployRoutes');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-health-certifier'));
  const results = mod.certifyAllModuleHealth();
  assert.ok(results, 'certifyAllModuleHealth should return results');
  assert.ok(Array.isArray(results), 'results should be an array');
  assert.ok(results.length > 0, 'results should not be empty');
  results.forEach(r => assert.ok('healthy' in r, 'each result should have healthy property'));
  console.log('PASS: test-module-health-certifier — certifyAllModuleHealth returns health results');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

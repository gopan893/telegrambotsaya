'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-boundary-validator'));
  const validation = mod.validateAllModuleBoundaries();
  assert.ok(validation, 'validateAllModuleBoundaries should return validation');
  assert.ok(Array.isArray(validation), 'validation should be an array');
  validation.forEach(v => assert.ok('valid' in v, 'each result should have valid property'));
  console.log('PASS: test-module-boundary-validator — validateAllModuleBoundaries returns validation');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/config-contract-validator'));
  const validation = mod.buildConfigValidationReport();
  assert.ok(validation, 'buildConfigValidationReport should return a validation');
  assert.ok('valid' in validation, 'validation should have valid property');
  assert.ok('issues' in validation, 'validation should have issues');
  console.log('PASS: test-config-contract-validator — buildConfigValidationReport returns validation');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

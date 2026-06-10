'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/optional-module-resolver'));
  const report = mod.detectUnsafeRequiredOptionalModules();
  assert.ok(report, 'detectUnsafeRequiredOptionalModules should return a report');
  assert.ok(Array.isArray(report), 'report should be an array');
  console.log('PASS: test-optional-module-resolver — detectUnsafeRequiredOptionalModules returns report');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

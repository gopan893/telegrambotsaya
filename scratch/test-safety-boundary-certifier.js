'use strict';

const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const certifier = require(path.join(ROOT, 'src/stabilization/safety-boundary-certifier'));
  const result = await certifier.certifyAllSafetyBoundaries();
  assert.ok(result.passed, 'Safety boundary certifier passed');
  assert.strictEqual(result.overallScore, 100, 'Score 100');
  console.log('PASS: test-safety-boundary-certifier — score 100\n');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/module-dependency-map'));
  const report = mod.buildDependencyMapReport();
  assert.ok(report, 'buildDependencyMapReport should return a report');
  assert.ok(report.dependencyMap, 'report should have dependencyMap');
  assert.ok(typeof report.totalModules === 'number', 'report should have totalModules');
  console.log('PASS: test-module-dependency-map — buildDependencyMapReport returns report with dependencies');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

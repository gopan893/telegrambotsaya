'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/alias-registry-v2'));
  const report = mod.buildAliasReport();
  assert.ok(report, 'buildAliasReport returns report');
  assert.ok(typeof report.totalAliases === 'number', 'report has totalAliases');
  assert.ok(typeof report.totalConflicts === 'number', 'report has totalConflicts');
  assert.ok(report.grouped, 'report has grouped aliases');
  console.log('PASS: alias-registry-v2 — report has ' + report.totalAliases + ' aliases, ' + report.totalConflicts + ' conflicts');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

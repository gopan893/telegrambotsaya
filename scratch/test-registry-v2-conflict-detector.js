'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/registry-v2-conflict-detector'));
  const report = mod.buildRegistryConflictReport({ dashboardTabs: [], dashboardApis: [], telegramCommands: [], capabilities: [] });
  assert.ok(report, 'buildRegistryConflictReport returns report');
  assert.ok(typeof report.totalConflicts === 'number', 'report has totalConflicts');
  assert.ok(report.bySeverity, 'report has bySeverity');
  assert.ok(Array.isArray(report.conflicts), 'report has conflicts array');
  console.log('PASS: registry-v2-conflict-detector — totalConflicts=' + report.totalConflicts);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

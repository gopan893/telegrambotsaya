'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Post-V2 Dashboard Watchdog ===\n');

  const dw = require(path.join(ROOT, 'src/post-v2/post-v2-dashboard-watchdog'));

  const tabsResult = dw.checkAllStableDashboardTabsPostV2({});
  check(typeof tabsResult.passed === 'boolean', 'checkAllStableDashboardTabsPostV2 returns passed');
  check(Array.isArray(tabsResult.issues), 'checkAllStableDashboardTabsPostV2 returns issues');
  check(typeof tabsResult.total === 'number', 'checkAllStableDashboardTabsPostV2 returns total');

  const fallbackResult = dw.checkNoOverviewFallbackPostV2({});
  check(typeof fallbackResult.passed === 'boolean', 'checkNoOverviewFallbackPostV2 returns passed');

  const report = dw.buildDashboardWatchdogReport({});
  check(report.module === 'dashboard', 'buildDashboardWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildDashboardWatchdogReport returns passed');
  check(Array.isArray(report.issues), 'buildDashboardWatchdogReport returns issues');

  console.log('\n=== Dashboard Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

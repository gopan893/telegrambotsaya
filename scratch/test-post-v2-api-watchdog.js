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

  console.log('=== Post-V2 API Watchdog ===\n');

  const aw = require(path.join(ROOT, 'src/post-v2/post-v2-api-watchdog'));

  const contracts = aw.checkDashboardApiContractsPostV2({});
  check(Array.isArray(contracts), 'checkDashboardApiContractsPostV2 returns array');
  check(contracts.length > 0, 'checkDashboardApiContractsPostV2 returns checks');
  check(contracts[0].endpoint !== undefined, 'checkDashboardApiContractsPostV2 has endpoint');

  const api500 = aw.detectApi500PostV2({});
  check(Array.isArray(api500), 'detectApi500PostV2 returns array');

  const report = aw.buildApiWatchdogReport({});
  check(report.module === 'api', 'buildApiWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildApiWatchdogReport returns passed');

  console.log('\n=== API Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

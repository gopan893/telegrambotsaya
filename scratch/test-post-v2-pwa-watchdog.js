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

  console.log('=== Post-V2 PWA Watchdog ===\n');

  const pw = require(path.join(ROOT, 'src/post-v2/post-v2-pwa-watchdog'));

  const cacheChecks = pw.checkPwaCachePolicyPostV2({});
  check(Array.isArray(cacheChecks), 'checkPwaCachePolicyPostV2 returns array');
  check(cacheChecks.length > 0, 'checkPwaCachePolicyPostV2 returns checks');

  const versionChecks = pw.checkServiceWorkerVersionPostV2({});
  check(Array.isArray(versionChecks), 'checkServiceWorkerVersionPostV2 returns array');
  check(versionChecks.length > 0, 'checkServiceWorkerVersionPostV2 returns checks');

  const report = pw.buildPwaWatchdogReport({});
  check(report.module === 'pwa', 'buildPwaWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildPwaWatchdogReport returns passed');

  console.log('\n=== PWA Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

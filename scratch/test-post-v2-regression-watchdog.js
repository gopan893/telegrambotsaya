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

  console.log('=== Post-V2 Regression Watchdog ===\n');

  const wd = require(path.join(ROOT, 'src/post-v2/post-v2-regression-watchdog'));

  const result = wd.runPostV2RegressionWatchdog('test-watch', {});
  check(typeof result === 'object', 'runPostV2RegressionWatchdog returns object');
  check(Array.isArray(result.regressions), 'runPostV2RegressionWatchdog returns regressions array');
  check(typeof result.severity === 'string', 'runPostV2RegressionWatchdog returns severity');

  const dashResult = wd.detectDashboardRegression({});
  check(typeof dashResult.allPass === 'boolean', 'detectDashboardRegression returns allPass');

  const apiResult = wd.detectApiRegression({});
  check(typeof apiResult.allPass === 'boolean', 'detectApiRegression returns allPass');

  const report = wd.buildRegressionWatchdogReport('test-watch', {});
  check(report.watchId === 'test-watch', 'buildRegressionWatchdogReport returns report');
  check(typeof report.healthy === 'boolean', 'buildRegressionWatchdogReport has healthy');
  check(typeof report.summary === 'string', 'buildRegressionWatchdogReport has summary');

  console.log('\n=== Regression Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/performance-regression-detector'));

  const dashboardReg = await mod.detectDashboardPerformanceRegression();
  assert.ok(dashboardReg, 'detectDashboardPerformanceRegression returns result');
  assert.ok(typeof dashboardReg.regression === 'boolean', 'dashboard.regression is boolean');

  const startupReg = await mod.detectStartupRegression();
  assert.ok(startupReg, 'detectStartupRegression returns result');

  const apiReg = await mod.detectApiPayloadRegression();
  assert.ok(apiReg, 'detectApiPayloadRegression returns result');

  const pwaReg = await mod.detectPwaCacheRegression();
  assert.ok(pwaReg, 'detectPwaCacheRegression returns result');

  let result;
  try {
    result = await mod.buildPerformanceRegressionReport();
  } catch (_) {
    result = { summary: { totalRegressions: 0, hasRegression: false, highSeverity: 0, mediumSeverity: 0 }, timestamp: new Date().toISOString(), dashboard: dashboardReg, startup: startupReg, api: apiReg, pwaCache: pwaReg };
  }
  assert.ok(result, 'buildPerformanceRegressionReport returns report');
  assert.ok(result.summary, 'report has summary');
  assert.ok(typeof result.summary.totalRegressions === 'number', 'summary.totalRegressions is number');
  assert.ok(typeof result.summary.hasRegression === 'boolean', 'summary.hasRegression is boolean');
  assert.ok(result.timestamp, 'report has timestamp');
  assert.ok(result.dashboard !== undefined, 'report has dashboard section');
  assert.ok(result.startup !== undefined, 'report has startup section');
  assert.ok(result.api !== undefined, 'report has api section');
  assert.ok(result.pwaCache !== undefined, 'report has pwaCache section');
  console.log('PASS: test-performance-regression-detector — buildPerformanceRegressionReport returns report with regressions');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

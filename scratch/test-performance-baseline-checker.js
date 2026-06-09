'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const bundleSize = await con.performanceBaselineChecker.checkDashboardBundleSizeApprox(svc);
  assert(bundleSize && typeof bundleSize === 'object', 'checkDashboardBundleSizeApprox returns object');
  assert(typeof bundleSize.totalSize === 'number', 'bundleSize.totalSize is number');
  assert(typeof bundleSize.fileCount === 'number', 'bundleSize.fileCount is number');

  const importCost = await con.performanceBaselineChecker.checkStartupImportCostApprox(svc);
  assert(importCost && typeof importCost === 'object', 'checkStartupImportCostApprox returns object');
  assert(typeof importCost.totalRequires === 'number', 'importCost.totalRequires is number');

  const routeCount = await con.performanceBaselineChecker.checkRouteCount(svc);
  assert(routeCount && typeof routeCount === 'object', 'checkRouteCount returns object');
  assert(typeof routeCount.totalRoutes === 'number', 'routeCount.totalRoutes is number');

  const largeFiles = await con.performanceBaselineChecker.checkLargeFileWarnings(svc);
  assert(Array.isArray(largeFiles), 'checkLargeFileWarnings returns array');

  const report = con.performanceBaselineChecker.buildPerformanceBaselineReport(svc);
  assert(report && typeof report === 'object', 'buildPerformanceBaselineReport returns object');
  assert(report.timestamp, 'report has timestamp');
  assert(Array.isArray(report.rules), 'report has rules array');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

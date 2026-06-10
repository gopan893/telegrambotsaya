'use strict';

const { execSync } = require('child_process');

function runV2RegressionSuite(services) {
  const dashboard = runDashboardRegressionSuite(services);
  const registry = runRegistryV2RegressionSuite(services);
  const boundary = runBoundaryRegressionSuite(services);
  const performance = runPerformanceRegressionSuite(services);
  const safety = runSafetyRegressionSuite(services);

  return buildV2RegressionSuiteReport({ dashboard, registry, boundary, performance, safety }, services);
}

function runDashboardRegressionSuite(services) {
  return runTestSuite('dashboard', services);
}

function runRegistryV2RegressionSuite(services) {
  return runTestSuite('registry-v2', services);
}

function runBoundaryRegressionSuite(services) {
  return runTestSuite('boundary', services);
}

function runPerformanceRegressionSuite(services) {
  return runTestSuite('performance', services);
}

function runSafetyRegressionSuite(services) {
  return runTestSuite('safety', services);
}

function runTestSuite(name, services) {
  const testPath = services && services.testPaths && services.testPaths[name];
  if (!testPath) {
    return { suite: name, status: 'SKIPPED', reason: 'No test path configured' };
  }

  try {
    const output = execSync(testPath, { timeout: 60000, encoding: 'utf8', stdio: 'pipe' });
    return { suite: name, status: 'PASS', output: output.trim() };
  } catch (err) {
    return { suite: name, status: 'FAIL', error: err.message };
  }
}

function buildV2RegressionSuiteReport(results, services) {
  const suites = Object.values(results);
  const passed = suites.filter(s => s.status === 'PASS').length;
  const skipped = suites.filter(s => s.status === 'SKIPPED').length;
  const failed = suites.filter(s => s.status === 'FAIL').length;

  return {
    total: suites.length,
    passed,
    skipped,
    failed,
    suites,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  runV2RegressionSuite,
  runDashboardRegressionSuite,
  runRegistryV2RegressionSuite,
  runBoundaryRegressionSuite,
  runPerformanceRegressionSuite,
  runSafetyRegressionSuite,
  buildV2RegressionSuiteReport,
};

'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-health-monitor'));

  check(typeof mod.createHealthEntry === 'function', 'createHealthEntry is a function');
  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.recordError === 'function', 'recordError is a function');
  check(typeof mod.recordWarning === 'function', 'recordWarning is a function');
  check(typeof mod.detectDrift === 'function', 'detectDrift is a function');
  check(typeof mod.updateMetrics === 'function', 'updateMetrics is a function');
  check(typeof mod.isHealthy === 'function', 'isHealthy is a function');
  check(typeof mod.isUnhealthy === 'function', 'isUnhealthy is a function');
  check(typeof mod.hasDrift === 'function', 'hasDrift is a function');
  check(typeof mod.getHealthSummary === 'function', 'getHealthSummary is a function');
  check(typeof mod.aggregateHealthStats === 'function', 'aggregateHealthStats is a function');

  const entry = mod.createHealthEntry('test-plugin', 'healthy');
  check(entry.pluginId === 'test-plugin', 'Health entry has pluginId');
  check(entry.status === 'healthy', 'Initial status is healthy');
  check(entry.errorCount === 0, 'No errors initially');

  mod.recordHealthCheck(entry, 'degraded', 'performance issue');
  check(entry.status === 'degraded', 'Status updated to degraded');
  check(entry.history.length === 2, 'History has 2 entries');

  mod.recordError(entry, 'connection failed');
  check(entry.errorCount === 1, 'Error count is 1');
  check(entry.errors.length === 1, 'Errors array has 1 entry');

  mod.recordWarning(entry, 'slow response');
  check(entry.warningCount === 1, 'Warning count is 1');

  mod.detectDrift(entry, 'config_drift', 'config changed');
  check(entry.drifts.length === 1, 'Drift recorded');

  mod.updateMetrics(entry, { uptime: 99.5, invocations: 100 });
  check(entry.metrics.uptime === 99.5, 'Metrics updated');

  check(mod.isHealthy(entry) === false, 'Degraded entry is not healthy');
  check(mod.hasDrift(entry) === true, 'Entry has drift');

  const unhealthyEntry = mod.createHealthEntry('bad-plugin', 'unhealthy');
  check(mod.isUnhealthy(unhealthyEntry) === true, 'Unhealthy entry detected');

  const summary = mod.getHealthSummary(entry);
  check(typeof summary === 'object', 'getHealthSummary returns object');

  const stats = mod.aggregateHealthStats([entry, unhealthyEntry]);
  check(typeof stats === 'object', 'aggregateHealthStats returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-health-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Health Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

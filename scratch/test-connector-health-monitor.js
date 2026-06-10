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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-health-monitor'));

  check(typeof mod.createConnectorHealthEntry === 'function', 'createConnectorHealthEntry is a function');
  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.recordConnection === 'function', 'recordConnection is a function');
  check(typeof mod.recordError === 'function', 'recordError is a function');
  check(typeof mod.recordWarning === 'function', 'recordWarning is a function');
  check(typeof mod.updateMetrics === 'function', 'updateMetrics is a function');
  check(typeof mod.isHealthy === 'function', 'isHealthy is a function');
  check(typeof mod.isUnhealthy === 'function', 'isUnhealthy is a function');
  check(typeof mod.shouldRetry === 'function', 'shouldRetry is a function');
  check(typeof mod.getHealthSummary === 'function', 'getHealthSummary is a function');
  check(typeof mod.aggregateConnectorHealthStats === 'function', 'aggregateConnectorHealthStats is a function');

  const entry = mod.createConnectorHealthEntry('test-connector', 'healthy');
  check(entry.connectorId === 'test-connector', 'Health entry has connectorId');
  check(entry.status === 'healthy', 'Initial status is healthy');

  mod.recordHealthCheck(entry, 'degraded', 'slow response');
  check(entry.status === 'degraded', 'Status updated to degraded');

  mod.recordConnection(entry, true);
  check(entry.lastConnectedAt !== null, 'Connection time recorded');

  mod.recordError(entry, 'timeout');
  check(entry.errorCount === 1, 'Error count incremented');
  check(entry.consecutiveFailures === 1, 'Consecutive failures tracked');

  mod.recordWarning(entry, 'slow');
  check(entry.warningCount === 1, 'Warning count incremented');

  mod.updateMetrics(entry, { latencyMs: 200, requests: 10 });
  check(entry.metrics.latencyMs === 200, 'Metrics updated');

  check(mod.isHealthy(entry) === false, 'Degraded entry is not healthy');

  const unhealthyEntry = mod.createConnectorHealthEntry('bad', 'unhealthy');
  check(mod.isUnhealthy(unhealthyEntry) === true, 'Unhealthy entry detected');
  check(mod.shouldRetry(unhealthyEntry) === true || mod.shouldRetry(entry) === true, 'shouldRetry returns boolean');

  const summary = mod.getHealthSummary(entry);
  check(typeof summary === 'object', 'getHealthSummary returns object');

  const stats = mod.aggregateConnectorHealthStats([entry, unhealthyEntry]);
  check(typeof stats === 'object', 'aggregateConnectorHealthStats returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-health-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Health Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

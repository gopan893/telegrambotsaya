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

  const mod = require(path.join(ROOT, 'src/devices/device-health-monitor'));

  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.recordError === 'function', 'recordError is a function');
  check(typeof mod.checkDeviceHealth === 'function', 'checkDeviceHealth is a function');
  check(typeof mod.detectStaleDevices === 'function', 'detectStaleDevices is a function');
  check(typeof mod.getHealthSummary === 'function', 'getHealthSummary is a function');
  check(typeof mod.aggregateHealthStats === 'function', 'aggregateHealthStats is a function');

  const entry = mod.recordHealthCheck('test-dev', 'healthy', 'ok');
  check(entry.status === 'healthy', 'Record health check works');

  const summary = mod.getHealthSummary('test-dev');
  check(typeof summary === 'object', 'getHealthSummary returns object');

  const stats = mod.aggregateHealthStats();
  check(typeof stats === 'object' && typeof stats.total === 'number', 'aggregateHealthStats returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-health-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Health Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  console.log('=== Post-V2 Performance Watchdog ===\n');

  const pw = require(path.join(ROOT, 'src/post-v2/post-v2-performance-watchdog'));

  const score = pw.checkPostV2PerformanceScore({});
  check(typeof score.score === 'number', 'checkPostV2PerformanceScore returns score number');
  check(score.score >= 0 && score.score <= 100, 'checkPostV2PerformanceScore score in range');
  check(typeof score.level === 'string', 'checkPostV2PerformanceScore returns level');

  const report = pw.buildPerformanceWatchdogReport({});
  check(report.module === 'performance', 'buildPerformanceWatchdogReport returns module name');
  check(typeof report.passed === 'boolean', 'buildPerformanceWatchdogReport returns passed');
  check(typeof report.score === 'number', 'buildPerformanceWatchdogReport returns score');

  console.log('\n=== Performance Watchdog: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

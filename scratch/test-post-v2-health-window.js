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

  console.log('=== Post-V2 Health Window ===\n');

  const store = require(path.join(ROOT, 'src/post-v2/post-v2-watch-store'));
  const hw = require(path.join(ROOT, 'src/post-v2/post-v2-health-window'));

  store.clearAll();

  const watch = store.createPostV2Watch({ version: 'v2.0.1' });

  const window = hw.createPostV2HealthWindow(watch.id, { durationMinutes: 60 }, {});
  check(!!window && !!window.id, 'createPostV2HealthWindow returns window');
  check(window.status === 'open', 'createPostV2HealthWindow status is open');
  check(window.durationMinutes === 60, 'createPostV2HealthWindow respects durationMinutes');

  const evalResult = hw.evaluatePostV2HealthWindow(watch.id, {});
  check(evalResult.passed === true, 'evaluatePostV2HealthWindow returns passed');
  check(Array.isArray(evalResult.checks), 'evaluatePostV2HealthWindow returns checks array');
  check(evalResult.checks.length > 0, 'evaluatePostV2HealthWindow has checks');

  const summary = hw.buildHealthWindowSummary(watch.id, {});
  check(summary.id === window.id, 'buildHealthWindowSummary returns summary');
  check(summary.status === 'open', 'buildHealthWindowSummary returns correct status');

  store.clearAll();

  console.log('\n=== Health Window: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

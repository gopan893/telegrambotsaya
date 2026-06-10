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

  console.log('=== Post-V2 Watch Manager ===\n');

  const store = require(path.join(ROOT, 'src/post-v2/post-v2-watch-store'));
  const mgr = require(path.join(ROOT, 'src/post-v2/post-v2-watch-manager'));

  store.clearAll();

  const watch = await mgr.startPostV2Watch({ version: 'v2.0.1' }, {});
  check(!!watch && !!watch.id, 'startPostV2Watch returns watch with id');
  check(watch.version === 'v2.0.1', 'startPostV2Watch preserves version');

  const status = await mgr.getPostV2WatchStatus(watch.id, {});
  check(status.exists === true, 'getPostV2WatchStatus returns status');
  check(status.id === watch.id, 'getPostV2WatchStatus returns correct id');

  const cycle = await mgr.runPostV2WatchCycle(watch.id, {});
  check(cycle.ok === true, 'runPostV2WatchCycle runs successfully');
  check(cycle.id === watch.id, 'runPostV2WatchCycle returns watch id');

  const report = await mgr.buildPostV2WatchReport(watch.id, {});
  check(report.id === watch.id, 'buildPostV2WatchReport returns report');
  check(report.generatedAt !== undefined, 'buildPostV2WatchReport has generatedAt');

  store.clearAll();

  console.log('\n=== Watch Manager: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

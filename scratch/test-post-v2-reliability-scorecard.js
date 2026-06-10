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

  console.log('=== Post-V2 Reliability Scorecard ===\n');

  const store = require(path.join(ROOT, 'src/post-v2/post-v2-watch-store'));
  const sc = require(path.join(ROOT, 'src/post-v2/post-v2-reliability-scorecard'));

  store.clearAll();
  const watch = store.createPostV2Watch({ version: 'v2.0.1' });

  const score = sc.calculatePostV2ReliabilityScore(watch.id, {});
  check(typeof score.overallScore === 'number', 'calculatePostV2ReliabilityScore returns overallScore');
  check(typeof score.subscores === 'object', 'calculatePostV2ReliabilityScore returns subscores');
  check(score.overallScore >= 0 && score.overallScore <= 100, 'calculatePostV2ReliabilityScore overallScore in range');

  const dashScore = sc.calculateDashboardReliabilityScore(watch.id, {});
  check(typeof dashScore === 'number', 'calculateDashboardReliabilityScore returns number');
  check(dashScore >= 0 && dashScore <= 100, 'calculateDashboardReliabilityScore in range');

  const apiScore = sc.calculateApiReliabilityScore(watch.id, {});
  check(typeof apiScore === 'number', 'calculateApiReliabilityScore returns number');
  check(apiScore >= 0 && apiScore <= 100, 'calculateApiReliabilityScore in range');

  const card = sc.buildPostV2ReliabilityScorecard(watch.id, {});
  check(card.watchId === watch.id, 'buildPostV2ReliabilityScorecard returns watchId');
  check(typeof card.overall === 'number', 'buildPostV2ReliabilityScorecard returns overall');
  check(card.summary.includes('Overall reliability'), 'buildPostV2ReliabilityScorecard has summary');

  store.clearAll();

  console.log('\n=== Reliability Scorecard: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

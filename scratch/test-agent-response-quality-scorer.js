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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-response-quality-scorer'));

  check(typeof mod.scoreResponseQuality === 'function', 'scoreResponseQuality is a function');
  check(typeof mod.scoreCompleteness === 'function', 'scoreCompleteness is a function');
  check(typeof mod.scoreAccuracy === 'function', 'scoreAccuracy is a function');
  check(typeof mod.scoreSafety === 'function', 'scoreSafety is a function');
  check(typeof mod.scoreRelevance === 'function', 'scoreRelevance is a function');
  check(typeof mod.scoreClarity === 'function', 'scoreClarity is a function');
  check(typeof mod.aggregateQualityScores === 'function', 'aggregateQualityScores is a function');

  const response = { text: 'The solution is to update the Docker configuration.' };
  const task = { id: 'task-1', description: 'Fix Docker deployment', type: 'coding' };
  const score = mod.scoreResponseQuality(response, task);
  check(typeof score === 'object', 'scoreResponseQuality returns object');
  check(typeof score.overall === 'number', 'Has overall score');
  check(score.overall >= 0 && score.overall <= 1, 'Overall score in [0,1]');
  check(typeof score.completeness === 'number', 'Has completeness');
  check(typeof score.safety === 'number', 'Has safety');

  const emptyScore = mod.scoreResponseQuality({}, {});
  check(emptyScore.overall >= 0, 'Empty response scores 0+');

  const completeness = mod.scoreCompleteness(response, task);
  check(typeof completeness === 'number', 'scoreCompleteness returns number');

  const safety = mod.scoreSafety(response, task);
  check(typeof safety === 'number', 'scoreSafety returns number');

  const aggregated = mod.aggregateQualityScores([score, emptyScore]);
  check(typeof aggregated === 'object', 'aggregateQualityScores returns object');
  check(typeof aggregated.avgOverall === 'number', 'Has avgOverall');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-response-quality-scorer.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Response Quality Scorer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

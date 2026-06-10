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

  const mod = require(path.join(ROOT, 'src/rag-quality/source-freshness-scorer'));

  check(typeof mod.scoreSourceFreshness === 'function', 'scoreSourceFreshness is a function');
  check(typeof mod.detectStaleSources === 'function', 'detectStaleSources is a function');
  check(typeof mod.scoreBatch === 'function', 'scoreBatch is a function');
  check(typeof mod.getFreshnessSummary === 'function', 'getFreshnessSummary is a function');

  const freshSource = { updatedAt: new Date().toISOString() };
  const freshScore = mod.scoreSourceFreshness(freshSource);
  check(freshScore.freshness === 'fresh' || freshScore.score > 0.7, 'Recently updated source is fresh');

  const oldSource = { updatedAt: '2020-01-01T00:00:00Z' };
  const oldScore = mod.scoreSourceFreshness(oldSource);
  check(oldScore.score < 0.7, 'Old source scores low');

  const nullScore = mod.scoreSourceFreshness(null);
  check(nullScore.score === 0, 'Null source scores 0');

  const noDateSource = { content: 'test' };
  const noDateScore = mod.scoreSourceFreshness(noDateSource);
  check(noDateScore.reasons.includes('no_date_found') || noDateScore.freshness === 'unknown', 'No date detected');

  const staleSources = mod.detectStaleSources([oldSource, freshSource], 30);
  check(Array.isArray(staleSources), 'detectStaleSources returns array');

  const batch = mod.scoreBatch([freshSource, oldSource]);
  check(Array.isArray(batch) && batch.length === 2, 'scoreBatch returns correct count');

  const summary = mod.getFreshnessSummary([freshSource, oldSource]);
  check(typeof summary === 'object', 'getFreshnessSummary returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/source-freshness-scorer.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Source Freshness Scorer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

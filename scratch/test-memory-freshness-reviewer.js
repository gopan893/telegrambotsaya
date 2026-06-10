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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-freshness-reviewer'));

  check(typeof mod.reviewMemoryFreshness === 'function', 'reviewMemoryFreshness is a function');
  check(typeof mod.reviewBatch === 'function', 'reviewBatch is a function');
  check(typeof mod.getFreshnessSummary === 'function', 'getFreshnessSummary is a function');

  const freshMemory = { id: 'm1', content: 'test', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  const freshResult = mod.reviewMemoryFreshness(freshMemory);
  check(freshResult.freshness === 'fresh' || freshResult.score > 0.7, 'Recent memory is fresh');

  const oldMemory = { id: 'm2', content: 'old', updatedAt: '2020-01-01T00:00:00Z', createdAt: '2020-01-01T00:00:00Z' };
  const oldResult = mod.reviewMemoryFreshness(oldMemory);
  check(oldResult.score < 0.7, 'Old memory scores low');

  const nullResult = mod.reviewMemoryFreshness(null);
  check(nullResult.freshness === 'unknown', 'Null memory returns unknown');

  const batch = mod.reviewBatch([freshMemory, oldMemory]);
  check(Array.isArray(batch), 'reviewBatch returns array');

  const summary = mod.getFreshnessSummary([freshMemory, oldMemory]);
  check(typeof summary === 'object', 'getFreshnessSummary returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-freshness-reviewer.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Freshness Reviewer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

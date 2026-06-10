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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-latency-tracker'));

  check(typeof mod.recordLatency === 'function', 'recordLatency is a function');
  check(typeof mod.getLatencyStats === 'function', 'getLatencyStats is a function');
  check(typeof mod.getModelLatencyRanking === 'function', 'getModelLatencyRanking is a function');
  check(typeof mod.isLatencyAcceptable === 'function', 'isLatencyAcceptable is a function');

  const record = await mod.recordLatency('gpt-4o', 'openai', 1500);
  check(typeof record === 'object', 'recordLatency returns object');
  check(record.model === 'gpt-4o', 'Record has model');
  check(record.latencyMs === 1500, 'Record has latency');

  check(mod.isLatencyAcceptable(1000, 'gpt-4o').acceptable === true, '1000ms is acceptable');
  check(mod.isLatencyAcceptable(60000, 'gpt-4o').acceptable === false, '60000ms is not acceptable');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-latency-tracker.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Latency Tracker: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

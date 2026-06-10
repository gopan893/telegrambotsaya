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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-duplicate-detector'));

  check(typeof mod.detectDuplicateMemories === 'function', 'detectDuplicateMemories is a function');
  check(typeof mod.calculateSimilarity === 'function', 'calculateSimilarity is a function');
  check(typeof mod.generateDuplicateReport === 'function', 'generateDuplicateReport is a function');

  const mem1 = { id: 'm1', content: 'How to deploy Node.js applications to production' };
  const mem2 = { id: 'm2', content: 'How to deploy Node.js applications to production server' };
  const mem3 = { id: 'm3', content: 'The weather is nice today' };

  const dupResult = mod.detectDuplicateMemories([mem1, mem2, mem3]);
  check(typeof dupResult === 'object', 'detectDuplicateMemories returns object');
  check(typeof dupResult.pairCount === 'number', 'Has pairCount');

  const nullResult = mod.detectDuplicateMemories(null);
  check(nullResult.duplicates.length === 0, 'Null memories returns empty');

  const singleResult = mod.detectDuplicateMemories([mem1]);
  check(singleResult.duplicates.length === 0, 'Single memory returns empty');

  const sim = mod.calculateSimilarity(mem1, mem2);
  check(typeof sim === 'number', 'calculateSimilarity returns number');
  check(sim >= 0 && sim <= 1, 'Similarity in [0,1]');

  const diffSim = mod.calculateSimilarity(mem1, mem3);
  check(diffSim < sim, 'Different content has lower similarity');

  const report = mod.generateDuplicateReport(dupResult);
  check(typeof report === 'object', 'generateDuplicateReport returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-duplicate-detector.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Duplicate Detector: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

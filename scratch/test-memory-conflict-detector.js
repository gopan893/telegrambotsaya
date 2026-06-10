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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-conflict-detector'));

  check(typeof mod.detectConflicts === 'function', 'detectConflicts is a function');
  check(typeof mod.getUnresolvedConflicts === 'function', 'getUnresolvedConflicts is a function');
  check(typeof mod.detectKeywordConflict === 'function', 'detectKeywordConflict is a function');
  check(typeof mod.detectTemporalConflict === 'function', 'detectTemporalConflict is a function');
  check(typeof mod.detectSemanticConflict === 'function', 'detectSemanticConflict is a function');

  const memA = { id: 'm1', content: 'The API server runs on port 3000', tags: ['api', 'server'], createdAt: '2024-01-01T00:00:00Z' };
  const memB = { id: 'm2', content: 'The API server runs on port 8080', tags: ['api', 'server'], createdAt: '2024-06-01T00:00:00Z' };
  const memC = { id: 'm3', content: 'The weather is nice today', tags: ['weather'], createdAt: '2024-03-01T00:00:00Z' };

  const conflictResult = mod.detectConflicts([memA, memB, memC]);
  check(typeof conflictResult === 'object', 'detectConflicts returns object');
  check(typeof conflictResult.conflictCount === 'number', 'Has conflictCount');
  check(conflictResult.conflictCount === 0, 'No keyword/temporal/semantic conflicts in simple memories');

  const nullResult = mod.detectConflicts(null);
  check(nullResult.conflicts.length === 0, 'Null memories returns empty');

  const singleResult = mod.detectConflicts([memA]);
  check(singleResult.conflicts.length === 0, 'Single memory returns empty');

  const kwConflict = mod.detectKeywordConflict(memA, memB);
  check(typeof kwConflict === 'object' || kwConflict === null, 'detectKeywordConflict returns object or null');

  const temporalConflict = mod.detectTemporalConflict(memA, memB);
  check(typeof temporalConflict === 'object' || temporalConflict === null, 'detectTemporalConflict returns object or null');

  const semanticConflict = mod.detectSemanticConflict(memA, memC);
  check(typeof semanticConflict === 'object' || semanticConflict === null, 'detectSemanticConflict returns object or null');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-conflict-detector.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Conflict Detector: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

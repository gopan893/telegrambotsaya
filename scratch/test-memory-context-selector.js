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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-context-selector'));

  check(typeof mod.selectRelevantMemories === 'function', 'selectRelevantMemories is a function');
  check(typeof mod.scoreMemoryRelevance === 'function', 'scoreMemoryRelevance is a function');

  const memories = [
    { id: 'm1', content: 'Deploy Node.js app to production using Docker', tags: ['deploy', 'docker', 'nodejs'], updatedAt: new Date().toISOString() },
    { id: 'm2', content: 'How to set up Redis caching', tags: ['redis', 'caching'], updatedAt: new Date().toISOString() },
    { id: 'm3', content: 'API authentication with JWT tokens', tags: ['auth', 'jwt', 'api'], updatedAt: '2023-01-01T00:00:00Z' }
  ];

  const result = mod.selectRelevantMemories('deploy nodejs', memories);
  check(typeof result === 'object', 'selectRelevantMemories returns object');
  check(Array.isArray(result.selected), 'Has selected array');
  check(result.selected.length > 0, 'Selects relevant memories');

  const nullResult = mod.selectRelevantMemories(null, memories);
  check(nullResult.selected.length === 0, 'Null query returns empty');

  const emptyResult = mod.selectRelevantMemories('test', []);
  check(emptyResult.selected.length === 0, 'Empty memories returns empty');

  const score = mod.scoreMemoryRelevance(memories[0], 'deploy nodejs');
  check(typeof score === 'number', 'scoreMemoryRelevance returns number');
  check(score > 0, 'Relevant memory scores positive');

  const lowScore = mod.scoreMemoryRelevance(memories[2], 'deploy nodejs');
  check(score > lowScore, 'More relevant memory scores higher');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-context-selector.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Context Selector: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

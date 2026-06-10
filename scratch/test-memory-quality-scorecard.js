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

  const mod = require(path.join(ROOT, 'src/memory-intelligence/memory-quality-scorecard'));

  check(typeof mod.calculateQualityScorecard === 'function', 'calculateQualityScorecard is a function');
  check(typeof mod.scoreToGrade === 'function', 'scoreToGrade is a function');

  const memories = [
    { id: 'm1', content: 'Deploy instructions', tags: ['deploy'], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), lastAccessedAt: new Date().toISOString() },
    { id: 'm2', content: 'API docs', tags: ['api', 'docs'], updatedAt: '2024-01-01T00:00:00Z', createdAt: '2024-01-01T00:00:00Z' },
    { id: 'm3', content: 'Meeting notes', tags: ['meeting'], updatedAt: '2023-06-01T00:00:00Z', createdAt: '2023-06-01T00:00:00Z' }
  ];

  const scorecard = mod.calculateQualityScorecard(memories);
  check(typeof scorecard === 'object', 'calculateQualityScorecard returns object');
  check(typeof scorecard.overallScore === 'number', 'Has overall score');
  check(scorecard.overallScore >= 0 && scorecard.overallScore <= 1, 'Overall score in [0,1]');
  check(typeof scorecard.grade === 'string', 'Has grade');

  const emptyScorecard = mod.calculateQualityScorecard([]);
  check(emptyScorecard.overallScore === 0, 'Empty memories scores 0');

  check(mod.scoreToGrade(0.95) === 'A', 'High score is A');
  check(mod.scoreToGrade(0.5) !== 'A', 'Mid score is not A');
  check(typeof mod.scoreToGrade(0) === 'string', 'Zero score has grade');

  const content = fs.readFileSync(path.join(ROOT, 'src/memory-intelligence/memory-quality-scorecard.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Memory Quality Scorecard: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

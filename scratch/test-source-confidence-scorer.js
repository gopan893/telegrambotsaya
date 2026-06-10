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

  const mod = require(path.join(ROOT, 'src/rag-quality/source-confidence-scorer'));

  check(typeof mod.scoreSourceConfidence === 'function', 'scoreSourceConfidence is a function');
  check(typeof mod.scoreBatch === 'function', 'scoreBatch is a function');
  check(typeof mod.getConfidenceSummary === 'function', 'getConfidenceSummary is a function');
  check(typeof mod.hasTrustSignal === 'function', 'hasTrustSignal is a function');

  const highSource = { authority: 'official_docs', author: 'Team', date: '2024-01-01', url: 'https://docs.example.com', citations: ['ref1'], tested: true };
  const highScore = mod.scoreSourceConfidence(highSource);
  check(highScore.score > 0.5, 'Official docs source scores high');
  check(typeof highScore.confidence === 'string', 'Has confidence label');

  const lowSource = { type: 'unknown' };
  const lowScore = mod.scoreSourceConfidence(lowSource);
  check(lowScore.score < 0.5, 'Unknown source scores low');

  const nullScore = mod.scoreSourceConfidence(null);
  check(nullScore.score === 0, 'Null source scores 0');

  const batch = mod.scoreBatch([highSource, lowSource]);
  check(Array.isArray(batch), 'scoreBatch returns array');
  check(batch.length === 2, 'Batch has 2 results');

  const summary = mod.getConfidenceSummary([highSource, lowSource]);
  check(typeof summary === 'object', 'getConfidenceSummary returns object');

  check(mod.hasTrustSignal(highSource, 'hasAuthor') === true, 'Trust signal detected');
  check(mod.hasTrustSignal(lowSource, 'hasAuthor') === false, 'No trust signal');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/source-confidence-scorer.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Source Confidence Scorer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

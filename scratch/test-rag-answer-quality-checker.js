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

  const mod = require(path.join(ROOT, 'src/rag-quality/rag-answer-quality-checker'));

  check(typeof mod.checkAnswerQuality === 'function', 'checkAnswerQuality is a function');
  check(typeof mod.checkBatch === 'function', 'checkBatch is a function');
  check(typeof mod.checkGroundedness === 'function', 'checkGroundedness is a function');
  check(typeof mod.checkRelevance === 'function', 'checkRelevance is a function');
  check(typeof mod.checkSafety === 'function', 'checkSafety is a function');
  check(typeof mod.checkCitations === 'function', 'checkCitations is a function');
  check(typeof mod.checkNoSecrets === 'function', 'checkNoSecrets is a function');

  const sources = [{ content: 'Node.js is a JavaScript runtime built on Chrome V8' }];
  const answer = 'Node.js is a JavaScript runtime built on Chrome V8 engine.';
  const quality = mod.checkAnswerQuality(answer, sources, 'what is nodejs');
  check(typeof quality === 'object', 'checkAnswerQuality returns object');
  check(typeof quality.overallScore === 'number', 'Has overall score');
  check(quality.overallScore >= 0 && quality.overallScore <= 1, 'Overall score in [0,1]');

  const nullQuality = mod.checkAnswerQuality(null, [], 'test');
  check(nullQuality.overallScore === 0, 'Null answer scores 0');

  const grounded = mod.checkGroundedness(answer, sources);
  check(typeof grounded === 'object', 'checkGroundedness returns object');
  check(typeof grounded.passed === 'boolean', 'Has passed field');

  const relevant = mod.checkRelevance(answer, 'nodejs runtime');
  check(typeof relevant === 'object', 'checkRelevance returns object');

  const safe = mod.checkSafety(answer, sources);
  check(typeof safe === 'object', 'checkSafety returns object');

  const secretCheck = mod.checkNoSecrets(answer);
  check(secretCheck.passed === true, 'No secrets in answer');

  const secretAnswer = mod.checkNoSecrets('API_KEY=abc123def456ghi789jkl012mno');
  check(secretAnswer.passed === false, 'Secret in answer detected');

  const batch = mod.checkBatch([{ answer, sources, query: 'test' }]);
  check(Array.isArray(batch), 'checkBatch returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/rag-answer-quality-checker.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- RAG Answer Quality Checker: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

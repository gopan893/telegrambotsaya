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

  const mod = require(path.join(ROOT, 'src/rag-quality/retrieval-quality-evaluator'));

  check(typeof mod.evaluateRetrievalQuality === 'function', 'evaluateRetrievalQuality is a function');
  check(typeof mod.evaluateRelevance === 'function', 'evaluateRelevance is a function');
  check(typeof mod.evaluateFreshness === 'function', 'evaluateFreshness is a function');
  check(typeof mod.evaluateDiversity === 'function', 'evaluateDiversity is a function');
  check(typeof mod.evaluateTrust === 'function', 'evaluateTrust is a function');
  check(typeof mod.evaluateSensitivity === 'function', 'evaluateSensitivity is a function');

  const results = [
    { content: 'How to deploy a Node.js app', score: 0.9, source: { type: 'official_docs', updatedAt: new Date().toISOString() } },
    { content: 'Node.js deployment guide', score: 0.8, source: { type: 'project_source', updatedAt: new Date().toISOString() } }
  ];
  const evalResult = mod.evaluateRetrievalQuality(results, 'deploy nodejs');
  check(typeof evalResult === 'object', 'evaluateRetrievalQuality returns object');
  check(typeof evalResult.overall === 'number', 'Has overall score');
  check(evalResult.overall >= 0 && evalResult.overall <= 1, 'Overall score in [0,1]');

  const emptyResult = mod.evaluateRetrievalQuality([], 'test');
  check(emptyResult.overall === 0, 'Empty results score 0');

  const relevance = mod.evaluateRelevance(results, 'deploy');
  check(typeof relevance === 'object', 'evaluateRelevance returns object');
  check(typeof relevance.score === 'number', 'Relevance has score');

  const freshness = mod.evaluateFreshness(results);
  check(typeof freshness === 'object', 'evaluateFreshness returns object');

  const diversity = mod.evaluateDiversity(results);
  check(typeof diversity === 'object', 'evaluateDiversity returns object');

  const trust = mod.evaluateTrust(results);
  check(typeof trust === 'object', 'evaluateTrust returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/retrieval-quality-evaluator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Retrieval Quality Evaluator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

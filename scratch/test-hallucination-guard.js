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

  const mod = require(path.join(ROOT, 'src/rag-quality/hallucination-guard'));

  check(typeof mod.detectHallucination === 'function', 'detectHallucination is a function');
  check(typeof mod.extractClaims === 'function', 'extractClaims is a function');
  check(typeof mod.evaluateClaimSupport === 'function', 'evaluateClaimSupport is a function');
  check(typeof mod.enforceUncertainty === 'function', 'enforceUncertainty is a function');

  const sources = [{ content: 'Node.js is a JavaScript runtime built on Chrome V8' }];
  const answer = 'Node.js is a JavaScript runtime built on Chrome V8 engine.';
  const result = mod.detectHallucination(answer, sources, 'what is nodejs');
  check(typeof result === 'object', 'detectHallucination returns object');
  check(typeof result.confidence === 'number', 'Has confidence score');
  check(typeof result.recommendation === 'string', 'Has recommendation');

  const hallucinatedAnswer = 'The Eiffel Tower is 5000 meters tall and was built in 1850.';
  const hallResult = mod.detectHallucination(hallucinatedAnswer, sources, 'eiffel tower');
  check(hallResult.confidence < 0.8 || hallResult.unsupportedClaims.length > 0, 'Hallucinated content detected');

  const claims = mod.extractClaims(answer);
  check(Array.isArray(claims), 'extractClaims returns array');
  check(claims.length > 0, 'Claims extracted from answer');

  const claimSupport = mod.evaluateClaimSupport(claims[0], sources, 'nodejs');
  check(typeof claimSupport === 'object', 'evaluateClaimSupport returns object');

  const enforced = mod.enforceUncertainty(answer, { confidence: 0.3, recommendation: 'add_uncertainty' });
  check(typeof enforced === 'string' || typeof enforced === 'object', 'enforceUncertainty returns result');

  const content = fs.readFileSync(path.join(ROOT, 'src/rag-quality/hallucination-guard.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Hallucination Guard: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

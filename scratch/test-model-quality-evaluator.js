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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-quality-evaluator'));

  check(typeof mod.evaluateModelQuality === 'function', 'evaluateModelQuality is a function');
  check(typeof mod.evaluateAccuracy === 'function', 'evaluateAccuracy is a function');
  check(typeof mod.evaluateCompleteness === 'function', 'evaluateCompleteness is a function');
  check(typeof mod.evaluateRelevance === 'function', 'evaluateRelevance is a function');
  check(typeof mod.evaluateSafety === 'function', 'evaluateSafety is a function');

  const modelResult = { text: 'Node.js is a JavaScript runtime built on Chrome V8 engine.', model: 'gpt-4o' };
  const task = { class: 'coding', description: 'What is Node.js?' };

  const evalResult = mod.evaluateModelQuality(modelResult, task);
  check(typeof evalResult === 'object', 'evaluateModelQuality returns object');
  check(typeof evalResult.overall === 'number', 'Has overall score');
  check(evalResult.overall >= 0 && evalResult.overall <= 1, 'Overall score in [0,1]');
  check(typeof evalResult.safety === 'number', 'Has safety score');

  const emptyResult = mod.evaluateModelQuality({}, {});
  check(emptyResult.overall >= 0, 'Empty result scores 0+');

  const accuracy = mod.evaluateAccuracy(modelResult.text, task);
  check(typeof accuracy === 'number', 'evaluateAccuracy returns number');

  const safety = mod.evaluateSafety('This is safe content');
  check(safety > 0.5, 'Safe content scores high');

  const unsafeSafety = mod.evaluateSafety('API_KEY=abc123def456ghi789jkl012mno');
  check(unsafeSafety < safety, 'Unsafe content scores lower');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-quality-evaluator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Quality Evaluator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

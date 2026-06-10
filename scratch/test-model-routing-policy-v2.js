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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-routing-policy-v2'));

  check(typeof mod.buildRoutingDecision === 'function', 'buildRoutingDecision is a function');
  check(typeof mod.selectBestCandidate === 'function', 'selectBestCandidate is a function');
  check(typeof mod.findFallbackRoute === 'function', 'findFallbackRoute is a function');
  check(typeof mod.buildFallbackPlan === 'function', 'buildFallbackPlan is a function');

  const task = { class: 'coding', sensitivity: 'low', description: 'Fix a bug' };
  const candidates = [
    { id: 'gpt-4o', type: 'cloud', model: 'gpt-4o', provider: 'openai' },
    { id: 'local-default', type: 'local', model: 'local-default', provider: 'local' }
  ];
  const strategy = { strategy: 'quality', costWeight: 0.2, qualityWeight: 0.8 };

  const decision = mod.buildRoutingDecision(task, strategy, candidates);
  check(typeof decision === 'object', 'buildRoutingDecision returns object');
  check(typeof decision.provider === 'string', 'Has provider');
  check(typeof decision.model === 'string', 'Has model');

  const best = mod.selectBestCandidate(candidates, strategy, task);
  check(typeof best === 'object', 'selectBestCandidate returns object');

  const fallback = mod.findFallbackRoute(candidates, strategy, task);
  check(typeof fallback === 'object' || fallback === null, 'findFallbackRoute returns object or null');

  const fallbackPlan = mod.buildFallbackPlan(candidates, strategy, task);
  check(typeof fallbackPlan === 'object', 'buildFallbackPlan returns object');

  const privateTask = { class: 'private_lifeos', sensitivity: 'high' };
  const privateDecision = mod.buildRoutingDecision(privateTask, strategy, candidates);
  check(typeof privateDecision === 'object', 'Private task routing returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-routing-policy-v2.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Routing Policy V2: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

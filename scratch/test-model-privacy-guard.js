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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-privacy-guard'));

  check(typeof mod.blockUnsafeRoute === 'function', 'blockUnsafeRoute is a function');
  check(typeof mod.redactInput === 'function', 'redactInput is a function');
  check(typeof mod.blockRawSecrets === 'function', 'blockRawSecrets is a function');
  check(typeof mod.validateRouteForPrivacy === 'function', 'validateRouteForPrivacy is a function');
  check(typeof mod.shouldBlockRoute === 'function', 'shouldBlockRoute is a function');

  const route = { type: 'cloud', provider: 'openai' };
  const task = { sensitivity: 'high', class: 'private_lifeos' };
  const blocked = mod.blockUnsafeRoute(route, task);
  check(blocked.blocked === true, 'High sensitivity cloud route blocked');

  const localRoute = { type: 'local', provider: 'local' };
  const localResult = mod.blockUnsafeRoute(localRoute, task);
  check(localResult.blocked === false, 'Local route not blocked');

  const safeRoute = mod.blockUnsafeRoute({ type: 'cloud' }, { sensitivity: 'low' });
  check(safeRoute.blocked === false, 'Low sensitivity cloud route not blocked');

  const redacted = mod.redactInput('API_KEY=abc123def456ghi789jkl012mno');
  check(!redacted.includes('API_KEY'), 'Secrets redacted from input');
  check(redacted.includes('[REDACTED]') || redacted.includes('****'), 'Redaction marker present');

  const secretBlock = mod.blockRawSecrets('Here is my API_KEY=secret123token456');
  check(secretBlock.blocked === true, 'Raw secrets blocked');

  const safeContent = mod.blockRawSecrets('Normal content');
  check(safeContent.blocked === false, 'Safe content not blocked');

  const privacyCheck = mod.validateRouteForPrivacy(route, task);
  check(typeof privacyCheck === 'object', 'validateRouteForPrivacy returns object');

  const shouldBlock = mod.shouldBlockRoute(task, route);
  check(typeof shouldBlock === 'object', 'shouldBlockRoute returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-privacy-guard.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN='), 'No TELEGRAM_TOKEN assignment in source');
  check(!content.includes('GITHUB_TOKEN='), 'No GITHUB_TOKEN assignment in source');

  console.log('\n--- Model Privacy Guard: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-message-contract'));

  check(typeof mod.validateMessage === 'function', 'validateMessage is a function');
  check(typeof mod.createMessage === 'function', 'createMessage is a function');
  check(typeof mod.sanitizeMessage === 'function', 'sanitizeMessage is a function');
  check(typeof mod.isMessageFresh === 'function', 'isMessageFresh is a function');

  const invalid = mod.validateMessage(null);
  check(invalid.valid === false, 'Null message fails validation');

  const noType = mod.validateMessage({ nodeId: 'n1', timestamp: new Date().toISOString() });
  check(noType.valid === false, 'Missing type fails validation');

  const result = mod.createMessage({ type: 'heartbeat', nodeId: 'n1' });
  check(result.ok === true, 'createMessage succeeds');

  const sanitized = mod.sanitizeMessage({ type: 'test', payload: { token: 'abc', data: 'ok' } });
  check(sanitized.payload.token === undefined, 'Token removed by sanitize');
  check(sanitized.payload.data === 'ok', 'Data preserved by sanitize');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-message-contract.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Message Contract: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

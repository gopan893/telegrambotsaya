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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-handshake'));

  check(typeof mod.generateChallenge === 'function', 'generateChallenge is a function');
  check(typeof mod.createHandshakeRequest === 'function', 'createHandshakeRequest is a function');
  check(typeof mod.validateHandshakeResponse === 'function', 'validateHandshakeResponse is a function');
  check(typeof mod.completeHandshake === 'function', 'completeHandshake is a function');

  const challenge = mod.generateChallenge();
  check(typeof challenge === 'string' && challenge.length > 0, 'generateChallenge returns string');

  const noNode = mod.createHandshakeRequest({});
  check(noNode.ok === false, 'Missing nodeId rejected');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-handshake.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Handshake: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

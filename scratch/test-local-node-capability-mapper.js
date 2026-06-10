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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-capability-mapper'));

  check(typeof mod.mapCapabilitiesForNode === 'function', 'mapCapabilitiesForNode is a function');
  check(typeof mod.getNodeTypeCapabilities === 'function', 'getNodeTypeCapabilities is a function');
  check(typeof mod.validateNodeCapabilities === 'function', 'validateNodeCapabilities is a function');
  check(typeof mod.listAllNodeCapabilities === 'function', 'listAllNodeCapabilities is a function');

  const caps = mod.getNodeTypeCapabilities('termux');
  check(Array.isArray(caps) && caps.length > 0, 'getNodeTypeCapabilities returns array');

  const list = mod.listAllNodeCapabilities();
  check(Array.isArray(list), 'listAllNodeCapabilities returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-capability-mapper.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Capability Mapper: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-registry'));

  check(typeof mod.registerNode === 'function', 'registerNode is a function');
  check(typeof mod.getNode === 'function', 'getNode is a function');
  check(typeof mod.updateNode === 'function', 'updateNode is a function');
  check(typeof mod.removeNode === 'function', 'removeNode is a function');
  check(typeof mod.listNodes === 'function', 'listNodes is a function');

  const noParams = mod.registerNode({});
  check(noParams.ok === false, 'Missing params rejected');

  const result = mod.registerNode({ id: 'node1', type: 'termux', name: 'Test Node' });
  check(result.ok === true, 'Register node succeeds');

  const found = mod.getNode('node1');
  check(found !== null, 'getNode returns node');

  const list = mod.listNodes();
  check(Array.isArray(list) && list.length > 0, 'listNodes returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-registry.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Registry: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

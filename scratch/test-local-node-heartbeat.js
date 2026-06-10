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

  const mod = require(path.join(ROOT, 'src/local-nodes/local-node-heartbeat'));

  check(typeof mod.recordHeartbeat === 'function', 'recordHeartbeat is a function');
  check(typeof mod.getLastHeartbeat === 'function', 'getLastHeartbeat is a function');
  check(typeof mod.checkHeartbeatFreshness === 'function', 'checkHeartbeatFreshness is a function');
  check(typeof mod.listHeartbeats === 'function', 'listHeartbeats is a function');
  check(typeof mod.detectStaleNodes === 'function', 'detectStaleNodes is a function');

  const noNode = mod.recordHeartbeat('nonexistent', {});
  check(noNode.ok === false, 'Missing node rejected');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-nodes/local-node-heartbeat.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local Node Heartbeat: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

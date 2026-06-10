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

  const mod = require(path.join(ROOT, 'src/devices/device-proposal-bridge'));

  check(typeof mod.createProposal === 'function', 'createProposal is a function');
  check(typeof mod.approveProposal === 'function', 'approveProposal is a function');
  check(typeof mod.rejectProposal === 'function', 'rejectProposal is a function');
  check(typeof mod.listProposals === 'function', 'listProposals is a function');

  const noParams = mod.createProposal({});
  check(noParams.ok === false, 'Missing params rejected');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-proposal-bridge.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Proposal Bridge: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

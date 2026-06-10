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

  const mod = require(path.join(ROOT, 'src/local-integrations/nas-node-monitor'));

  check(typeof mod.registerNasNode === 'function', 'registerNasNode is a function');
  check(typeof mod.getNasNode === 'function', 'getNasNode is a function');
  check(typeof mod.listNasNodes === 'function', 'listNasNodes is a function');
  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.getMonitorStats === 'function', 'getMonitorStats is a function');

  const result = mod.registerNasNode({ id: 'nas1', name: 'Test NAS' });
  check(result.ok === true, 'Register NAS node succeeds');

  const status = mod.getMonitorStats();
  check(typeof status === 'object' && typeof status.total === 'number', 'getMonitorStats returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-integrations/nas-node-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- NAS Node Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/local-integrations/local-ai-node-monitor'));

  check(typeof mod.registerEndpoint === 'function', 'registerEndpoint is a function');
  check(typeof mod.getEndpoint === 'function', 'getEndpoint is a function');
  check(typeof mod.listEndpoints === 'function', 'listEndpoints is a function');
  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.getMonitorStats === 'function', 'getMonitorStats is a function');

  const result = mod.registerEndpoint({ id: 'ai1', name: 'Test AI', url: 'http://localhost:8080' });
  check(result.ok === true, 'Register AI node succeeds');

  const status = mod.getMonitorStats();
  check(typeof status === 'object' && typeof status.total === 'number', 'getMonitorStats returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-integrations/local-ai-node-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Local AI Node Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/local-integrations/tunnel-status-monitor'));

  check(typeof mod.registerTunnel === 'function', 'registerTunnel is a function');
  check(typeof mod.getTunnel === 'function', 'getTunnel is a function');
  check(typeof mod.listTunnels === 'function', 'listTunnels is a function');
  check(typeof mod.recordHealthCheck === 'function', 'recordHealthCheck is a function');
  check(typeof mod.getMonitorStats === 'function', 'getMonitorStats is a function');
  check(typeof mod.getTunnelStatus === 'function', 'getTunnelStatus is a function');

  const result = mod.registerTunnel({ id: 'tun1', name: 'Test Tunnel', url: 'https://tunnel.example.com' });
  check(result.ok === true, 'Register tunnel succeeds');

  const stats = mod.getMonitorStats();
  check(typeof stats === 'object' && typeof stats.total === 'number', 'getMonitorStats returns stats');

  const content = fs.readFileSync(path.join(ROOT, 'src/local-integrations/tunnel-status-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Tunnel Status Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

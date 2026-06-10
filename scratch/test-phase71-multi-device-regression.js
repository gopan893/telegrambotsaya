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

  const routeFile = path.join(ROOT, 'src/dashboard/devices-routes.js');
  check(fs.existsSync(routeFile), 'devices-routes.js exists');
  if (fs.existsSync(routeFile)) {
    const content = fs.readFileSync(routeFile, 'utf8');
    check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in devices-routes');
    check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in devices-routes');
    try { new Function(content); check(true, 'devices-routes.js passes syntax'); } catch (e) { check(false, 'devices-routes syntax: ' + e.message); }
  }

  const jsFile = path.join(ROOT, 'public/dashboard/devices.js');
  check(fs.existsSync(jsFile), 'devices.js exists');
  if (fs.existsSync(jsFile)) {
    const content = fs.readFileSync(jsFile, 'utf8');
    check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in devices.js');
    check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in devices.js');
  }

  const stateContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
  check(stateContent.includes("'devices'"), 'state.js has devices entry');
  check(!stateContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in state.js');

  const indexContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
  check(indexContent.includes('data-tab="devices"'), 'Sidebar has devices entry');

  const swContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
  check(swContent.includes('/dashboard/devices.js'), 'SW has devices.js');

  const srcModules = [
    'device-registry', 'device-manifest-validator', 'device-pairing-manager',
    'device-health-monitor', 'device-capability-registry', 'device-risk-classifier',
    'device-action-planner', 'device-action-simulator', 'device-proposal-bridge'
  ];
  for (const m of srcModules) {
    const fp = path.join(ROOT, 'src/devices/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' passes syntax'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  const localModules = [
    'local-node-registry', 'local-node-handshake', 'local-node-heartbeat',
    'local-node-health-checker', 'local-node-capability-mapper',
    'local-node-message-contract', 'local-node-safety-boundary'
  ];
  for (const m of localModules) {
    const fp = path.join(ROOT, 'src/local-nodes/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' passes syntax'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  const integrationModules = [
    'local-ai-node-monitor', 'nas-node-monitor', 'file-sync-status-checker', 'tunnel-status-monitor'
  ];
  for (const m of integrationModules) {
    const fp = path.join(ROOT, 'src/local-integrations/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' passes syntax'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  console.log('\n--- Phase 71 Multi-Device Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-lifecycle-manager'));

  check(typeof mod.createLifecycleEntry === 'function', 'createLifecycleEntry is a function');
  check(typeof mod.canTransition === 'function', 'canTransition is a function');
  check(typeof mod.transitionLifecycle === 'function', 'transitionLifecycle is a function');
  check(typeof mod.recordError === 'function', 'recordError is a function');
  check(typeof mod.forceTransition === 'function', 'forceTransition is a function');
  check(typeof mod.getLifecycleHistory === 'function', 'getLifecycleHistory is a function');
  check(typeof mod.isTerminalState === 'function', 'isTerminalState is a function');
  check(typeof mod.getActiveLifecycleEntries === 'function', 'getActiveLifecycleEntries is a function');
  check(typeof mod.getLifecycleStats === 'function', 'getLifecycleStats is a function');

  const entry = mod.createLifecycleEntry('test-plugin', 'discovered');
  check(entry.pluginId === 'test-plugin', 'Entry has pluginId');
  check(entry.state === 'discovered', 'Initial state is discovered');
  check(entry.enabled === false, 'Discovered plugin is not enabled');

  check(mod.canTransition('discovered', 'installed') === true, 'Can transition discovered->installed');
  check(mod.canTransition('discovered', 'enabled') === false, 'Cannot transition discovered->enabled');
  check(mod.canTransition('enabled', 'disabled') === true, 'Can transition enabled->disabled');

  const transitioned = mod.transitionLifecycle(entry, 'installed', 'manual install');
  check(transitioned.state === 'installed', 'Transition to installed');
  check(transitioned.previousState === 'discovered', 'Previous state is discovered');

  const enabled = mod.transitionLifecycle(transitioned, 'enabled', 'manual enable');
  check(enabled.state === 'enabled', 'Transition to enabled');
  check(enabled.enabled === true, 'Enabled flag is true');

  check(mod.isTerminalState('failed') === true, 'failed is terminal');
  check(mod.isTerminalState('enabled') === false, 'enabled is not terminal');

  const errorEntry = mod.recordError(enabled, 'test error');
  check(errorEntry.errorLog.length === 1, 'Error recorded');

  const entries = [entry, enabled];
  const active = mod.getActiveLifecycleEntries(entries);
  check(Array.isArray(active), 'getActiveLifecycleEntries returns array');

  const stats = mod.getLifecycleStats(entries);
  check(typeof stats === 'object', 'getLifecycleStats returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-lifecycle-manager.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Lifecycle Manager: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

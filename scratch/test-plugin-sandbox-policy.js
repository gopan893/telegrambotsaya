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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-sandbox-policy'));

  check(typeof mod.buildSandboxPolicy === 'function', 'buildSandboxPolicy is a function');
  check(typeof mod.enforceSandboxPolicy === 'function', 'enforceSandboxPolicy is a function');
  check(typeof mod.validateSandboxPolicy === 'function', 'validateSandboxPolicy is a function');
  check(typeof mod.summarizePolicy === 'function', 'summarizePolicy is a function');

  const manifest = { id: 'test-plugin', name: 'Test', version: '1.0.0', main: 'index.js' };
  const policy = mod.buildSandboxPolicy(manifest, ['read']);
  check(policy.pluginId === 'test-plugin', 'Policy has pluginId');
  check(Array.isArray(policy.blockedActions), 'Policy has blockedActions array');
  check(policy.blockedActions.includes('shell'), 'Shell is blocked by default');
  check(policy.maxMemoryMB === 64, 'Default maxMemoryMB is 64');
  check(policy.shell.enabled === false, 'Shell disabled by default');

  const enforced = mod.enforceSandboxPolicy(policy, { type: 'shell' });
  check(enforced.allowed === false, 'Shell action is blocked by policy');

  const readEnforced = mod.enforceSandboxPolicy(policy, { type: 'read' });
  check(readEnforced.allowed === true || readEnforced.blocked === false, 'Read action is allowed');

  const validation = mod.validateSandboxPolicy(policy);
  check(typeof validation === 'object', 'validateSandboxPolicy returns object');

  const summary = mod.summarizePolicy(policy);
  check(typeof summary === 'object', 'summarizePolicy returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-sandbox-policy.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Sandbox Policy: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

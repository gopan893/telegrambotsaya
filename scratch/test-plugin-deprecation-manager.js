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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-deprecation-manager'));

  check(typeof mod.createDeprecationNotice === 'function', 'createDeprecationNotice is a function');
  check(typeof mod.detectDeprecatedPlugin === 'function', 'detectDeprecatedPlugin is a function');
  check(typeof mod.createMigrationPlan === 'function', 'createMigrationPlan is a function');
  check(typeof mod.checkDeprecationUrgency === 'function', 'checkDeprecationUrgency is a function');
  check(typeof mod.summarizeDeprecations === 'function', 'summarizeDeprecations is a function');
  check(typeof mod.isPluginDeprecated === 'function', 'isPluginDeprecated is a function');
  check(typeof mod.getDeprecationMessage === 'function', 'getDeprecationMessage is a function');

  const notice = mod.createDeprecationNotice('old-plugin', 'replaced by new-plugin', 'new-plugin');
  check(notice.pluginId === 'old-plugin', 'Notice has pluginId');
  check(notice.reason === 'replaced by new-plugin', 'Notice has reason');
  check(notice.alternative === 'new-plugin', 'Notice has alternative');
  check(notice.status === 'deprecated', 'Notice status is deprecated');

  const nullNotice = mod.createDeprecationNotice('x', null, null);
  check(nullNotice.reason === 'No reason specified', 'Default reason provided');

  const manifest = { id: 'old-plugin', deprecated: true, deprecatedAt: '2024-01-01T00:00:00Z' };
  const detected = mod.detectDeprecatedPlugin(manifest);
  check(detected !== null, 'Detects deprecated plugin');
  check(detected.warnings.length > 0, 'Deprecated plugin has warnings');

  check(mod.detectDeprecatedPlugin(null) === null, 'Null manifest returns null');

  const migration = mod.createMigrationPlan(notice, 'new-plugin');
  check(typeof migration === 'object', 'createMigrationPlan returns object');

  const urgency = mod.checkDeprecationUrgency(notice);
  check(typeof urgency === 'object', 'checkDeprecationUrgency returns object');

  check(mod.isPluginDeprecated(manifest) === true, 'isPluginDeprecated returns true for deprecated');
  check(mod.isPluginDeprecated({}) === false, 'isPluginDeprecated returns false for non-deprecated');

  const msg = mod.getDeprecationMessage(notice);
  check(typeof msg === 'string' && msg.length > 0, 'getDeprecationMessage returns non-empty string');

  const summary = mod.summarizeDeprecations([notice]);
  check(typeof summary === 'object', 'summarizeDeprecations returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-deprecation-manager.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Deprecation Manager: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

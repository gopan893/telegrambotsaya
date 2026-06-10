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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-docs-generator'));

  check(typeof mod.generatePluginDocs === 'function', 'generatePluginDocs is a function');
  check(typeof mod.generateOverviewSection === 'function', 'generateOverviewSection is a function');
  check(typeof mod.generateInstallationSection === 'function', 'generateInstallationSection is a function');
  check(typeof mod.generateConfigurationSection === 'function', 'generateConfigurationSection is a function');
  check(typeof mod.generatePermissionsSection === 'function', 'generatePermissionsSection is a function');
  check(typeof mod.generateConnectorsSection === 'function', 'generateConnectorsSection is a function');
  check(typeof mod.generateChangelogSection === 'function', 'generateChangelogSection is a function');
  check(typeof mod.generateMarkdownDocs === 'function', 'generateMarkdownDocs is a function');
  check(typeof mod.generateQuickRef === 'function', 'generateQuickRef is a function');

  const manifest = { id: 'test-plugin', name: 'Test Plugin', version: '1.0.0', type: 'module', description: 'A test plugin', author: 'Tester' };
  const docs = mod.generatePluginDocs(manifest, {});
  check(docs.pluginId === 'test-plugin', 'Docs have pluginId');
  check(docs.name === 'Test Plugin', 'Docs have name');
  check(docs.version === '1.0.0', 'Docs have version');
  check(Array.isArray(docs.sections) && docs.sections.length > 0, 'Docs have sections');

  const nullDocs = mod.generatePluginDocs(null, {});
  check(nullDocs.error, 'Null manifest returns error');

  const overview = mod.generateOverviewSection(manifest);
  check(overview.title === 'Overview', 'Overview section has correct title');

  const install = mod.generateInstallationSection(manifest);
  check(install.title === 'Installation', 'Installation section has correct title');

  const perms = mod.generatePermissionsSection(manifest);
  check(perms.title === 'Permissions', 'Permissions section has correct title');

  const md = mod.generateMarkdownDocs(docs);
  check(typeof md === 'string' && md.length > 0, 'Markdown docs is non-empty string');

  const quickRef = mod.generateQuickRef(manifest);
  check(typeof quickRef === 'object' || typeof quickRef === 'string', 'QuickRef returns object or string');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-docs-generator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Docs Generator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

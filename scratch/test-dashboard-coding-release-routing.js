'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed += 1; }
  catch (err) { console.log(`❌ ${name}: ${err.message}`); failed += 1; }
}

const ROOT = path.join(__dirname, '..');
const stateJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'state.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'service-worker.js'), 'utf8');

function getDashboardState() {
  const sandbox = {
    window: {},
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    }
  };
  vm.runInNewContext(stateJs, sandbox);
  return sandbox.window.DashboardState;
}

const DashboardState = getDashboardState();

test('Coding Workspace tab resolves to renderCodingWorkspace', () => {
  assert.strictEqual(DashboardState.findTabId('coding'), 'coding');
  assert.strictEqual(DashboardState.getTabConfig('coding').renderer, 'renderCodingWorkspace');
});

test('Release tab resolves to renderRelease', () => {
  assert.strictEqual(DashboardState.findTabId('release'), 'release');
  assert.strictEqual(DashboardState.getTabConfig('release').renderer, 'renderRelease');
});

test('Coding aliases resolve to coding', () => {
  for (const alias of ['coding-workspace', 'codingworkspace', 'coding_workspace', 'code-workspace']) {
    assert.strictEqual(DashboardState.findTabId(alias), 'coding', `${alias} should resolve to coding`);
  }
});

test('Release aliases resolve to release', () => {
  for (const alias of ['release-health', 'releasecheck', 'release-check']) {
    assert.strictEqual(DashboardState.findTabId(alias), 'release', `${alias} should resolve to release`);
  }
});

test('Internal routines tab no longer resolves as public route', () => {
  assert.strictEqual(DashboardState.findTabId('routines'), null);
  assert.strictEqual(DashboardState.getTabConfig('routines'), null);
});

test('Unknown explicit tab falls back to Overview in app router', () => {
  assert.ok(appJs.includes("rawHash ? 'overview' : DashboardState.restoreLastTab()"), 'invalid explicit hash should use overview');
});

test('app.js nav items prevent default on click', () => {
  assert.ok(appJs.includes('e.preventDefault()'), 'Nav click should call preventDefault');
});

test('Service worker excludes /api/dashboard from cache', () => {
  assert.ok(sw.includes("url.pathname.startsWith('/api/dashboard')"), 'SW should use startsWith on /api/dashboard');
});

test('No secrets or tokens leaked in frontend shell', () => {
  const combined = html + '\n' + appJs + '\n' + stateJs;
  const secrets = ['ghp_', 'sk-', 'GITHUB_TOKEN'];
  for (const secret of secrets) {
    assert.ok(!combined.includes(secret), `frontend shell should not contain ${secret}`);
  }
});

test('HTML has Coding Workspace and Release public nav links', () => {
  assert.ok(html.includes('data-tab="coding"'), 'Coding nav should have data-tab="coding"');
  assert.ok(html.includes('data-tab="release"'), 'Release nav should have data-tab="release"');
  assert.ok(html.includes('Coding Workspace'), 'Coding nav should show Coding Workspace');
  assert.ok(html.includes('Release'), 'Release nav should show Release');
});

console.log(`\n📊 Coding/Release Routing Test Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) process.exit(1);

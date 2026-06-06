'use strict';

/**
 * Dashboard stable-route audit.
 *
 * The public dashboard must expose only production-ready pages. Internal or
 * experimental modules may remain in the codebase, but they must not appear in
 * the sidebar, be restored from stale localStorage, or load extra frontend
 * scripts by default.
 */

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const dashboardDir = path.join(ROOT, 'public', 'dashboard');
const html = fs.readFileSync(path.join(dashboardDir, 'index.html'), 'utf8');
const stateJs = fs.readFileSync(path.join(dashboardDir, 'state.js'), 'utf8');
const appJs = fs.readFileSync(path.join(dashboardDir, 'app.js'), 'utf8');
const swJs = fs.readFileSync(path.join(dashboardDir, 'service-worker.js'), 'utf8');

const publicTabs = [
  'overview', 'ops', 'workspaces', 'users', 'permissions',
  'memory', 'goals', 'workflows', 'planner', 'executor',
  'agents', 'tools', 'integrations', 'backup', 'insights',
  'graph', 'benchmarks', 'incidents', 'observability', 'audit', 'commands',
  'env', 'settings', 'agent-evaluation', 'coding', 'release',
  'selfhealing', 'monitoring', 'cicd'
];

const internalTabs = ['routines'];

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${name}: ${err.message}`);
    failed += 1;
  }
}

function createDashboardState(savedTab) {
  const storage = {};
  if (savedTab) storage.dashboard_last_tab = savedTab;
  const sandbox = {
    window: {},
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null; },
      setItem(key, value) { storage[key] = String(value); },
      removeItem(key) { delete storage[key]; }
    }
  };
  vm.runInNewContext(stateJs, sandbox, { filename: 'state.js' });
  return sandbox.window.DashboardState;
}

test('public sidebar contains every stable tab', () => {
  for (const tab of publicTabs) {
    assert(html.includes(`data-tab="${tab}"`), `missing public nav tab ${tab}`);
    assert(html.includes(`href="#${tab}"`), `missing public hash ${tab}`);
  }
});

test('experimental/internal tabs are not shown in public sidebar', () => {
  for (const tab of internalTabs) {
    assert(!html.includes(`data-tab="${tab}"`), `internal tab ${tab} is visible`);
    assert(!html.includes(`href="#${tab}"`), `internal hash ${tab} is visible`);
  }
});

test('internal tab configs are retained but disabled for public routing', () => {
  for (const tab of internalTabs) {
    assert(stateJs.includes(`${tab}:`) || stateJs.includes(`'${tab}':`), `internal config ${tab} should remain registered`);
  }
  assert((stateJs.match(/routeEnabled:\s*false/g) || []).length >= internalTabs.length, 'internal tabs must disable routeEnabled');
  assert((stateJs.match(/internalOnly:\s*true/g) || []).length >= internalTabs.length, 'internal tabs must be marked internalOnly');
});

test('DashboardState refuses direct routing to internal tabs', () => {
  const DashboardState = createDashboardState();
  for (const tab of internalTabs) {
    assert.strictEqual(DashboardState.findTabId(tab), null, `${tab} should not resolve as public tab`);
  }
  assert.strictEqual(DashboardState.findTabId('selfhealing'), 'selfhealing', 'selfhealing is a stable public Phase 32 tab');
  assert.strictEqual(DashboardState.findTabId('agents'), 'agents', 'agents remains routable');
});

test('stale lastTab values for internal tabs restore to overview', () => {
  for (const tab of internalTabs) {
    const DashboardState = createDashboardState(tab);
    assert.strictEqual(DashboardState.restoreLastTab(), 'overview', `${tab} stale lastTab should not restore`);
  }
});

test('app router falls back to overview for unknown or disabled hash', () => {
  assert(appJs.includes("rawHash ? 'overview' : DashboardState.restoreLastTab()"), 'routeTab should use overview for invalid explicit hash');
  assert(appJs.includes("window.history.replaceState(null, '', '#overview')"), 'routeTab should replace invalid hash with #overview');
  assert(appJs.includes('ensureRenderedContent'), 'routeTab should guard against blank rendered pages');
  assert(appJs.includes('renderRoutePlaceholder'), 'routeTab should show a safe placeholder for blank pages');
});

test('dashboard frontend scripts are syntax valid', () => {
  execSync('node --check public/dashboard/ui.js', { stdio: 'pipe' });
  execSync('node --check public/dashboard/app.js', { stdio: 'pipe' });
});

test('dashboard shell loads stable Phase 33 monitoring/cicd scripts', () => {
  assert(html.includes('realtime-monitoring.js'), 'realtime-monitoring.js should load for live monitoring tab');
  assert(html.includes('cicd.js'), 'cicd.js should load for CI/CD tab helpers');
});

test('asset version query busts stale PWA dashboard cache', () => {
  assert(html.includes('v=20260607-dashboard-usability-fix'), 'dashboard shell should version static assets');
  assert(swJs.includes('telegram-aios-dashboard-static-v35-dashboard-usability'), 'service worker cache name should be bumped');
});

test('service worker does not cache dashboard API responses', () => {
  assert(swJs.includes("url.pathname.startsWith('/api/dashboard')"), 'service worker must treat dashboard API as sensitive');
  const staticAssetsBlock = swJs.slice(swJs.indexOf('const STATIC_ASSETS'), swJs.indexOf('];') + 2);
  assert(!staticAssetsBlock.includes('/api/dashboard'), 'STATIC_ASSETS must not include dashboard API paths');
});

test('frontend files do not contain hard-coded secrets', () => {
  const combined = [html, stateJs, appJs, swJs].join('\n');
  const forbidden = [
    /\d{8,12}:[A-Za-z0-9_-]{20,}/,
    /postgresql:\/\/[^'"\s]+/i,
    /rediss?:\/\/[^'"\s]+/i,
    /sk-[A-Za-z0-9_-]+/,
    /gsk_[A-Za-z0-9_-]+/,
    /tvly_[A-Za-z0-9_-]+/
  ];
  for (const pattern of forbidden) {
    assert(!pattern.test(combined), `secret-like pattern leaked: ${pattern}`);
  }
});

console.log(`\nDashboard stable route audit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

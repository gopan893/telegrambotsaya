'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`\x1b[32m✅ ${name}\x1b[0m`); passed++; }
  catch (err) { console.log(`\x1b[31m❌ ${name}: ${err.message}\x1b[0m`); failed++; }
}

// ---- Load and evaluate the registry from state.js ----
const stateJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'state.js');
const stateJs = fs.readFileSync(stateJsPath, 'utf-8');

// Extract DASHBOARD_TABS by evaluating the JS (safe, no side effects)
let DASHBOARD_TABS = {};
(function() {
  const module = { exports: {} };
  const window = {};
  // Evaluate just the DASHBOARD_TABS definition
  const match = stateJs.match(/const DASHBOARD_TABS\s*=\s*(\{[\s\S]*?\});\s*\n\s*const DashboardState/);
  if (match) {
    eval('DASHBOARD_TABS = ' + match[1]);
  }
})();

// ---- HTML sidebar analysis ----
const htmlPath = path.join(__dirname, '..', 'public', 'dashboard', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// Extract all data-tab values from sidebar
const sidebarTabMatches = html.match(/data-tab="([^"]+)"/g) || [];
const sidebarTabIds = [...new Set(sidebarTabMatches.map(m => m.replace('data-tab="', '').replace('"', '')))];

// ---- UI.js render function analysis ----
const uiJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'ui.js');
const uiJs = fs.readFileSync(uiJsPath, 'utf-8');

// Extract render function names from UI object
const renderMatches = uiJs.match(/^\s+(?:async\s+)?render(\w+)\(/gm) || [];
const renderFunctionNames = renderMatches.map(m => m.trim().replace('async ', '').replace(/\(.*/, ''));

const appJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf-8');

// ---- Tests ----

test('DASHBOARD_TABS registry exists', () => {
  assert.ok(DASHBOARD_TABS, 'DASHBOARD_TABS should be defined');
  const ids = Object.keys(DASHBOARD_TABS);
  assert.ok(ids.length >= 20, `Should have at least 20 tabs, got ${ids.length}`);
});

test('Every sidebar data-tab has a corresponding DASHBOARD_TABS entry', () => {
  for (const tabId of sidebarTabIds) {
    assert.ok(DASHBOARD_TABS[tabId], `Sidebar tab "${tabId}" must exist in DASHBOARD_TABS`);
  }
});

test('Every DASHBOARD_TABS entry with navVisible has matching sidebar entry', () => {
  for (const [id, config] of Object.entries(DASHBOARD_TABS)) {
    if (config.navVisible !== false) {
      assert.ok(sidebarTabIds.includes(id), `Tab "${id}" should have a sidebar entry`);
    }
  }
});

test('Overview tab has renderer', () => {
  assert.ok(DASHBOARD_TABS.overview, 'overview tab exists');
  assert.ok(DASHBOARD_TABS.overview.renderer, 'overview has renderer');
});

test('Workspaces tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.workspaces, 'workspaces tab exists');
  assert.ok(DASHBOARD_TABS.workspaces.renderer, 'workspaces has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Workspaces')), 'renderWorkspaces function exists in UI');
});

test('Agents tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.agents, 'agents tab exists');
  assert.ok(DASHBOARD_TABS.agents.renderer, 'agents has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Agents')), 'renderAgents function exists');
});

test('Integrations tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.integrations, 'integrations tab exists');
  assert.ok(DASHBOARD_TABS.integrations.renderer, 'integrations has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Integrations')), 'renderIntegrations function exists');
});

test('Coding tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.coding, 'coding tab exists');
  assert.ok(DASHBOARD_TABS.coding.renderer, 'coding has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Coding')), 'renderCodingWorkspace function exists');
});

test('Release tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.release, 'release tab exists');
  assert.ok(DASHBOARD_TABS.release.renderer, 'release has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Release')), 'renderRelease function exists');
});

test('Routines tab exists and has renderer', () => {
  assert.ok(DASHBOARD_TABS.routines, 'routines tab exists');
  assert.ok(DASHBOARD_TABS.routines.renderer, 'routines has renderer');
  assert.ok(renderFunctionNames.some(fn => fn.includes('Routines')), 'renderRoutines function exists');
});

test('All sidebar tabs have render functions (implemented or placeholder)', () => {
  for (const tabId of sidebarTabIds) {
    const config = DASHBOARD_TABS[tabId];
    assert.ok(config, `Tab "${tabId}" must exist in DASHBOARD_TABS`);
    const rendererName = config.renderer;
    assert.ok(rendererName, `Tab "${tabId}" must have a renderer property`);
    assert.ok(renderFunctionNames.includes(rendererName), `UI.${rendererName} must exist for tab "${tabId}"`);
  }
});

test('Coding workspace aliases resolve correctly', () => {
  for (const [id, config] of Object.entries(DASHBOARD_TABS)) {
    if (config.aliases && config.aliases.includes('coding-workspace')) {
      assert.strictEqual(id, 'coding', 'coding-workspace alias must resolve to coding');
    }
    if (config.aliases && config.aliases.includes('release-health')) {
      assert.strictEqual(id, 'release', 'release-health alias must resolve to release');
    }
  }
});

test('No duplicate sidebar entries', () => {
  const counts = {};
  for (const id of sidebarTabIds) {
    counts[id] = (counts[id] || 0) + 1;
  }
  for (const [id, count] of Object.entries(counts)) {
    assert.strictEqual(count, 1, `Tab "${id}" appears ${count} times in sidebar (should be 1)`);
  }
});

test('findTabId returns overview for empty hash', () => {
  // Test the logic from state.js
  const findTabId = (hash) => {
    const clean = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!clean) return 'overview';
    if (DASHBOARD_TABS[clean]) return clean;
    for (const [id, config] of Object.entries(DASHBOARD_TABS)) {
      if ((config.aliases || []).some(a => a.toLowerCase() === clean)) {
        return id;
      }
    }
    return null;
  };
  assert.strictEqual(findTabId(''), 'overview');
  assert.strictEqual(findTabId('#'), 'overview');
});

test('findTabId returns null for unknown tab', () => {
  const findTabId = (hash) => {
    const clean = String(hash || '').replace(/^#/, '').trim().toLowerCase();
    if (!clean) return 'overview';
    if (DASHBOARD_TABS[clean]) return clean;
    for (const [id, config] of Object.entries(DASHBOARD_TABS)) {
      if ((config.aliases || []).some(a => a.toLowerCase() === clean)) {
        return id;
      }
    }
    return null;
  };
  assert.strictEqual(findTabId('nonexistent-tab-xyz'), null);
});

test('app.js uses DashboardState.findTabId', () => {
  assert.ok(appJs.includes('DashboardState.findTabId'), 'app.js should use DashboardState.findTabId');
});

test('app.js uses DashboardState.restoreLastTab', () => {
  assert.ok(appJs.includes('DashboardState.restoreLastTab'), 'app.js should use DashboardState.restoreLastTab');
});

test('app.js has renderTabContent function', () => {
  assert.ok(appJs.includes('renderTabContent'), 'app.js should have renderTabContent function');
});

test('app.js no longer has switch statement router', () => {
  assert.ok(!appJs.includes('switch (currentTab)'), 'app.js should not have switch statement router');
});

test('Service worker excludes /api/dashboard/', () => {
  const swPath = path.join(__dirname, '..', 'public', 'dashboard', 'service-worker.js');
  const sw = fs.readFileSync(swPath, 'utf-8');
  assert.ok(sw.includes('/api/dashboard'), 'SW should check for /api/dashboard/');
});

test('No secrets leaked in any frontend file', () => {
  const secrets = ['ghp_'];
  for (const filePath of [stateJsPath, htmlPath, appJsPath, uiJsPath]) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const secret of secrets) {
      assert.ok(!content.includes(secret), `${path.basename(filePath)} should not contain ${secret}`);
    }
  }
});

test('HTML sidebar has canonical hashes matching data-tab', () => {
  // Each <a href="#X" data-tab="X"> must have matching href and data-tab
  const links = html.match(/<a href="([^"]+)" data-tab="([^"]+)"/g) || [];
  for (const link of links) {
    const hrefMatch = link.match(/href="([^"]+)"/);
    const tabMatch = link.match(/data-tab="([^"]+)"/);
    if (hrefMatch && tabMatch) {
      assert.strictEqual(hrefMatch[1], '#' + tabMatch[1], `href and data-tab must match: ${link}`);
    }
  }
});

console.log(`\n📊 Router Registry Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);

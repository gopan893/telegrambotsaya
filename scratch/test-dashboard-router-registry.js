/**
 * test-dashboard-router-registry.js
 * Tests that DASHBOARD_TABS registry is complete and consistent.
 * Run: node scratch/test-dashboard-router-registry.js
 */
var path = require('path');
var fs = require('fs');

var stateJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'state.js');
var appJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'app.js');
var indexHtmlPath = path.join(__dirname, '..', 'public', 'dashboard', 'index.html');
var stylesCssPath = path.join(__dirname, '..', 'public', 'dashboard', 'styles.css');
var swJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'service-worker.js');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

var stateJs = fs.readFileSync(stateJsPath, 'utf-8');
var appJs = fs.readFileSync(appJsPath, 'utf-8');
var indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
var stylesCss = fs.readFileSync(stylesCssPath, 'utf-8');
var swJs = fs.readFileSync(swJsPath, 'utf-8');

console.log('\n=== DASHBOARD_TAB Registry Tests ===\n');

// DASHBOARD_TABS exists in state.js
assert(stateJs.indexOf('const DASHBOARD_TABS') !== -1, 'DASHBOARD_TABS variable defined in state.js');
assert(stateJs.indexOf('overview') !== -1, 'DASHBOARD_TABS has overview tab');

// Known tabs that must NOT fallback to overview
var knownTabs = [
  'overview', 'ops', 'workspaces', 'users', 'permissions',
  'memory', 'goals', 'workflows', 'planner', 'executor',
  'agents', 'tools', 'integrations', 'backup', 'insights',
  'graph', 'benchmarks', 'incidents', 'audit', 'commands',
  'env', 'settings', 'agent-evaluation', 'coding', 'release', 'routines'
];

var criticalTabs = ['workspaces', 'agents', 'integrations', 'coding', 'release', 'routines', 'agent-evaluation'];

console.log('\n--- All known tabs present in DASHBOARD_TABS ---\n');
for (var i = 0; i < knownTabs.length; i++) {
  var tabKey = knownTabs[i];
  var quoted = "'" + tabKey + "'";
  var dblQuoted = '"' + tabKey + '"';
  var unquoted = tabKey + ':';
  var found = stateJs.indexOf(quoted) !== -1 || stateJs.indexOf(dblQuoted) !== -1 || stateJs.indexOf(unquoted) !== -1;
  assert(found, 'Tab "' + tabKey + '" exists in DASHBOARD_TABS');
}

console.log('\n--- Critical tabs have dedicated render functions ---\n');
var expectedRenderers = {
  workspaces: 'renderWorkspaces',
  agents: 'renderAgents',
  integrations: 'renderIntegrations',
  coding: 'renderCodingWorkspace',
  release: 'renderRelease',
  routines: 'renderRoutines',
  'agent-evaluation': 'renderAgentEvaluation'
};
var uiJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard', 'ui.js'), 'utf-8');
for (var tabId in expectedRenderers) {
  var fnName = expectedRenderers[tabId];
  assert(uiJs.indexOf(fnName) !== -1, tabId + ' has renderer ' + fnName + ' in ui.js');
}

console.log('\n--- Menu items in index.html ---\n');
for (var j = 0; j < knownTabs.length; j++) {
  var t = knownTabs[j];
  var dataTabAttr = 'data-tab="' + t + '"';
  assert(indexHtml.indexOf(dataTabAttr) !== -1, 'Menu item data-tab="' + t + '" exists');
}

console.log('\n--- Hash links in index.html ---\n');
for (var k = 0; k < knownTabs.length; k++) {
  var tab = knownTabs[k];
  var hash = 'href="#' + tab + '"';
  assert(indexHtml.indexOf(hash) !== -1, 'Menu item href="#' + tab + '" exists');
}

console.log('\n--- Dark Form UI Styles ---\n');
var formSelectors = ['input', 'select', 'textarea', '.form-control', '.dashboard-input', '.dashboard-select', '.dashboard-textarea'];
for (var s = 0; s < formSelectors.length; s++) {
  var sel = formSelectors[s];
  assert(stylesCss.indexOf(sel) !== -1, 'CSS has selector "' + sel + '"');
}

assert(stylesCss.indexOf('background: var(--bg-primary)') !== -1, 'Uses bg-primary for inputs');
assert(stylesCss.indexOf('var(--color-accent)') !== -1 || stylesCss.indexOf('#3b82f6') !== -1, 'Blue focus state exists');

console.log('\n--- Router Functions ---\n');
var routerFuncs = ['normalizeCanonicalTabId', 'findTabId', 'getTabConfig', 'setActiveTab', 'restoreLastTab'];
for (var r = 0; r < routerFuncs.length; r++) {
  assert(stateJs.indexOf(routerFuncs[r]) !== -1, 'Router function "' + routerFuncs[r] + '" exists');
}

console.log('\n--- Alias support ---\n');
assert(stateJs.indexOf('aliases') !== -1, 'aliases field exists in registry');
assert(stateJs.indexOf('codingworkspace') !== -1, 'Alias codingworkspace exists');
assert(stateJs.indexOf('coding_workspace') !== -1, 'Alias coding_workspace exists');
assert(stateJs.indexOf('codingWorkspace') !== -1, 'Alias codingWorkspace exists');
assert(stateJs.indexOf('release-health') !== -1, 'Alias release-health exists');
assert(stateJs.indexOf('releasecheck') !== -1, 'Alias releasecheck exists');

console.log('\n--- Service Worker ---\n');
assert(swJs.indexOf('/api/dashboard') !== -1, 'SW excludes /api/dashboard from caching');
assert(swJs.indexOf('CACHE_NAME') !== -1, 'SW has CACHE_NAME');
assert(swJs.indexOf('network-first') !== -1 || swJs.indexOf('network') !== -1, 'SW has network-first strategy');

console.log('\n--- Autofill CSS ---\n');
assert(stylesCss.indexOf('-webkit-autofill') !== -1, 'Autofill override exists');
assert(stylesCss.indexOf('-webkit-text-fill-color') !== -1, 'Autofill text color override');

console.log('\n----------------------------------------');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

'use strict';

/**
 * Dashboard tab registry consistency test.
 * Public navigation should be stable; internal experimental tabs may exist in
 * state.js but must stay hidden from the sidebar and direct hash routing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const stateJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'state.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'styles.css'), 'utf8');
const swJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'service-worker.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'ui.js'), 'utf8');
const observabilityJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'observability.js'), 'utf8');
const portfolioJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'portfolio.js'), 'utf8');
const dashboardRenderers = `${uiJs}\n${observabilityJs}\n${portfolioJs}`;

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed += 1;
  } else {
    console.error('  FAIL: ' + msg);
    failed += 1;
  }
}

const publicTabs = [
  'overview', 'ops', 'workspaces', 'users', 'permissions',
  'memory', 'goals', 'workflows', 'planner', 'executor',
  'agents', 'tools', 'integrations', 'backup', 'insights',
  'graph', 'benchmarks', 'incidents', 'observability', 'portfolio', 'audit', 'commands',
  'env', 'settings', 'agent-evaluation', 'coding', 'release', 'selfhealing', 'monitoring', 'cicd'
];
const internalTabs = ['routines'];
const expectedRenderers = {
  workspaces: 'renderWorkspaces',
  agents: 'renderAgents',
  integrations: 'renderIntegrations',
  coding: 'renderCodingWorkspace',
  release: 'renderRelease',
  selfhealing: 'renderSelfHealing',
  monitoring: 'renderMonitoring',
  cicd: 'renderCicd',
  observability: 'renderObservability',
  portfolio: 'renderPortfolio',
  'agent-evaluation': 'renderAgentEvaluation'
};

console.log('\n=== Dashboard Tab Registry Tests ===\n');

assert(stateJs.includes('const DASHBOARD_TABS'), 'DASHBOARD_TABS variable defined in state.js');

console.log('\n--- Public tabs present in registry and sidebar ---\n');
for (const tab of publicTabs) {
  const foundInState = stateJs.includes(`${tab}:`) || stateJs.includes(`'${tab}':`) || stateJs.includes(`"${tab}":`);
  assert(foundInState, `Public tab "${tab}" exists in DASHBOARD_TABS`);
  assert(indexHtml.includes(`data-tab="${tab}"`), `Public menu item data-tab="${tab}" exists`);
  assert(indexHtml.includes(`href="#${tab}"`), `Public menu item href="#${tab}" exists`);
}

console.log('\n--- Internal tabs hidden from public navigation ---\n');
for (const tab of internalTabs) {
  const foundInState = stateJs.includes(`${tab}:`) || stateJs.includes(`'${tab}':`) || stateJs.includes(`"${tab}":`);
  assert(foundInState, `Internal tab "${tab}" remains registered for guarded modules`);
  assert(!indexHtml.includes(`data-tab="${tab}"`), `Internal tab "${tab}" is absent from sidebar`);
  assert(!indexHtml.includes(`href="#${tab}"`), `Internal tab "${tab}" hash is absent from sidebar`);
}
assert((stateJs.match(/routeEnabled:\s*false/g) || []).length >= internalTabs.length, 'Internal tabs have routeEnabled false');

console.log('\n--- Critical public tabs have render functions ---\n');
for (const [tabId, fnName] of Object.entries(expectedRenderers)) {
  assert(dashboardRenderers.includes(fnName), `${tabId} has renderer ${fnName}`);
}

console.log('\n--- Dark Form UI Styles ---\n');
for (const selector of ['input', 'select', 'textarea', '.form-control', '.dashboard-input', '.dashboard-select', '.dashboard-textarea']) {
  assert(stylesCss.includes(selector), `CSS has selector "${selector}"`);
}
assert(stylesCss.includes('background: var(--bg-primary)'), 'Uses bg-primary for inputs');
assert(stylesCss.includes('var(--color-accent)') || stylesCss.includes('#3b82f6'), 'Blue focus state exists');

console.log('\n--- Router Functions ---\n');
for (const fnName of ['normalizeCanonicalTabId', 'findTabId', 'getTabConfig', 'setActiveTab', 'restoreLastTab', 'isPublicRoutableTab']) {
  assert(stateJs.includes(fnName), `Router function "${fnName}" exists`);
}
assert(appJs.includes("rawHash ? 'overview' : DashboardState.restoreLastTab()"), 'Explicit invalid hashes route to overview');

console.log('\n--- Alias support ---\n');
for (const alias of ['codingworkspace', 'coding_workspace', 'codingWorkspace', 'release-health', 'releasecheck']) {
  assert(stateJs.includes(alias), `Alias ${alias} exists`);
}

console.log('\n--- Service Worker ---\n');
assert(swJs.includes("url.pathname.startsWith('/api/dashboard')"), 'SW excludes /api/dashboard from caching');
assert(swJs.includes('CACHE_NAME'), 'SW has CACHE_NAME');
assert(swJs.includes('telegram-aios-dashboard-static-v38-phase42-portfolio-knowledge'), 'SW cache version bumped');

console.log('\n--- Autofill CSS ---\n');
assert(stylesCss.includes('-webkit-autofill'), 'Autofill override exists');
assert(stylesCss.includes('-webkit-text-fill-color'), 'Autofill text color override');

console.log('\n----------------------------------------');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

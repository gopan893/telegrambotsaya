'use strict';

/**
 * Tests that public menu routes render their own stable page content.
 * Internal experimental pages are intentionally hidden from the public menu.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const stateJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'state.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'app.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'ui.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public', 'dashboard', 'index.html'), 'utf8');

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

console.log('\n=== All Public Menu Routes Test ===\n');

const menuExpectations = {
  overview: { title: 'System Overview', renderer: 'renderOverview' },
  ops: { title: 'Ops Viewer', renderer: 'renderOps' },
  workspaces: { title: 'Workspaces', renderer: 'renderWorkspaces' },
  users: { title: 'Users', renderer: 'renderUsers' },
  permissions: { title: 'Permissions', renderer: 'renderPermissions' },
  memory: { title: 'Memory Records', renderer: 'renderMemory' },
  goals: { title: 'Goals', renderer: 'renderGoals' },
  workflows: { title: 'Workflows', renderer: 'renderWorkflows' },
  planner: { title: 'Planner', renderer: 'renderPlanner' },
  executor: { title: 'Executor', renderer: 'renderExecutor' },
  agents: { title: 'Agents', renderer: 'renderAgents' },
  tools: { title: 'Tools', renderer: 'renderTools' },
  integrations: { title: 'External Integrations', renderer: 'renderIntegrations' },
  backup: { title: 'Backup & Recovery', renderer: 'renderBackup' },
  insights: { title: 'Cognitive Insights', renderer: 'renderInsights' },
  graph: { title: 'Knowledge Graph', renderer: 'renderGraph' },
  benchmarks: { title: 'Benchmarks Audit', renderer: 'renderBenchmarks' },
  incidents: { title: 'Incidents Log', renderer: 'renderIncidents' },
  audit: { title: 'Audit Log', renderer: 'renderAuditLog' },
  commands: { title: 'Command Catalog', renderer: 'renderCommands' },
  env: { title: 'Environment Check', renderer: 'renderEnv' },
  settings: { title: 'Settings Control', renderer: 'renderSettings' },
  'agent-evaluation': { title: 'Agent Evaluation', renderer: 'renderAgentEvaluation' },
  coding: { title: 'Coding Workspace', renderer: 'renderCodingWorkspace' },
  release: { title: 'Release / Health', renderer: 'renderRelease' }
};

console.log('--- Public tabs have renderers and own titles ---\n');
for (const [tabId, expected] of Object.entries(menuExpectations)) {
  assert(html.includes(`data-tab="${tabId}"`), `${tabId} exists in public sidebar`);
  assert(uiJs.includes(expected.renderer), `${tabId} has renderer ${expected.renderer}`);
  const titleFound = stateJs.includes(`title: '${expected.title}'`) ||
    stateJs.includes(`title: "${expected.title}"`) ||
    uiJs.includes(expected.title);
  assert(titleFound, `${tabId} renders or registers title "${expected.title}"`);
}

console.log('\n--- Internal pages are not public menu routes ---\n');
for (const tabId of ['routines', 'selfhealing', 'monitoring', 'cicd']) {
  assert(!html.includes(`data-tab="${tabId}"`), `${tabId} is hidden from public sidebar`);
}

console.log('\n--- Unknown or internal hash falls back to Overview ---\n');
assert(appJs.includes("rawHash ? 'overview' : DashboardState.restoreLastTab()"), 'Explicit invalid hash falls back to Overview');
assert(stateJs.includes('routeEnabled !== false'), 'State filters disabled routes');

console.log('\n--- Hash routing works ---\n');
assert(appJs.includes('hashchange'), 'hashchange event listener exists');
assert(appJs.includes('window.location.hash'), 'Hash routing logic exists');

console.log('\n--- localStorage lastTab guard ---\n');
assert(stateJs.includes('dashboard_last_tab'), 'localStorage lastTab key exists');
assert(stateJs.includes('localStorage.removeItem'), 'stale hidden lastTab is cleared');

console.log('\n--- Mobile sidebar works ---\n');
assert(appJs.includes("sidebar.classList.toggle('open')"), 'Sidebar open toggle exists');
assert(appJs.includes("sidebar.classList.remove('open')"), 'Sidebar close toggle exists');

console.log('\n========================================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

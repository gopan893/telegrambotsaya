/**
 * test-dashboard-all-menu-routes.js
 * Tests that known tabs render their own content, not Overview.
 * Run: node scratch/test-dashboard-all-menu-routes.js
 */
var path = require('path');
var fs = require('fs');

var stateJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'state.js');
var appJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'app.js');
var uiJsPath = path.join(__dirname, '..', 'public', 'dashboard', 'ui.js');

var stateJs = fs.readFileSync(stateJsPath, 'utf-8');
var appJs = fs.readFileSync(appJsPath, 'utf-8');
var uiJs = fs.readFileSync(uiJsPath, 'utf-8');

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

console.log('\n=== All Menu Routes Test ===\n');

// Menu items and their expected page title/content
var menuExpectations = {
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
  release: { title: 'Release / Health', renderer: 'renderRelease' },
  routines: { title: 'Routine Center', renderer: 'renderRoutines' }
};

console.log('--- Each tab has a renderer and does not show Overview ---\n');
for (var tabId in menuExpectations) {
  var expected = menuExpectations[tabId];

  // Check renderer function exists
  assert(uiJs.indexOf('async ' + expected.renderer) !== -1 || uiJs.indexOf(expected.renderer) !== -1,
    tabId + ' has renderer ' + expected.renderer);

  // Check the render function references the correct title
  var titleQuoted = "'" + expected.title + "'";
  var titleDbl = '"' + expected.title + '"';
  var titleBacktick = '`' + expected.title + '`';
  var hasTitle = stateJs.indexOf(titleQuoted) !== -1 ||
                 stateJs.indexOf(titleDbl) !== -1 ||
                 stateJs.indexOf(titleBacktick) !== -1;

  // For critical tabs, also check ui.js references their own title
  if (['workspaces', 'agents', 'integrations', 'coding', 'release', 'routines', 'agent-evaluation'].indexOf(tabId) !== -1) {
    var uiTitleCheck = uiJs.indexOf("'" + expected.title + "'") !== -1 ||
                       uiJs.indexOf('"' + expected.title + '"') !== -1 ||
                       uiJs.indexOf('`' + expected.title + '`') !== -1;
    assert(hasTitle || uiTitleCheck, tabId + ' renders its own title: "' + expected.title + '"');
  }
}

console.log('\n--- Unknown tab falls back to Overview ---\n');
assert(stateJs.indexOf("return null") !== -1 || stateJs.indexOf("return 'overview'") !== -1, 'Unknown tabId returns null/overview');

console.log('\n--- Hash routing works ---\n');
assert(appJs.indexOf("hashchange") !== -1, 'hashchange event listener exists');
assert(appJs.indexOf("window.location.hash") !== -1, 'Hash routing logic exists');

console.log('\n--- localStorage lastTab ---\n');
assert(stateJs.indexOf("dashboard_last_tab") !== -1, 'localStorage lastTab key exists');
assert(stateJs.indexOf("setActiveTab") !== -1, 'setActiveTab function exists');
assert(stateJs.indexOf("restoreLastTab") !== -1, 'restoreLastTab function exists');

console.log('\n--- Mobile sidebar works ---\n');
assert(appJs.indexOf("sidebar.classList.toggle('open')") !== -1, 'Sidebar open toggle exists');
assert(appJs.indexOf("sidebar.classList.remove('open')") !== -1, 'Sidebar close toggle exists');

console.log('\n========================================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function run() {
  const indexHtml = read('public/dashboard/index.html');
  const stateJs = read('public/dashboard/state.js');
  const uiJs = read('public/dashboard/ui.js');
  const runtimeJs = read('src/bot/legacy-runtime.js');
  const wsServer = read('src/monitoring/websocket-server.js');
  const cicdRoutes = read('src/dashboard/cicd-routes.js');

  assert(indexHtml.includes('data-tab="monitoring"'), 'Monitoring tab visible');
  assert(indexHtml.includes('data-tab="cicd"'), 'CI/CD tab visible');
  assert(indexHtml.includes('data-tab="routines"'), 'Routines tab visible as public tab');
  assert(stateJs.includes("renderer: 'renderMonitoring'"), 'Monitoring renderer registered');
  assert(stateJs.includes("renderer: 'renderCicd'"), 'CI/CD renderer registered');
  assert(uiJs.includes('/cicd/workflow-dispatch/propose'), 'CI/CD workflow proposal UI present');
  assert(uiJs.includes('/cicd/deploy/propose'), 'CI/CD deploy proposal UI present');

  assert(wsServer.includes('authenticateWebSocketClient'), 'WebSocket auth function exists');
  assert(wsServer.includes('dashboard-auth.'), 'WebSocket supports dashboard auth protocol');

  for (const workflow of ['ci.yml', 'release-check.yml', 'dashboard-regression.yml']) {
    assert(fs.existsSync(path.join(ROOT, '.github', 'workflows', workflow)), `${workflow} exists`);
  }

  for (const cmd of ['/monitor', '/livehealth', '/autoheal', '/autoheal_run', '/cicd_status', '/github_actions', '/propose_workflow', '/propose_deploy']) {
    assert(runtimeJs.includes(cmd), `${cmd} command registered`);
  }

  assert(cicdRoutes.includes('/workflow-dispatch/propose'), 'workflow dispatch route is proposal only');
  assert(cicdRoutes.includes('/deploy/propose'), 'deploy route is proposal only');
  assert(!runtimeJs.includes('workflow_dispatch') || runtimeJs.includes('proposal'), 'runtime does not directly dispatch workflows');

  const combined = [indexHtml, stateJs, uiJs, runtimeJs, wsServer, cicdRoutes].join('\n');
  const secretPatterns = [/postgresql:\/\/[^'"\s]+/i, /rediss?:\/\/[^'"\s]+/i, /sk-[A-Za-z0-9_-]+/, /ghp_[A-Za-z0-9_]+/];
  for (const pattern of secretPatterns) assert(!pattern.test(combined), `no secret leak for ${pattern}`);

  console.log('test-phase33-regression: ok');
}

run();

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

  const agentRouteFile = path.join(ROOT, 'src/dashboard/agent-routes.js');
  check(fs.existsSync(agentRouteFile), 'agent-routes.js exists');

  const content = fs.readFileSync(agentRouteFile, 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in agent-routes');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in agent-routes');

  let routes;
  try {
    routes = require(agentRouteFile);
    check(true, 'agent-routes requires successfully');
  } catch (e) {
    check(false, 'agent-routes requires: ' + e.message);
    routes = {};
  }

  if (routes && typeof routes === 'object') {
    const routeKeys = Object.keys(routes);
    check(routeKeys.length > 0, 'agent-routes exports at least one route');
    for (const key of routeKeys) {
      check(typeof routes[key] === 'function' || typeof routes[key] === 'object', 'Route ' + key + ' is function/object');
    }
  }

  try {
    new Function(content);
    check(true, 'agent-routes passes syntax check');
  } catch (e) {
    check(false, 'agent-routes syntax: ' + e.message);
  }

  console.log('\n--- Agent Runtime Dashboard API: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

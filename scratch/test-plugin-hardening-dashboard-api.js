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

  const routeFile = path.join(ROOT, 'src/dashboard/plugin-hardening-routes.js');
  check(fs.existsSync(routeFile), 'plugin-hardening-routes.js exists');

  const content = fs.readFileSync(routeFile, 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN literal in route file');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN literal in route file');

  let routes;
  try {
    routes = require(routeFile);
    check(true, 'Route file requires successfully');
  } catch (e) {
    check(false, 'Route file requires successfully: ' + e.message);
    routes = {};
  }

  if (routes && typeof routes === 'object') {
    const routeKeys = Object.keys(routes);
    check(routeKeys.length > 0, 'Route file exports at least one route');
    for (const key of routeKeys) {
      check(typeof routes[key] === 'function' || typeof routes[key] === 'object', 'Route ' + key + ' is function or object');
    }
  }

  try {
    new Function(content);
    check(true, 'Route file passes syntax check');
  } catch (e) {
    check(false, 'Route file passes syntax check: ' + e.message);
  }

  console.log('\n--- Plugin Hardening Dashboard API: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
